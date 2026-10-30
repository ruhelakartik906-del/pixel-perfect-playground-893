import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { customerStatus, type CustomerDetail, type CustomerRow, type PlanRow } from "@/lib/org-features";

type Context = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

async function authorize(context: Context) {
  const result = await context.supabase.rpc("routing_admin");
  if (result.error || result.data !== true) throw new Error("Active Super Admin authorization required");
}

const limitShape = z.object({
  max_employees: z.number().int().positive().nullish(),
  max_leads: z.number().int().positive().nullish(),
  monthly_whatsapp_messages: z.number().int().positive().nullish(),
  max_whatsapp_numbers: z.number().int().positive().nullish(),
  max_chatbots: z.number().int().positive().nullish(),
  max_workflows: z.number().int().positive().nullish(),
  max_drip_campaigns: z.number().int().positive().nullish(),
  max_api_requests: z.number().int().positive().nullish(),
  max_storage_mb: z.number().int().positive().nullish(),
}).strict();

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomerRow[]> => {
    await authorize(context);
    const [companies, subs, plans, members, profiles, roles] = await Promise.all([
      context.supabase.from("companies").select("id,name,email,phone,contact_person,is_active,created_at").order("created_at", { ascending: false }),
      context.supabase.from("org_subscriptions").select("company_id,status,plan_id,expires_at"),
      context.supabase.from("plans").select("id,name"),
      context.supabase.from("company_members").select("company_id,user_id"),
      context.supabase.from("profiles").select("id,full_name,email"),
      context.supabase.from("user_roles").select("user_id,role"),
    ]);
    if (companies.error || subs.error || plans.error || members.error || profiles.error || roles.error) {
      throw new Error("Customers could not be loaded");
    }
    const subByCompany = new Map((subs.data ?? []).map((s) => [s.company_id, s]));
    const planName = new Map((plans.data ?? []).map((p) => [p.id, p.name]));
    const profileById = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const clientIds = new Set((roles.data ?? []).filter((r) => r.role === "client").map((r) => r.user_id));
    const membersByCompany = new Map<string, string[]>();
    for (const m of members.data ?? []) {
      membersByCompany.set(m.company_id, [...(membersByCompany.get(m.company_id) ?? []), m.user_id]);
    }
    return (companies.data ?? []).map((c) => {
      const sub = subByCompany.get(c.id);
      const memberIds = membersByCompany.get(c.id) ?? [];
      const adminId = memberIds.find((id) => clientIds.has(id));
      const admin = adminId ? profileById.get(adminId) : undefined;
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        contact_person: c.contact_person,
        is_active: c.is_active,
        created_at: c.created_at,
        status: customerStatus(sub),
        plan_id: sub?.plan_id ?? null,
        plan_name: sub?.plan_id ? (planName.get(sub.plan_id) ?? null) : null,
        expires_at: sub?.expires_at ?? null,
        employee_count: memberIds.length,
        admin_name: admin?.full_name ?? "",
        admin_email: admin?.email ?? "",
      };
    });
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_name: z.string().trim().min(1, "Company name is required").max(120),
    full_name: z.string().trim().min(1, "Customer name is required").max(120),
    email: z.string().trim().email("Enter a valid email address").max(255),
    phone: z.string().trim().max(40).optional().default(""),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const existing = await context.supabase.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing.error) throw new Error("Customer eligibility could not be checked");
    if (existing.data) throw new Error("An account with this email already exists");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone },
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Customer account could not be created");
    const userId = created.data.user.id;
    const setup = await context.supabase.rpc("master_create_customer", {
      _actor: context.userId,
      _user: userId,
      _email: data.email,
      _name: data.full_name,
      _phone: data.phone,
      _company: data.company_name,
    });
    if (setup.error || !setup.data) {
      // Roll back the auth account so a retry does not hit a duplicate email.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Customer workspace could not be created; the account was rolled back. Please retry.");
    }
    return { company_id: setup.data, user_id: userId };
  });

export const customerDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ company_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }): Promise<CustomerDetail> => {
    await authorize(context);
    const [company, sub, plans, features, limits, members] = await Promise.all([
      context.supabase.from("companies").select("id,name,email,phone,contact_person,is_active,created_at").eq("id", data.company_id).maybeSingle(),
      context.supabase.from("org_subscriptions").select("status,plan_id,term_months,starts_at,expires_at").eq("company_id", data.company_id).maybeSingle(),
      context.supabase.from("plans").select("id,name"),
      context.supabase.from("org_feature_permissions").select("feature_key,enabled").eq("company_id", data.company_id),
      context.supabase.from("org_usage_limits").select("*").eq("company_id", data.company_id).maybeSingle(),
      context.supabase.from("company_members").select("user_id").eq("company_id", data.company_id),
    ]);
    if (company.error || sub.error || plans.error || features.error || limits.error || members.error) {
      throw new Error("Customer details could not be loaded");
    }
    if (!company.data) throw new Error("Customer not found");
    const memberIds = (members.data ?? []).map((m) => m.user_id);
    const [profiles, roles] = await Promise.all([
      memberIds.length ? context.supabase.from("profiles").select("id,full_name,email,account_status").in("id", memberIds) : { data: [], error: null },
      memberIds.length ? context.supabase.from("user_roles").select("user_id,role").in("user_id", memberIds) : { data: [], error: null },
    ]);
    if (profiles.error || roles.error) throw new Error("Customer employees could not be loaded");
    const planName = new Map((plans.data ?? []).map((p) => [p.id, p.name]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles.data ?? []) rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    const limitRow = limits.data;
    return {
      company: company.data,
      subscription: sub.data
        ? {
            status: customerStatus(sub.data),
            plan_id: sub.data.plan_id,
            plan_name: sub.data.plan_id ? (planName.get(sub.data.plan_id) ?? null) : null,
            term_months: sub.data.term_months,
            starts_at: sub.data.starts_at,
            expires_at: sub.data.expires_at,
          }
        : null,
      features: Object.fromEntries((features.data ?? []).map((f) => [f.feature_key, f.enabled])),
      limits: limitRow
        ? {
            max_employees: limitRow.max_employees,
            max_leads: limitRow.max_leads,
            monthly_whatsapp_messages: limitRow.monthly_whatsapp_messages,
            max_whatsapp_numbers: limitRow.max_whatsapp_numbers,
            max_chatbots: limitRow.max_chatbots,
            max_workflows: limitRow.max_workflows,
            max_drip_campaigns: limitRow.max_drip_campaigns,
            max_api_requests: limitRow.max_api_requests,
            max_storage_mb: limitRow.max_storage_mb,
          }
        : {},
      members: (profiles.data ?? []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
        account_status: p.account_status,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

export const setCustomerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_id: z.string().uuid(),
    status: z.enum(["active", "suspended"]),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.rpc("master_set_customer_status", {
      _actor: context.userId, _company: data.company_id, _status: data.status,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const saveCustomerFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_id: z.string().uuid(),
    features: z.record(z.string(), z.boolean()),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.rpc("master_save_customer_features", {
      _actor: context.userId, _company: data.company_id, _features: data.features,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const saveCustomerLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_id: z.string().uuid(),
    limits: limitShape,
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.rpc("master_save_customer_limits", {
      _actor: context.userId, _company: data.company_id, _limits: data.limits,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const assignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_id: z.string().uuid(),
    plan_id: z.string().uuid(),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.rpc("master_assign_plan", {
      _actor: context.userId, _company: data.company_id, _plan: data.plan_id,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const archiveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ company_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.rpc("master_archive_customer", {
      _actor: context.userId, _company: data.company_id,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanRow[]> => {
    await authorize(context);
    const [plans, features] = await Promise.all([
      context.supabase.from("plans").select("id,name,description,limits,is_active").order("created_at"),
      context.supabase.from("plan_features").select("plan_id,feature_key,enabled"),
    ]);
    if (plans.error || features.error) throw new Error("Plans could not be loaded");
    return (plans.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      limits: (p.limits ?? {}) as PlanRow["limits"],
      is_active: p.is_active,
      features: Object.fromEntries((features.data ?? []).filter((f) => f.plan_id === p.id).map((f) => [f.feature_key, f.enabled])),
    }));
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().nullish(),
    name: z.string().trim().min(1, "Plan name is required").max(80),
    description: z.string().trim().max(500).optional().default(""),
    limits: limitShape,
    features: z.record(z.string(), z.boolean()),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.rpc("master_save_plan", {
      _actor: context.userId,
      _plan: data.id ?? null,
      _name: data.name,
      _description: data.description,
      _limits: data.limits,
      _features: data.features,
    });
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Plan could not be saved");
    return { id: result.data };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ plan_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase.from("plans").delete().eq("id", data.plan_id);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
