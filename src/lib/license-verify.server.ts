import { credentialPattern, hashInstallationCredential, installationIdPattern } from "./license-crypto";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Master-side verification. Authenticates the installation by its own credential
 * (Authorization: Bearer) and returns only identity, status, expiry and server time.
 * It can never change a license.
 */
export async function handleLicenseVerify(request: Request) {
  let installationId = "";
  try {
    const body = (await request.json()) as { installation_id?: unknown };
    installationId = typeof body.installation_id === "string" ? body.installation_id.trim() : "";
  } catch {
    return json({ ok: false, code: "BAD_REQUEST" }, 400);
  }
  const auth = request.headers.get("authorization") ?? "";
  const credential = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const formatOk = installationIdPattern.test(installationId) && credentialPattern.test(credential);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Malformed input still goes through the database so failures are recorded and rate limited.
  const { data, error } = await supabaseAdmin.rpc("crm_license_verify", {
    _installation: installationId.slice(0, 80),
    _hash: formatOk ? await hashInstallationCredential(credential) : "",
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("license verify failed", error?.message);
    return json({ ok: false, code: "UNAVAILABLE" }, 503);
  }
  const result = data as Record<string, unknown>;
  if (result["code"] === "RATE_LIMITED") return json(result, 429);
  if (result["ok"] !== true) return json({ ok: false, code: "INVALID_CREDENTIALS" }, 401);
  return json(result, 200);
}
