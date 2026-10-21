import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { validateAllocations, validateVideoSource } from "@/lib/routing";
import { manualRoutingLeadSchema } from "@/lib/manual-routing";

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
  const recipients = await context.supabase.rpc("manual_routing_recipients");
  if (recipients.error) throw new Error("Manual assignment users could not be loaded");
  return { rules: rules.filter((r) => r.status !== "deleted"), steps, events, queue, leads, companies, people, eligible, excluded, audits, manualRecipients: recipients.data };
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

export const createRoutingLead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => manualRoutingLeadSchema.parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("manual_routing_lead_create", { _payload: data });
  if (result.error) throw new Error(result.error.message);
  const saved = result.data as { id: string; assigned: boolean };
  return saved;
});

export type AdRoutingData = Awaited<ReturnType<typeof loadAdRouting>>;