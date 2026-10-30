import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Context = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

/** Companies where the signed-in user is an active Customer Admin. */
async function adminCompanies(context: Context): Promise<string[]> {
  const memberships = await context.supabase.from("company_members").select("company_id").eq("user_id", context.userId);
  if (memberships.error) throw new Error("Your organizations could not be loaded");
  const ids = (memberships.data ?? []).map((m) => m.company_id);
  const allowed: string[] = [];
  for (const id of ids) {
    const check = await context.supabase.rpc("org_customer_admin", { _user: context.userId, _company: id });
    if (check.error) throw new Error("Your administrator access could not be verified");
    if (check.data === true) allowed.push(id);
  }
  return allowed;
}

export type OrgEmployee = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  account_status: string;
  access_role_id: string | null;
  access_role_name: string | null;
  lead_count: number;
  created_at: string;
};

export type OrgEmployeeAuditRow = {
  id: string;
  action: string;
  employee_id: string | null;
  employee_name: string | null;
  created_at: string;
};

export const listOrgEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ company_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }): Promise<{
    employees: OrgEmployee[];
    audit: OrgEmployeeAuditRow[];
    limit: number | null;
    is_admin: boolean;
  }> => {
    const allowed = await adminCompanies(context);
    if (!allowed.includes(data.company_id)) {
      return { employees: [], audit: [], limit: null, is_admin: false };
    }
    const db = context.supabase;
    const [members, limitRow, auditRows] = await Promise.all([
      db.from("company_members").select("user_id,created_at").eq("company_id", data.company_id),
      db.from("org_usage_limits").select("max_employees").eq("company_id", data.company_id).maybeSingle(),
      db.from("org_employee_audit").select("id,action,employee_id,created_at").eq("company_id", data.company_id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (members.error || limitRow.error || auditRows.error) throw new Error("Employees could not be loaded");
    const memberIds = (members.data ?? []).map((m) => m.user_id);
    const [profiles, roles, accessRoles, accessAssign, leads] = await Promise.all([
      memberIds.length ? db.from("profiles").select("id,full_name,email,phone,account_status").in("id", memberIds) : { data: [], error: null },
      memberIds.length ? db.from("user_roles").select("user_id,role").in("id" as never, memberIds) : { data: [], error: null },
      db.from("access_roles").select("id,name"),
      memberIds.length ? db.from("user_access_roles").select("user_id,role_id").in("user_id", memberIds) : { data: [], error: null },
      memberIds.length ? db.from("leads").select("assigned_to").eq("company_id", data.company_id).in("assigned_to", memberIds) : { data: [], error: null },
    ]);
    if (profiles.error || roles.error || accessRoles.error || accessAssign.error || leads.error) {
      throw new Error("Employee details could not be loaded");
    }
    const employeeIds = new Set((roles.data ?? []).filter((r) => r.role === "employee").map((r) => r.user_id));
    const roleName = new Map((accessRoles.data ?? []).map((r) => [r.id, r.name]));
    const assignByUser = new Map((accessAssign.data ?? []).map((a) => [a.user_id, a.role_id]));
    const leadCounts = new Map<string, number>();
    for (const l of leads.data ?? []) {
      if (l.assigned_to) leadCounts.set(l.assigned_to, (leadCounts.get(l.assigned_to) ?? 0) + 1);
    }
    const profileById = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const employees: OrgEmployee[] = (members.data ?? [])
      .filter((m) => employeeIds.has(m.user_id))
      .map((m) => {
        const p = profileById.get(m.user_id);
        const roleId = assignByUser.get(m.user_id) ?? null;
        return {
          user_id: m.user_id,
          full_name: p?.full_name ?? "",
          email: p?.email ?? "",
          phone: p?.phone ?? "",
          account_status: p?.account_status ?? "pending",
          access_role_id: roleId,
          access_role_name: roleId ? (roleName.get(roleId) ?? null) : null,
          lead_count: leadCounts.get(m.user_id) ?? 0,
          created_at: m.created_at,
        };
      });
    const audit: OrgEmployeeAuditRow[] = (auditRows.data ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      employee_id: a.employee_id,
      employee_name: a.employee_id ? (profileById.get(a.employee_id)?.full_name ?? null) : null,
      created_at: a.created_at,
    }));
    return { employees, audit, limit: limitRow.data?.max_employees ?? null, is_admin: true };
  });

/** Companies the signed-in user administers, for the page's company picker. */
export const myAdminCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string }[]> => {
    const allowed = await adminCompanies(context);
    if (allowed.length === 0) return [];
    const companies = await context.supabase.from("companies").select("id,name").in("id", allowed).eq("is_active", true);
    if (companies.error) throw new Error("Your organizations could not be loaded");
    return companies.data ?? [];
  });

export const listAccessRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string; description: string; permissions: string[] }[]> => {
    const result = await context.supabase.from("access_roles").select("id,name,description,permissions").order("name");
    if (result.error) throw new Error("Roles could not be loaded");
    return result.data ?? [];
  });

export const createOrgEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_id: z.string().uuid(),
    full_name: z.string().trim().min(1, "Employee name is required").max(120),
    email: z.string().trim().email("Enter a valid email address").max(255),
    phone: z.string().trim().max(40).optional().default(""),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    access_role_id: z.string().uuid().nullish(),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    const allowed = await adminCompanies(context);
    if (!allowed.includes(data.company_id)) throw new Error("Customer Admin authorization required");
    const limit = await context.supabase.rpc("org_limit_available", { _company: data.company_id, _limit: "employees" });
    if (limit.error) throw new Error("Employee limit could not be checked");
    if (limit.data !== true) throw new Error("Employee limit reached for your organization. Contact your Master Admin to raise it.");
    const existing = await context.supabase.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing.error) throw new Error("Employee eligibility could not be checked");
    if (existing.data) throw new Error("An account with this email already exists");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone },
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Employee account could not be created");
    const userId = created.data.user.id;
    const attach = await context.supabase.rpc("org_employee_action", {
      _action: "attach",
      _payload: { company_id: data.company_id, user_id: userId },
    });
    if (attach.error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      if (attach.error.message.includes("Employee limit reached")) {
        throw new Error("Employee limit reached for your organization. Contact your Master Admin to raise it.");
      }
      throw new Error("Employee could not be added; the account was rolled back. Please retry.");
    }
    if (data.phone) {
      await context.supabase.rpc("org_employee_action", {
        _action: "update",
        _payload: { company_id: data.company_id, user_id: userId, phone: data.phone },
      });
    }
    if (data.access_role_id) {
      await context.supabase.rpc("org_employee_action", {
        _action: "assign_role",
        _payload: { company_id: data.company_id, user_id: userId, access_role: data.access_role_id },
      });
    }
    return { user_id: userId };
  });

export const orgEmployeeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_id: z.string().uuid(),
    user_id: z.string().uuid(),
    action: z.enum(["update", "set_status", "remove", "assign_role"]),
    full_name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    status: z.enum(["active", "blocked"]).optional(),
    access_role: z.string().uuid().nullish(),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    const allowed = await adminCompanies(context);
    if (!allowed.includes(data.company_id)) throw new Error("Customer Admin authorization required");
    const payload: Record<string, unknown> = { company_id: data.company_id, user_id: data.user_id };
    if (data.action === "update") Object.assign(payload, { full_name: data.full_name, phone: data.phone ?? "" });
    if (data.action === "set_status") payload["status"] = data.status;
    if (data.action === "assign_role") payload["access_role"] = data.access_role ?? null;
    const result = await context.supabase.rpc("org_employee_action", { _action: data.action, _payload: payload });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
