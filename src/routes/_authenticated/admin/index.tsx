import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, CalendarDays, CircleDollarSign, FileText, Target, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, DataTable, EmptyState, KpiCard } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [
    { title: "Admin Dashboard — Routiva CRM" },
    { name: "description", content: "Master admin overview of customers, leads, deals and revenue." },
    { property: "og:title", content: "Admin Dashboard — Routiva CRM" },
    { property: "og:description", content: "Master admin overview of customers, leads, deals and revenue." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminDashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

function RangeToggle() {
  const [v, setV] = useState("All");
  return (
    <div className="flex overflow-hidden rounded-md border">
      {["All", "Today", "This Month"].map((o) => (
        <button key={o} onClick={() => setV(o)} className={cn("px-3 py-1.5 text-[15px]", v === o ? "bg-admin-blue/5 text-admin-blue outline outline-1 outline-admin-blue" : "hover:bg-muted")}>{o}</button>
      ))}
    </div>
  );
}

function Panel({ icon: Icon, title, columns }: { icon: typeof Target; title: string; columns: string[] }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-admin-blue text-primary-foreground"><Icon className="size-4" /></span>
          <h3 className="text-xl font-bold">{title}</h3>
          <span className="rounded-full bg-muted px-2 text-sm">0</span>
        </div>
        <RangeToggle />
      </div>
      <DataTable columns={columns} minWidth={520} />
      <EmptyState hint="Records appear here once leads start arriving." />
    </Card>
  );
}

function AdminDashboard() {
  const { adminName, adminEmail } = Route.useRouteContext();
  const { data: customers = 0 } = useQuery({
    queryKey: ["admin", "profile-count"],
    queryFn: async () => (await supabase.from("profiles").select("id", { count: "exact", head: true })).count ?? 0,
  });
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 bg-gradient-to-r from-card to-admin-bg p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full border border-admin-blue/20 bg-admin-blue/5 px-3 py-1 text-admin-blue"><CalendarDays className="size-3.5" />{today}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-admin-blue/20 bg-admin-blue/5 px-3 py-1 text-admin-blue"><UserRound className="size-3.5" />super admin</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-admin-purple/20 bg-admin-purple/5 px-3 py-1 text-admin-purple"><Building2 className="size-3.5" />Routiva CRM</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold">{greeting()}, <span className="text-admin-purple">{adminName}</span></h1>
          <p className="mt-2 text-lg text-muted-foreground">Welcome back to <b className="text-foreground">Routiva CRM</b>. Here is your company-wide workspace.</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card">
          <span className="grid size-12 place-items-center rounded-full bg-admin-blue/10 text-lg font-bold text-admin-blue">{adminName.charAt(0)}</span>
          <div className="min-w-0"><p className="font-bold uppercase">{adminName}</p><p className="max-w-[180px] truncate text-sm text-muted-foreground">{adminEmail}</p></div>
          <Link to="/admin/$" params={{ _splat: "crm/analytics" }} className="inline-flex items-center gap-2 rounded-lg bg-admin-blue px-5 py-3 font-semibold text-primary-foreground shadow-cta"><BarChart3 className="size-4" />Analytics</Link>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <span className="flex items-center gap-2 font-bold uppercase tracking-wider"><span className="size-2 rounded-full bg-admin-purple" />Workspace Scope</span>
        <label className="flex items-center gap-3 text-[15px] text-muted-foreground">Active Period:
          <select className="h-11 rounded-md border bg-card px-4 text-foreground">
            <option>All-Time Data</option><option>This Month</option><option>This Week</option><option>Today</option>
          </select>
        </label>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard tone="purple" icon={Users} label="Total Customers" value={customers} note="Registered accounts" chip={`Total: ${customers}`} />
        <KpiCard tone="pink" icon={Target} label="Total Leads" value={0} note="Active leads in pipeline" chip="Total: 0" />
        <KpiCard tone="blue" icon={FileText} label="Active Deals" value={0} note="Active deals in pipeline" chip="Total: 0" />
        <KpiCard tone="green" icon={CircleDollarSign} label="Total Revenue" value="₹0.00" note="Total revenue" chip="Profit: ₹0.00" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel icon={Target} title="Recent Lead Data" columns={["Lead Title", "Interest", "Value", "Status"]} />
        <Panel icon={FileText} title="Recent Deal Data" columns={["Deal Title", "Stage", "Value", "Status"]} />
        <Panel icon={CalendarDays} title="Pending Follow-ups" columns={["Customer", "Type", "Due", "Assignee"]} />
        <Panel icon={CalendarDays} title="Upcoming Tasks" columns={["Task", "Priority", "Due", "Assigned To"]} />
      </div>
      <Panel icon={BarChart3} title="Company Performance" columns={["Company", "Leads", "Deals", "Revenue", "Conversion"]} />
    </div>
  );
}
