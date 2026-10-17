import { createFileRoute } from "@tanstack/react-router";
import { AdRoutingSetup, adRoutingQuery } from "@/components/admin/AdRouting";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/routing/ad-routing-setup")({
  head: () => adminHead("Ad Routing Setup", "Manage company-scoped Meta source mappings and sequential lead quotas."),
  loader: ({ context }) => context.queryClient.ensureQueryData(adRoutingQuery),
  component: AdRoutingSetup,
});