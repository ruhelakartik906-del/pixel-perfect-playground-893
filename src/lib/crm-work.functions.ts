import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { workSchema } from "@/lib/crm-work";

export const loadCrmWork = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await context.supabase.rpc("routing_admin");
  if (admin.error) throw new Error("Authorization could not be checked");
  const profile = await context.supabase.from("profiles").select("account_status").eq("id",context.userId).single();
  if (profile.error || profile.data.account_status !== "active") throw new Error("Active account required");
  const db = context.supabase;
  if (!admin.data) {
    const roles = await db.from("user_roles").select("role").eq("user_id",context.userId);
    if (roles.error || !roles.data?.some(r=>r.role === "employee" || r.role === "manager")) throw new Error("Employee access required");
  }
  async function all<T>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) { const result = await fetchPage(offset); if (result.error) throw new Error("CRM records could not be loaded"); const page = result.data ?? []; rows.push(...page); if (page.length < 1000) return rows; }
  }
  const [items, companies, leads, people, members, history, deals] = await Promise.all([
    all((o) => (admin.data ? db.from("crm_work_items").select("*") : db.from("crm_work_items").select("*").eq("assigned_to",context.userId)).is("deleted_at", null).order("id").range(o,o+999)),
    all((o) => db.from("companies").select("id,name,is_active").eq("is_active",true).order("id").range(o,o+999)),
    all((o) => db.from("leads").select("id,company_id,customer_name,phone,email,business_name,source_id").order("id").range(o,o+999)),
    all((o) => (admin.data ? db.from("profiles").select("id,full_name,email,account_status") : db.from("profiles").select("id,full_name,email,account_status").eq("id",context.userId)).order("id").range(o,o+999)),
    all((o) => (admin.data ? db.from("company_members").select("user_id,company_id") : db.from("company_members").select("user_id,company_id").eq("user_id",context.userId)).order("id").range(o,o+999)),
    all((o) => db.from("crm_work_history").select("*").order("id").range(o,o+999)),
    all((o) => db.from("deals").select("id,company_id,title").order("id").range(o,o+999)),
  ]);
  const eligible = (await Promise.all(members.map(async (member) => { const result = await db.rpc("routing_eligible", { _user: member.user_id, _company: member.company_id }); if (result.error) throw new Error("Employee eligibility could not be checked"); return result.data ? member : null; }))).filter((m): m is NonNullable<typeof m> => m !== null);
  const authorizedCompanies = admin.data ? companies : companies.filter(c=>eligible.some(m=>m.company_id===c.id && m.user_id===context.userId));
  return { items, companies: authorizedCompanies, leads: leads.filter(l=>authorizedCompanies.some(c=>c.id===l.company_id)), deals: deals.filter(d=>authorizedCompanies.some(c=>c.id===d.company_id)), people, eligible, history: history.filter(h=>items.some(i=>i.id===h.work_id)), isAdmin: admin.data === true, userId: context.userId };
});
export const saveCrmWork = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => workSchema.parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("crm_work_action", { _action: "save", _payload: data });
  if (result.error) throw new Error(result.error.message); return result.data;
});
export const changeCrmWork = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id:z.string().uuid(),version:z.number().int().positive(),action:z.enum(["status","delete"]),status:z.enum(["not_started","in_progress","scheduled","completed","skipped"]).optional() }).refine(v=>v.action!=="status"||!!v.status,{message:"Select a status"}).parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("crm_work_action", { _action: data.action, _payload:data }); if (result.error) throw new Error(result.error.message); return result.data;
});
export type CrmWorkData = Awaited<ReturnType<typeof loadCrmWork>>;