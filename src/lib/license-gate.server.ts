import {
  LICENSE_CACHE_MS,
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

// Mirrors the server-verified decision into the local database so restrictive RLS
// policies (public.license_active()) also block direct browser Data API access.
// The row is service_role-only; browsers can neither read nor write it. Writes are
// throttled to one per 30s while allowed, but a blocked decision is persisted
// immediately so a suspension stops direct access with the next server request.
let lastPersist = 0;
async function persistLicenseState(mode: "master" | "customer", allowed: boolean) {
  const nowMs = Date.now();
  const blocked = mode === "customer" && !allowed;
  if (!blocked && nowMs - lastPersist < 30_000) return;
  lastPersist = nowMs;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("license_state").upsert({
      id: true,
      mode,
      verified_until:
        mode === "master" ? null : allowed ? new Date(nowMs + LICENSE_CACHE_MS).toISOString() : new Date(0).toISOString(),
      updated_at: new Date(nowMs).toISOString(),
    });
  } catch (error) {
    console.error("license state persist failed", error);
  }
}

// Every server function is blocked when inactive; mutations (POST) always re-verify.
// Sign-in/out use the auth service directly and the /license-status page uses a server route.
export async function enforceLicenseForServerFn(request: Request) {
  const config = readLicenseConfig(process.env);
  if (config.mode === "master") {
    await persistLicenseState("master", true);
    return null;
  }
  const decision = await currentLicense(request.method !== "GET");
  await persistLicenseState("customer", decision.allowed);
  if (decision.allowed) return null;
  return new Response(
    JSON.stringify({ error: "LICENSE_INACTIVE", status: decision.status }),
    { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
