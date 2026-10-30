import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { myOrgFeaturesQuery } from '@/lib/org-features.functions';
import { FEATURE_LABELS, featureEnabled, type FeatureKey } from '@/lib/org-features';

/**
 * Blocks a workspace page when the organization feature is disabled by Master Admin.
 * Server functions enforce the same check; this is the user-facing gate.
 */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { data, isPending } = useQuery(myOrgFeaturesQuery);
  if (isPending) {
    return <div className="grid place-items-center py-24 text-sm text-muted-foreground">Checking workspace permissions…</div>;
  }
  if (data && !featureEnabled(data.features, feature)) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-admin-blue/10 text-admin-blue">
          <Lock className="size-6" />
        </div>
        <h3 className="text-lg font-bold">{FEATURE_LABELS[feature]} is not enabled</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This module is not included in your organization&apos;s current plan. Contact your administrator to enable it or upgrade the plan.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
