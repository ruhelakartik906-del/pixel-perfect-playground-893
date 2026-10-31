// Server-only helpers for the organization-level Meta WhatsApp Business Cloud API connection.
// Never import from browser code. Tokens are encrypted with AES-GCM before storage and
// are never returned to callers or written to logs.

export const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type MetaConfig = { appId: string; appSecret: string; configId: string; verifyToken: string };

/** Reads Meta app settings; null fields mean "Setup required". Call only inside handlers. */
export function readMetaConfig(): { [K in keyof MetaConfig]: string | undefined } {
  return {
    appId: process.env["META_APP_ID"] || undefined,
    appSecret: process.env["META_APP_SECRET"] || undefined,
    configId: process.env["META_EMBEDDED_SIGNUP_CONFIG_ID"] || undefined,
    verifyToken: process.env["META_WEBHOOK_VERIFY_TOKEN"] || undefined,
  };
}

async function aesKey(): Promise<CryptoKey> {
  const secret = process.env["WHATSAPP_TOKEN_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Token encryption is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptToken(stored: string): Promise<string> {
  const [v, iv, ct] = stored.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Stored token format is invalid");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(ct));
  return new TextDecoder().decode(plain);
}

export type GraphResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: number; message: string };

/** Calls the Graph API with a bearer token. Error messages are Meta's, never include the token. */
export async function graph<T>(path: string, token: string, init?: { method?: string; body?: unknown; query?: Record<string, string> }): Promise<GraphResult<T>> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) url.searchParams.set(k, v);
  const req: RequestInit = { method: init?.method ?? "GET", headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) } };
  if (init?.body) req.body = JSON.stringify(init.body);
  const res = await fetch(url, req);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  if (!res.ok || json?.error) {
    return { ok: false, status: res.status, code: json?.error?.code, message: String(json?.error?.message ?? `Meta request failed (${res.status})`).slice(0, 300) };
  }
  return { ok: true, data: json as T };
}

/** Exchanges the Embedded Signup authorization code for a business integration token. */
export async function exchangeCode(cfg: MetaConfig, code: string): Promise<GraphResult<{ access_token: string; expires_in?: number }>> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("code", code);
  const res = await fetch(url);
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    return { ok: false, status: res.status, code: json?.error?.code, message: String(json?.error?.message ?? "Authorization code exchange failed").slice(0, 300) };
  }
  return { ok: true, data: { access_token: json.access_token, expires_in: json.expires_in } };
}

/** Inspects a token with the app token: validity, scopes, expiry and granted WABA IDs. */
export async function debugToken(cfg: MetaConfig, token: string) {
  const r = await graph<{ data: { is_valid: boolean; scopes?: string[]; expires_at?: number; granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(
    "/debug_token", `${cfg.appId}|${cfg.appSecret}`, { query: { input_token: token } },
  );
  if (!r.ok) return r;
  return { ok: true as const, data: r.data.data };
}

/** Constant-time check of Meta's X-Hub-Signature-256 header over the raw body. */
export async function validMetaSignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7).toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/** Connection is "connected" only when every Meta step was verified. */
export function connectionStatus(s: { token_ok: boolean; number_registered: boolean; webhook_subscribed: boolean }) {
  return s.token_ok && s.number_registered && s.webhook_subscribed ? "connected" : "error";
}
