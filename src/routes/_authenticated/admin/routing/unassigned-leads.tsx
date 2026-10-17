import { createFileRoute } from "@tanstack/react-router";
import { adRoutingQuery } from "@/components/admin/AdRouting";
import { RoutingLeads } from "@/components/admin/RoutingLeads";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/routing/unassigned-leads")({
  head: () => adminHead("Unassigned Leads", "Review unassigned leads, retry routing and assign eligible company users."),
  loader: ({ context }) => context.queryClient.ensureQueryData(adRoutingQuery),
  component: QueuePage,
});
function QueuePage() { return <RoutingLeads />; }