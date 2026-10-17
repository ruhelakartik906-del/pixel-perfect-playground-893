import { createFileRoute } from "@tanstack/react-router";
import { adRoutingQuery } from "@/components/admin/AdRouting";
import { RoutingLeads } from "@/components/admin/RoutingLeads";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/routing/lead-assignment-history")({
  head: () => adminHead("Lead Assignment History", "Review and export immutable automatic and manual lead assignment records."),
  loader: ({ context }) => context.queryClient.ensureQueryData(adRoutingQuery),
  component: HistoryPage,
});
function HistoryPage() { return <RoutingLeads history />; }