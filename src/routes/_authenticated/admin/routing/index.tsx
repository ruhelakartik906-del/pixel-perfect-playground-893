import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, GitBranch, Inbox, Plus, Zap } from "lucide-react";
import { Breadcrumb, Card, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, ToolbarButton } from "@/components/admin/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/routing/")({
  head: () => ({ meta: [
    { title: "Ad Lead Routing — Routiva CRM" },
    { name: "description", content: "Configure per-ad lead distribution rules with exact quotas and overflow users." },
    { property: "og:title", content: "Ad Lead Routing — Routiva CRM" },
    { property: "og:description", content: "Configure per-ad lead distribution rules with exact quotas and overflow users." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: RoutingOverview,
});

const columns = ["Company", "Facebook Page", "Campaign Name", "Ad Name", "Primary User", "Lead Quota", "Overflow User", "Assigned Count", "Status", "Actions"];

function RoutingOverview() {
  const [q, setQ] = useState("");
  return (
    <div className="space-y-5">
      <Breadcrumb label="Routing Overview" />
      <PageHeader title="Ad Lead Routing" subtitle="Send leads from each Meta ad to the right team members with exact quotas">
        <SearchInput placeholder="Search rules..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton primary onClick={() => toast.info("The rule builder arrives in Phase 3.")}><Plus className="size-4" />Create Routing Rule</ToolbarButton>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard tone="blue" icon={Inbox} label="Incoming Leads" value={0} note="All time" />
        <KpiCard tone="green" icon={CheckCircle2} label="Auto Assigned" value={0} note="Matched a rule" />
        <KpiCard tone="purple" icon={GitBranch} label="Active Rules" value={0} note="Currently routing" />
        <KpiCard tone="orange" icon={Zap} label="Unassigned" value={0} note="Waiting for review" />
        <KpiCard tone="red" icon={AlertTriangle} label="Failed Deliveries" value={0} note="Webhook errors" />
      </div>
      <Card className="p-5">
        <h3 className="mb-4 text-xl font-bold">Routing Rules</h3>
        <DataTable columns={columns} />
        <EmptyState title="No routing rules yet" hint="Create a rule for each ad — e.g. first 5 leads to one user, everything after to another." />
      </Card>
    </div>
  );
}
