import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { validateAllocations, validateVideoSource } from "@/lib/routing";

export const loadAdRouting = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await context.supabase.rpc("routing_admin");
  if (admin.error || !admin.data) throw new Error("Super Admin authorization required");
  const db = context.supabase as any;
  async function all(table: string, columns = "*") {
    const rows: any[] = [];
    for (let start = 0; ; start += 1000) {
      const result = await db.from(table).select(columns).order(table === "company_members" || table === "user_roles" ? "user_id" : table === "lead_routing_queue" ? "lead_id" : "id").range(start, start + 999);
      if (result.error) throw new Error("Routing records could not be loaded");
      rows.push(...result.data);
      if (result.data.length < 1000) return rows;
    }
  }
  const [rules, steps, events, queue, leads, companies, people, members, roles, employees, audits] = await Promise.all([
    all("ad_routing_rules"), all("ad_routing_steps"), all("lead_assignment_events"), all("lead_routing_queue"),
    all("leads"), all("companies", "id,name,is_active"), all("profiles", "id,full_name,email,account_status"),
    all("company_members", "user_id,company_id"), all("user_roles", "user_id,role"),
    all("hr_employees", "id,profile_id,company_id,is_active,access_status"), all("ad_routing_audit"),
  ]);
  const eligible = members.filter((m: any) => people.some((p: any) => p.id === m.user_id && p.account_status === "active")
    && companies.some((c: any) => c.id === m.company_id && c.is_active)
    && roles.some((r: any) => r.user_id === m.user_id && ["employee", "manager", "super_admin"].includes(r.role))
    && !roles.some((r: any) => r.user_id === m.user_id && r.role === "client")
    && !employees.some((e: any) => e.profile_id === m.user_id && e.company_id === m.company_id && (!e.is_active || e.access_status !== "approved")));
  const eligibleKeys = new Set(eligible.map((m: any) => `${m.company_id}:${m.user_id}`));
  const excluded = members.filter((m: any) => !eligibleKeys.has(`${m.company_id}:${m.user_id}`)).map((m: any) => {
    const person = people.find((p: any) => p.id === m.user_id);
    const company = companies.find((c: any) => c.id === m.company_id);
    const memberRoles = roles.filter((r: any) => r.user_id === m.user_id).map((r: any) => r.role);
    const hr = employees.find((e: any) => e.profile_id === m.user_id && e.company_id === m.company_id);
    const reason = !person ? "profile missing" : person.account_status !== "active" ? `account ${person.account_status}` : !company ? "company missing"
      : !company.is_active ? "company inactive" : memberRoles.includes("client") ? "client accounts cannot receive routed leads"
      : !memberRoles.some((r: string) => ["employee", "manager", "super_admin"].includes(r)) ? "no staff role"
      : hr && (!hr.is_active || hr.access_status !== "approved") ? "HR access not approved" : "not eligible";
    return { company_id: m.company_id, user_id: m.user_id, reason };
  });
  return { rules: rules.filter((r) => r.status !== "deleted"), steps, events, queue, leads, companies, people, eligible, excluded, audits };
});

const source = z.string().trim().max(255).default("");
export const saveAdRouting = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({
  id: z.string().uuid().optional(), company_id: z.string().uuid(), name: z.string().trim().min(1).max(120),
  account_id: z.string().trim().min(1).max(255), page_id: source, campaign_id: source, campaign_name: source,
  adset_id: source, ad_id: source, creative_id: source, creative_name: source, status: z.enum(["draft", "active", "paused"]),
  steps: z.array(z.object({ id: z.string().uuid().optional(), user_id: z.string().uuid(), quota: z.number().int().positive().nullable() })),
}).parse(input)).handler(async ({ context, data }) => {
  const invalid = validateAllocations(data.steps) || (data.status === "active" ? validateVideoSource(data) : null);
  if (invalid) throw new Error(invalid);
  const result = await context.supabase.rpc("routing_rule_action", { _action: "save", _payload: data });
  if (result.error) throw new Error(result.error.message);
  return result.data;
});

export const changeAdRouting = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({
  id: z.string().uuid(), action: z.enum(["duplicate", "active", "paused", "deleted", "reset"]),
}).parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("routing_rule_action", { _action: data.action, _payload: { id: data.id } });
  if (result.error) throw new Error(result.error.message);
  return result.data;
});

export const assignRoutingLeads = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(100), user_id: z.string().uuid().nullable(),
}).parse(input)).handler(async ({ context, data }) => {
  const admin = await context.supabase.rpc("routing_admin");
  if (admin.error || !admin.data) throw new Error("Super Admin authorization required");
  const results = [];
  for (const id of [...new Set(data.lead_ids)]) {
    const result = await context.supabase.rpc("route_lead", data.user_id ? { _lead: id, _manual_user: data.user_id } : { _lead: id });
    results.push({ id, result: result.data, error: result.error?.message ?? null });
  }
  return results;
});

export const createRoutingLead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({
  customer_name: z.string().trim().min(1, "Client name is required").max(200),
  country_code: z.string().regex(/^\+[1-9]\d{0,3}$/, "Enter a country code"),
  mobile: z.string().trim().regex(/^\d{6,14}$/, "Enter a valid mobile number"),
  email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  business_name: z.string().trim().max(200), business_category: z.string().trim().max(120),
  address: z.string().trim().max(2000), city: z.string().trim().max(120), state: z.string().trim().max(120),
  service: z.enum(["Meta Ads", "Google Ads", "Website", "SEO", "Social Media Marketing", "Other"]),
  notes: z.string().trim().max(2000), source: z.string().trim().min(1).max(120).default("Manual"),
  priority: z.enum(["low", "medium", "high"]),
  company_id: z.string().uuid(), assign_user: z.string().uuid().nullable(),
}).strict().refine((v) => `${v.country_code}${v.mobile}`.length <= 16, "Phone number must contain at most 15 digits").parse(input)).handler(async ({ context, data }) => {
  const admin = await context.supabase.rpc("routing_admin");
  if (admin.error || !admin.data) throw new Error("Super Admin authorization required");
  const company = await context.supabase.from("companies").select("id").eq("id", data.company_id).eq("is_active", true).single();
  if (company.error) throw new Error("Select an active company");
  const phone = `${data.country_code}${data.mobile}`;
  const duplicate = await context.supabase.from("leads").select("id").eq("company_id", data.company_id).eq("phone", phone)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(1);
  if (duplicate.error) throw new Error("Duplicate check failed");
  if (duplicate.data.length) throw new Error("A lead with this phone number was just created for this company");
  const record = { customer_name: data.customer_name, phone, email: data.email, business_name: data.business_name,
    business_category: data.business_category, requirements: data.notes, interest_level: data.priority,
    company_id: data.company_id, created_by: context.userId, status: "open", intake_source: "manual",
    region: [data.city, data.state].filter(Boolean).join(", "),
    form_answers: { "Lead Source": data.source, "Required Service": data.service, Priority: data.priority, Address: data.address, City: data.city, State: data.state } };
  const inserted = await context.supabase.from("leads").insert(record).select("id").single();
  if (inserted.error) throw new Error(inserted.error.message);
  if (!data.assign_user) return { id: inserted.data.id as string, assigned: false };
  const routed = await context.supabase.rpc("route_lead", { _lead: inserted.data.id, _manual_user: data.assign_user });
  if (routed.error) throw new Error(`Lead saved but assignment failed: ${routed.error.message}`);
  if (routed.data?.status !== "assigned") throw new Error(`Lead saved but not assigned: ${routed.data?.reason || "user is not eligible for this company"}`);
  return { id: inserted.data.id as string, assigned: true };
});

export type AdRoutingData = Awaited<ReturnType<typeof loadAdRouting>>;