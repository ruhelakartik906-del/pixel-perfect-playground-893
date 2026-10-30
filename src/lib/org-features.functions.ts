import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FEATURE_KEYS, type FeatureKey, type OrgFeatureMap } from "@/lib/org-features";

type Context = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

/**
 * Effective feature map for the signed-in user across their active company memberships.
 * A feature is enabled when at least one active subscription allows it; missing rows default
 * to enabled so legacy companies and personal workspaces keep full access.
 */
export const myOrgFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ features: OrgFeatureMap }> => {
    const db = context.supabase;
    const memberships = await db.from("company_members").select("company_id").eq("user_id", context.userId);
    if (memberships.error) throw new Error("Your workspace permissions could not be loaded");
    const companyIds = (memberships.data ?? []).map((m) => m.company_id);
    if (companyIds.length === 0) return { features: {} };
    const [subs, perms] = await Promise.all([
      db.from("org_subscriptions").select("company_id,status,expires_at").in("company_id", companyIds),
      db.from("org_feature_permissions").select("company_id,feature_key,enabled").in("company_id", companyIds),
    ]);
    if (subs.error || perms.error) throw new Error("Your workspace permissions could not be loaded");
    const activeCompanies = new Set(
      companyIds.filter((id) => {
        const sub = (subs.data ?? []).find((s) => s.company_id === id);
        if (!sub) return true; // legacy company without a subscription stays active
        if (sub.status !== "active") return false;
        if (sub.expires_at && new Date(sub.expires_at).getTime() < Date.now()) return false;
        return true;
      }),
    );
    const features: OrgFeatureMap = {};
    for (const key of FEATURE_KEYS) {
      const rows = (perms.data ?? []).filter((p) => p.feature_key === key && activeCompanies.has(p.company_id));
      // Enabled when any active company enables it; no rows at all = enabled by default.
      features[key] = rows.length === 0 ? true : rows.some((p) => p.enabled);
    }
    return { features };
  });

export const myOrgFeaturesQuery = queryOptions({
  queryKey: ["my-org-features"],
  queryFn: () => myOrgFeatures(),
  staleTime: 15_000,
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
});

/**
 * Server-side feature enforcement for protected functions. Throws when the feature is
 * disabled for every active company the user belongs to. Users without a company
 * (personal workspace) keep access, matching the database default.
 */
export async function assertOrgFeature(context: Context, feature: FeatureKey): Promise<void> {
  const db = context.supabase;
  const memberships = await db.from("company_members").select("company_id").eq("user_id", context.userId);
  if (memberships.error) throw new Error("Workspace permissions could not be verified");
  const companyIds = (memberships.data ?? []).map((m) => m.company_id);
  if (companyIds.length === 0) return;
  const checks = await Promise.all(
    companyIds.map((id) => db.rpc("org_feature_allowed", { _company: id, _feature: feature })),
  );
  if (checks.some((c) => c.error)) throw new Error("Workspace permissions could not be verified");
  if (!checks.some((c) => c.data === true)) {
    throw new Error("This module is not enabled for your organization. Contact your administrator.");
  }
}
