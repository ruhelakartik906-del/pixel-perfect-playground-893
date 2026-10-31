import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nonceDigest } from './integration-marketplace';

// Organization-level WhatsApp Business connection. Authorization is always checked through
// the caller's own RLS-scoped client (org_customer_admin / routing_admin) before any
// privileged write. Access tokens never leave the server.

type Context = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

export type WaConnection = {
  id: string;
  company_id: string;
  company_name?: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  business_name: string | null;
  quality_rating: string | null;
  coexistence: boolean;
  status: string;
  token_ok: boolean;
  number_registered: boolean;
  webhook_subscribed: boolean;
  scopes: string[];
  token_expires_at: string | null;
  last_health_at: string | null;
  last_error: string | null;
  connected_at: string | null;
};
export type WaAudit = { id: string; action: string; detail: { [k: string]: string | number | boolean | null }; created_at: string; company_id: string };

const COLS = "id,company_id,waba_id,phone_number_id,display_phone_number,verified_name,business_name,quality_rating,coexistence,status,token_ok,number_registered,webhook_subscribed,scopes,token_expires_at,last_health_at,last_error,connected_at";
const ACTIVE = ["pending", "connected", "error", "token_expired"];

async function assertCustomerAdmin(context: Context, companyId: string) {
  const r = await context.supabase.rpc("org_customer_admin", { _user: context.userId, _company: companyId });
  if (r.error || r.data !== true) throw new Error("Only this organization's Customer Admin can manage WhatsApp");
}
async function assertMaster(context: Context) {
  const r = await context.supabase.rpc("routing_admin");
  if (r.error || r.data !== true) throw new Error("Active Super Admin authorization required");
}
async function assertFeature(context: Context, companyId: string) {
  const policy = await context.supabase.rpc('integration_provider_allowed', { _company: companyId, _provider: 'whatsapp', _action: 'manage' });
  if (policy.error || policy.data !== true) throw new Error('WhatsApp is unavailable under the platform or subscription policy');
  const r = await context.supabase.rpc("org_feature_allowed", { _company: companyId, _feature: "whatsapp" });
  if (r.error) throw new Error("Plan permissions could not be verified");
  if (r.data !== true) throw new Error("WhatsApp is not included in this organization's plan");
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
async function audit(companyId: string, connectionId: string | null, actor: string, action: string, detail: Record<string, unknown> = {}) {
  const db = await admin();
  const r = await db.from("org_whatsapp_audit").insert({ company_id: companyId, connection_id: connectionId, actor, action, detail: detail as never });
  if (r.error) throw new Error("Audit log could not be written");
}

/** Public, non-secret Meta settings needed by the browser Embedded Signup popup. */
export const whatsappSetupInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readMetaConfig } = await import("@/lib/whatsapp-meta.server");
    const c = readMetaConfig();
    const missing = (["META_APP_ID", "META_APP_SECRET", "META_EMBEDDED_SIGNUP_CONFIG_ID", "META_WEBHOOK_VERIFY_TOKEN"] as const)
      .filter((_, i) => ![c.appId, c.appSecret, c.configId, c.verifyToken][i]);
    if (!process.env["WHATSAPP_TOKEN_ENCRYPTION_KEY"]) missing.push("WHATSAPP_TOKEN_ENCRYPTION_KEY" as never);
    return { ready: missing.length === 0, missing: missing as string[], appId: c.appId ?? null, configId: c.configId ?? null };
  });

/** Connections for the caller's organizations. Members see status; only admins see audit. */
export const myOrgWhatsApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ company_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }): Promise<{ connections: WaConnection[]; audit: WaAudit[]; is_admin: boolean; limit: number | null }> => {
    const db = context.supabase;
    const adminCheck = await db.rpc("org_customer_admin", { _user: context.userId, _company: data.company_id });
    if (adminCheck.error) throw new Error("Access could not be verified");
    const [conns, aud, lim] = await Promise.all([
      db.from("org_whatsapp_connections").select(COLS).eq("company_id", data.company_id).in("status", ACTIVE).order("created_at"),
      adminCheck.data ? db.from("org_whatsapp_audit").select("id,action,detail,created_at,company_id").eq("company_id", data.company_id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
      db.from("org_usage_limits").select("max_whatsapp_numbers").eq("company_id", data.company_id).maybeSingle(),
    ]);
    if (conns.error || aud.error || lim.error) throw new Error("WhatsApp connection could not be loaded");
    return { connections: (conns.data ?? []) as WaConnection[], audit: (aud.data ?? []) as WaAudit[], is_admin: adminCheck.data === true, limit: lim.data?.max_whatsapp_numbers ?? null };
  });

const signupInput = z.object({
  company_id: z.string().uuid(),
  code: z.string().min(10).max(2048),
  nonce: z.string().uuid(),
  waba_id: z.string().regex(/^\d{5,25}$/),
  phone_number_id: z.string().regex(/^\d{5,25}$/),
  coexistence: z.boolean(),
  pin: z.string().regex(/^\d{6}$/).optional(),
}).strict();

export const beginWhatsAppSignup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ company_id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ context, data }) => {
    await assertCustomerAdmin(context, data.company_id);
    await assertFeature(context, data.company_id);
    const nonce = crypto.randomUUID();
    const db = await admin();
    const saved = await db.from('integration_oauth_attempts').insert({ user_id: context.userId, company_id: data.company_id, provider: 'whatsapp', nonce_hash: await nonceDigest(nonce) });
    if (saved.error) throw new Error('Signup attempt could not be started');
    return { nonce };
  });

/** Completes Embedded Signup: exchange code, verify token/WABA grant, register number, subscribe webhooks. */
export const completeWhatsAppSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => signupInput.parse(i))
  .handler(async ({ context, data }): Promise<WaConnection> => {
    await assertCustomerAdmin(context, data.company_id);
    await assertFeature(context, data.company_id);
    if (!data.coexistence && !data.pin) throw new Error("Enter a 6-digit two-step verification PIN to register the number");
    const meta = await import("@/lib/whatsapp-meta.server");
    const cfg = meta.readMetaConfig();
    if (!cfg.appId || !cfg.appSecret || !cfg.configId || !cfg.verifyToken) throw new Error("WhatsApp setup is not configured yet");
    const full = cfg as import("@/lib/whatsapp-meta.server").MetaConfig;
    const db = await admin();

    const attempt = await db.rpc('integration_consume_attempt', { _user: context.userId, _company: data.company_id, _provider: 'whatsapp', _hash: await nonceDigest(data.nonce) });
    if (attempt.error || attempt.data !== true) throw new Error('Signup attempt expired or was already used; start again');

    const existing = await db.from("org_whatsapp_connections").select("id,company_id").eq("phone_number_id", data.phone_number_id).in("status", ACTIVE);
    if (existing.error) throw new Error("Connection could not be checked");
    const other = (existing.data ?? []).find((c) => c.company_id !== data.company_id);
    if (other) throw new Error("This WhatsApp number is already connected to another organization");
    const same = (existing.data ?? []).find((c) => c.company_id === data.company_id);

    if (!same) {
      const [count, lim] = await Promise.all([
        db.from("org_whatsapp_connections").select("id", { count: "exact", head: true }).eq("company_id", data.company_id).in("status", ACTIVE),
        db.from("org_usage_limits").select("max_whatsapp_numbers").eq("company_id", data.company_id).maybeSingle(),
      ]);
      if (count.error || lim.error) throw new Error("Plan limits could not be verified");
      const max = lim.data?.max_whatsapp_numbers;
      if (max != null && (count.count ?? 0) >= max) throw new Error(`Your plan allows ${max} connected WhatsApp number(s)`);
    }

    const ex = await meta.exchangeCode(full, data.code);
    if (!ex.ok) { await audit(data.company_id, same?.id ?? null, context.userId, "connect_failed", { step: "code_exchange", error: ex.message }); throw new Error(`Meta authorization failed: ${ex.message}`); }
    const token = ex.data.access_token;

    const dbg = await meta.debugToken(full, token);
    if (!dbg.ok || !dbg.data.is_valid) throw new Error("Meta returned an invalid token");
    const granted = (dbg.data.granular_scopes ?? []).flatMap((g) => g.target_ids ?? []);
    if (granted.length && !granted.includes(data.waba_id)) throw new Error("This WhatsApp Business Account was not granted to the app");

    const [phone, waba] = await Promise.all([
      meta.graph<{ display_phone_number?: string; verified_name?: string; quality_rating?: string }>(`/${data.phone_number_id}`, token, { query: { fields: "display_phone_number,verified_name,quality_rating" } }),
      meta.graph<{ name?: string }>(`/${data.waba_id}`, token, { query: { fields: "name" } }),
    ]);
    if (!phone.ok) throw new Error(`Phone number could not be read: ${phone.message}`);

    const ownedNumbers = await meta.graph<{ data: { id: string; is_on_biz_app?: boolean }[] }>(`/${data.waba_id}/phone_numbers`, token, { query: { fields: 'id,is_on_biz_app', limit: '100' } });
    const ownedPhone = ownedNumbers.ok ? ownedNumbers.data.data.find(p => p.id === data.phone_number_id) : undefined;
    if (!ownedPhone) throw new Error('The selected number does not belong to the authorized WhatsApp account');
    if (data.coexistence && ownedPhone.is_on_biz_app !== true) throw new Error('Meta has not confirmed Business App coexistence for this number');
    let registered = data.coexistence && ownedPhone.is_on_biz_app === true;
    let regError: string | null = null;
    if (!data.coexistence) {
      const reg = await meta.graph(`/${data.phone_number_id}/register`, token, { method: "POST", body: { messaging_product: "whatsapp", pin: data.pin } });
      registered = reg.ok; if (!reg.ok) regError = `Number registration: ${reg.message}`;
    }
    const sub = await meta.graph(`/${data.waba_id}/subscribed_apps`, token, { method: "POST" });
    const subError = sub.ok ? null : `Webhook subscription: ${sub.message}`;

    const flags = { token_ok: true, number_registered: registered, webhook_subscribed: sub.ok };
    const row = {
      company_id: data.company_id, waba_id: data.waba_id, phone_number_id: data.phone_number_id,
      display_phone_number: phone.data.display_phone_number ?? null, verified_name: phone.data.verified_name ?? null,
      quality_rating: phone.data.quality_rating ?? null, business_name: waba.ok ? waba.data.name ?? null : null,
      coexistence: data.coexistence, ...flags, status: meta.connectionStatus(flags),
      scopes: dbg.data.scopes ?? [], token_expires_at: dbg.data.expires_at ? new Date(dbg.data.expires_at * 1000).toISOString() : null,
      last_health_at: new Date().toISOString(), last_error: [regError, subError].filter(Boolean).join("; ") || null,
      connected_by: context.userId, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const saved = same
      ? await db.from("org_whatsapp_connections").update(row).eq("id", same.id).select(COLS).single()
      : await db.from("org_whatsapp_connections").insert(row).select(COLS).single();
    if (saved.error || !saved.data) throw new Error("Connection could not be saved");
    const secret = await db.from("org_whatsapp_secrets").upsert({ connection_id: saved.data.id, token_ciphertext: await meta.encryptToken(token), updated_at: new Date().toISOString() });
    if (secret.error) throw new Error("Token could not be stored securely");
    await audit(data.company_id, saved.data.id, context.userId, same ? "reconnected" : "connected", { status: row.status, waba_id: data.waba_id, phone: row.display_phone_number, error: row.last_error });
    return saved.data as WaConnection;
  });

/** Re-checks token validity, number and webhook subscription with Meta. */
export const checkWhatsAppHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ connection_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }): Promise<WaConnection> => {
    const db = await admin();
    const conn = await db.from("org_whatsapp_connections").select(COLS).eq("id", data.connection_id).in("status", ACTIVE).maybeSingle();
    if (conn.error || !conn.data) throw new Error("Connection not found");
    const isMaster = (await context.supabase.rpc("routing_admin")).data === true;
    if (!isMaster) await assertCustomerAdmin(context, conn.data.company_id);
    const meta = await import("@/lib/whatsapp-meta.server");
    const sec = await db.from("org_whatsapp_secrets").select("token_ciphertext").eq("connection_id", data.connection_id).maybeSingle();
    if (sec.error) throw new Error("Connection could not be checked");
    const now = new Date().toISOString();
    let update: Record<string, unknown>;
    if (!sec.data) {
      update = { status: "token_expired", token_ok: false, last_error: "No stored token — reconnect required", last_health_at: now };
    } else {
      const token = await meta.decryptToken(sec.data.token_ciphertext);
      const [phone, subs] = await Promise.all([
        meta.graph<{ display_phone_number?: string; quality_rating?: string }>(`/${conn.data.phone_number_id}`, token, { query: { fields: "display_phone_number,quality_rating" } }),
        meta.graph<{ data: unknown[] }>(`/${conn.data.waba_id}/subscribed_apps`, token),
      ]);
      if (!phone.ok && phone.code === 190) {
        update = { status: "token_expired", token_ok: false, last_error: "Meta token expired or was revoked — reconnect required", last_health_at: now };
      } else {
        const flags = { token_ok: phone.ok, number_registered: conn.data.number_registered, webhook_subscribed: subs.ok && (subs.data.data?.length ?? 0) > 0 };
        update = {
          ...flags, status: meta.connectionStatus(flags), last_health_at: now,
          quality_rating: phone.ok ? phone.data.quality_rating ?? conn.data.quality_rating : conn.data.quality_rating,
          last_error: [phone.ok ? null : phone.message, flags.webhook_subscribed ? null : "Webhook subscription missing"].filter(Boolean).join("; ") || null,
        };
      }
    }
    const saved = await db.from("org_whatsapp_connections").update({ ...update, updated_at: now }).eq("id", data.connection_id).select(COLS).single();
    if (saved.error) throw new Error("Health result could not be saved");
    await audit(conn.data.company_id, data.connection_id, context.userId, isMaster ? "master_health_check" : "health_check", { status: String(update["status"]), error: (update["last_error"] as string | null) ?? null });
    return saved.data as WaConnection;
  });

async function teardown(context: Context, connectionId: string, mode: "disconnected" | "revoked", reason?: string) {
  const db = await admin();
  const conn = await db.from("org_whatsapp_connections").select("id,company_id,waba_id").eq("id", connectionId).in("status", ACTIVE).maybeSingle();
  if (conn.error || !conn.data) throw new Error("Connection not found");
  if (mode === "revoked") await assertMaster(context); else await assertCustomerAdmin(context, conn.data.company_id);
  const meta = await import("@/lib/whatsapp-meta.server");
  const sec = await db.from("org_whatsapp_secrets").select("token_ciphertext").eq("connection_id", connectionId).maybeSingle();
  let unsubscribed = false;
  if (sec.data) {
    try {
      const r = await meta.graph(`/${conn.data.waba_id}/subscribed_apps`, await meta.decryptToken(sec.data.token_ciphertext), { method: "DELETE" });
      unsubscribed = r.ok;
    } catch { unsubscribed = false; }
  }
  const del = await db.from("org_whatsapp_secrets").delete().eq("connection_id", connectionId);
  if (del.error) throw new Error("Stored token could not be removed");
  const upd = await db.from("org_whatsapp_connections").update({ status: mode, token_ok: false, webhook_subscribed: false, updated_at: new Date().toISOString() }).eq("id", connectionId);
  if (upd.error) throw new Error("Connection could not be updated");
  await audit(conn.data.company_id, connectionId, context.userId, mode === "revoked" ? "master_revoked" : "disconnected", { meta_unsubscribed: unsubscribed, reason: reason ?? null });
}

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ connection_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }) => { await teardown(context, data.connection_id, "disconnected"); return { ok: true }; });

/** Master Admin: every organization's connection status. Tokens are never selected. */
export const masterWhatsAppConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ connections: WaConnection[]; audit: (WaAudit & { company_name?: string })[] }> => {
    await assertMaster(context);
    const db = context.supabase;
    const [conns, companies, aud] = await Promise.all([
      db.from("org_whatsapp_connections").select(COLS).order("updated_at", { ascending: false }),
      db.from("companies").select("id,name"),
      db.from("org_whatsapp_audit").select("id,action,detail,created_at,company_id").order("created_at", { ascending: false }).limit(50),
    ]);
    if (conns.error || companies.error || aud.error) throw new Error("WhatsApp connections could not be loaded");
    const names = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
    return {
      connections: (conns.data ?? []).map((c) => ({ ...(c as WaConnection), company_name: names.get(c.company_id) ?? "Unknown" })),
      audit: (aud.data ?? []).map((a) => ({ ...(a as WaAudit), company_name: names.get(a.company_id) ?? "Unknown" })),
    };
  });

export const masterRevokeWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ connection_id: z.string().uuid(), reason: z.string().trim().min(3).max(300) }).strict().parse(i))
  .handler(async ({ context, data }) => { await teardown(context, data.connection_id, "revoked", data.reason); return { ok: true }; });

/** Active organizations the caller belongs to, with whether they administer each. */
export const myWhatsAppOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string; is_admin: boolean }[]> => {
    const m = await context.supabase.from("company_members").select("company_id").eq("user_id", context.userId);
    if (m.error) throw new Error("Your organizations could not be loaded");
    const ids = (m.data ?? []).map((r) => r.company_id);
    if (!ids.length) return [];
    const c = await context.supabase.from("companies").select("id,name").in("id", ids).eq("is_active", true);
    if (c.error) throw new Error("Your organizations could not be loaded");
    const checks = await Promise.all((c.data ?? []).map((co) => context.supabase.rpc("org_customer_admin", { _user: context.userId, _company: co.id })));
    return (c.data ?? []).map((co, i) => ({ id: co.id, name: co.name, is_admin: checks[i]?.data === true }));
  });
