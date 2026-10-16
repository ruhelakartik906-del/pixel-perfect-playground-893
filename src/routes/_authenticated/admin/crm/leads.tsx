import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Filter, LayoutGrid, List, Plus, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, TabBar, ToolbarButton } from "@/components/admin/ui";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/crm/leads")({
  head: () => ({ meta: [
    { title: "Leads — Routiva CRM Admin" },
    { name: "description", content: "Manage every incoming lead across companies and campaigns." },
    { property: "og:title", content: "Leads — Routiva CRM Admin" },
    { property: "og:description", content: "Manage every incoming lead across companies and campaigns." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LeadsPage,
});

type Tab = "today" | "yesterday" | "week" | "month" | "all";
const tabs: { id: Tab; label: string; count?: number }[] = [
  { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday", count: 0 }, { id: "week", label: "This Week", count: 0 },
  { id: "month", label: "This Month", count: 0 }, { id: "all", label: "All", count: 0 },
];
const columns = ["No.", "☐", "Contact No", "Customer Stage", "Customer Name", "Customer Source", "Assignee", "Company", "Campaign",
  "Email", "Business Name", "Business Category", "Required Service", "Interest Level", "Lead Received", "Lead Status", "Actions"];
const pending = () => toast.info("Lead storage connects in a later phase.");

function LeadsPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(true);
  const [view, setView] = useState<"list" | "grid">("list");
  const label = tabs.find((t) => t.id === tab)!.label;

  return (
    <div className="space-y-5">
      <Breadcrumb label="All Leads (0)" />
      <PageHeader title={`${label === "All" ? "All" : label + "'s"} Leads (0)`} subtitle="Manage all leads in the system">
        <SearchInput placeholder="Search leads..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton onClick={pending}><Upload className="size-4" />Import</ToolbarButton>
        <ToolbarButton onClick={pending}><Download className="size-4" />Export</ToolbarButton>
        <label className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-[15px] font-semibold">
          <Zap className="size-4 text-admin-orange" />Quick Mode<Switch checked={quick} onCheckedChange={setQuick} />
        </label>
        <ToolbarButton primary onClick={pending}><Plus className="size-4" />Create Lead</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <TabBar tabs={tabs} value={tab} onChange={setTab} />
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-md border">
              {(["list", "grid"] as const).map((v) => {
                const I = v === "list" ? List : LayoutGrid;
                return <button key={v} aria-label={`${v} view`} onClick={() => setView(v)} className={cn("grid h-10 w-12 place-items-center", view === v ? "bg-admin-blue text-primary-foreground" : "hover:bg-muted")}><I className="size-4" /></button>;
              })}
            </div>
            <ToolbarButton primary onClick={pending}><Filter className="size-4" />Filter</ToolbarButton>
          </div>
        </div>
        <DataTable columns={columns} minWidth={2000} />
        <EmptyState />
      </Card>
    </div>
  );
}
