import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// All authorization lives in the support_* database functions (active Super Admin, own live
// session, organization-bound, mode-checked, audited). These wrappers only validate input.
const uuid = z.string().uuid();

export const loadSupportWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("support_workspace_crm", { _session: data.session_id });
    if (r.error) throw new Error(r.error.message);
    const out = r.data as { error?: string; data?: import("@/lib/user-crm.functions").UserCrmData & { session: SupportSessionRow; features: import("./org-features").OrgFeatureMap; companyName: string } };
    if (out.error || !out.data) throw new Error(out.error ?? "Support workspace unavailable");
    return { crm: out.data as import("@/lib/user-crm.functions").UserCrmData, session: out.data.session, features: out.data.features, companyName: out.data.companyName };
  });

export const supportSaveLeadDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid, lead_id: uuid, updated_at: z.string().datetime({ offset: true }), details: z.object({ customer_name: z.string().trim().min(1).max(120), phone: z.string().max(40), email: z.string().max(255), business_name: z.string().max(200), business_category: z.string().max(200), region: z.string().max(200), requirements: z.string().max(5000), interest_level: z.string().max(100) }).strict() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("support_workspace_lead_action", { _session: data.session_id, _lead: data.lead_id, _updated_at: data.updated_at, _details: data.details });
    if (r.error) throw new Error(r.error.message);
    const out = r.data as { error?: string; ok?: boolean };
    if (out.error || out.ok !== true) throw new Error(out.error ?? "Lead update not confirmed");
    return { ok: true };
  });

export const startSupportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ company_id: uuid, mode: z.enum(["view", "support"]), reason: z.string().trim().min(5).max(500), minutes: z.number().int().min(5).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("support_session_start", { _company: data.company_id, _mode: data.mode, _reason: data.reason, _minutes: data.minutes });
    if (r.error) throw new Error(r.error.message);
    return { id: r.data as string };
  });

export const endSupportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid, reason: z.string().max(500).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("support_session_end", { _session: data.session_id, _reason: data.reason });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export type SupportResource = "overview" | "leads" | "employees";

export const readSupportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid, resource: z.enum(["overview", "leads", "employees"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("support_read", { _session: data.session_id, _resource: data.resource });
    if (r.error) throw new Error(r.error.message);
    const out = r.data as { data?: unknown; error?: string };
    if (out.error) throw new Error(out.error);
    return out.data as import("@/integrations/supabase/types").Json;
  });

export const supportUpdateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid, lead_id: uuid, status: z.string().trim().max(60).optional(), requirements: z.string().max(5000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("support_write", { _session: data.session_id, _action: "lead.update", _payload: { lead_id: data.lead_id, status: data.status, requirements: data.requirements } });
    if (r.error) throw new Error(r.error.message);
    const out = r.data as { ok?: boolean; error?: string };
    if (out.error) throw new Error(out.error);
    return { ok: true };
  });

export type SupportSessionRow = { id: string; company_id: string; master_user_id: string; mode: string; reason: string; started_at: string; expires_at: string; ended_at: string | null; end_reason: string | null; revoked: boolean };
export type SupportAuditRow = { id: string; session_id: string; actor_id: string; action: string; target: string | null; detail: import("@/integrations/supabase/types").Json; created_at: string };

// Readable by active Super Admins (all) and Customer Admins (own organization) via RLS.
export const listSupportSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ company_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const [sessions, audit] = await Promise.all([
      context.supabase.from("org_support_sessions").select("id,company_id,master_user_id,mode,reason,started_at,expires_at,ended_at,end_reason,revoked").eq("company_id", data.company_id).order("started_at", { ascending: false }).limit(20),
      context.supabase.from("org_support_audit").select("id,session_id,actor_id,action,target,detail,created_at").eq("company_id", data.company_id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (sessions.error || audit.error) throw new Error("Support access history could not be loaded");
    return { sessions: (sessions.data ?? []) as SupportSessionRow[], audit: (audit.data ?? []) as SupportAuditRow[] };
  });
