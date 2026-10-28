import {
  cachedDecisionUsable,
  readLicenseConfig,
  verifyWithMaster,
  type LicenseDecision,
} from "./license-enforcement";

// Per-isolate cache of the last *active* answer only (max 60s). Never caches a block as allowed.
let last: LicenseDecision | null = null;

export async function currentLicense(fresh = false): Promise<LicenseDecision> {
  const config = readLicenseConfig(process.env);
  if (config.mode === "master") return { allowed: true, status: "master", checkedAt: Date.now() };
  if (!fresh && cachedDecisionUsable(last)) return last as LicenseDecision;
  const decision = await verifyWithMaster(config);
  last = decision.allowed ? decision : null;
  return decision;
}

// Names of server functions still reachable while a customer license is blocked.
const OPEN_FUNCTIONS = ["getLicenseStatus", "authAccess", "signOut"];

export async function enforceLicenseForServerFn(request: Request) {
  const config = readLicenseConfig(process.env);
  if (config.mode === "master") return null;
  const url = new URL(request.url);
  if (OPEN_FUNCTIONS.some((name) => url.pathname.includes(name))) return null;
  const decision = await currentLicense(request.method !== "GET");
  if (decision.allowed) return null;
  return new Response(
    JSON.stringify({ error: "LICENSE_INACTIVE", status: decision.status }),
    { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
