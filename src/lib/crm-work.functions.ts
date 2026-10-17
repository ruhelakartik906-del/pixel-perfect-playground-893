import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { workSchema } from "@/lib/crm-work";

export const loadCrmWork = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await context.supabase.rpc("routing_admin");
  if (admin.error || !admin.data) throw new Error("Active Super Admin authorization required");
  const db = context.supabase;
  async function all<T>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) { const result = await fetchPage(offset); if (result.error) throw new Error("CRM records could not be loaded"); const page = result.data ?? []; rows.push(...page); if (page.length < 1000) return rows; }
  }
  const [items, companies, leads, people, members, history] = await Promise.all([
    all((o) => db.from("crm_work_items").select("*").is("deleted_at", null).order("id").range(o,o+999)),
    all((o) => db.from("companies").select("id,name,is_active").eq("is_active",true).order("id").range(o,o+999)),
    all((o) => db.from("leads").select("id,company_id,customer_name,phone,email,business_name").order("id").range(o,o+999)),
    all((o) => db.from("profiles").select("id,full_name,email,account_status").order("id").range(o,o+999)),
    all((o) => db.from("company_members").select("user_id,company_id").order("id").range(o,o+999)),
    all((o) => db.from("crm_work_history").select("*").order("id").range(o,o+999)),
  ]);
  const eligible = (await Promise.all(members.map(async (member) => { const result = await db.rpc("routing_eligible", { _user: member.user_id, _company: member.company_id }); if (result.error) throw new Error("Employee eligibility could not be checked"); return result.data ? member : null; }))).filter((m): m is NonNullable<typeof m> => m !== null);
  return { items, companies, leads, people, eligible, history };
});
export const saveCrmWork = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => workSchema.parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("crm_work_action", { _action: "save", _payload: data });
  if (result.error) throw new Error(result.error.message); return result.data;
});
export const changeCrmWork = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id:z.string().uuid(),version:z.number().int().positive(),action:z.enum(["status","delete"]),status:z.enum(["not_started","in_progress","scheduled","completed","skipped"]).optional() }).parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("crm_work_action", { _action: data.action, _payload:data }); if (result.error) throw new Error(result.error.message); return result.data;
});
export type CrmWorkData = Awaited<ReturnType<typeof loadCrmWork>>;