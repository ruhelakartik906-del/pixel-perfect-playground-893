/**
 * Customer-installation license enforcement. Pure logic, no secrets; the server
 * wrapper supplies configuration from process.env.
 *
 * Mode: LICENSE_MODE=customer turns enforcement on. Absent/"master" = Master CRM (never blocked).
 * Cache: an "active" answer is trusted for at most LICENSE_CACHE_MS (60s). Any failure,
 * timeout or non-active answer blocks immediately — there is no offline grace period.
 */
export const LICENSE_CACHE_MS = 60_000;

export type LicenseConfig = {
  mode: "master" | "customer";
  installationId?: string;
  credential?: string;
  masterUrl?: string;
};
export type LicenseDecision = { allowed: boolean; status: string; checkedAt: number; validUntil?: string | null };

export function readLicenseConfig(env: Record<string, string | undefined>): LicenseConfig {
  if ((env["LICENSE_MODE"] ?? "master").toLowerCase() !== "customer") return { mode: "master" };
  return {
    mode: "customer",
    installationId: env["LICENSE_INSTALLATION_ID"],
    credential: env["LICENSE_CREDENTIAL"],
    masterUrl: env["LICENSE_MASTER_URL"],
  };
}

export async function verifyWithMaster(
  config: LicenseConfig,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<LicenseDecision> {
  if (config.mode === "master") return { allowed: true, status: "master", checkedAt: now };
  if (!config.installationId || !config.credential || !config.masterUrl?.startsWith("https://"))
    return { allowed: false, status: "not_configured", checkedAt: now };
  try {
    const res = await fetcher(config.masterUrl.replace(/\/+$/, "") + "/api/public/license/verify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.credential}` },
      body: JSON.stringify({ installation_id: config.installationId }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body || body["ok"] !== true)
      return { allowed: false, status: res.status === 401 ? "invalid_credentials" : "unverifiable", checkedAt: now };
    // Defence in depth: the answer must be for this installation and unexpired by the Master's clock.
    const validUntil = typeof body["valid_until"] === "string" ? body["valid_until"] : null;
    const serverTime = typeof body["server_time"] === "string" ? Date.parse(body["server_time"]) : NaN;
    const allowed =
      body["installation_id"] === config.installationId &&
      body["status"] === "active" &&
      body["access_allowed"] === true &&
      !!validUntil &&
      Number.isFinite(serverTime) &&
      Date.parse(validUntil) > serverTime;
    return { allowed, status: allowed ? "active" : String(body["status"] ?? "unverifiable"), checkedAt: now, validUntil };
  } catch {
    return { allowed: false, status: "unverifiable", checkedAt: now };
  }
}

export function cachedDecisionUsable(d: LicenseDecision | null, now = Date.now()) {
  return !!d && d.allowed && now - d.checkedAt < LICENSE_CACHE_MS &&
    (!d.validUntil || Date.parse(d.validUntil) > now);
}
