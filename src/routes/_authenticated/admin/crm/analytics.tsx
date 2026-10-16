import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Gauge, IndianRupee, Percent, Users } from "lucide-react";
import { Breadcrumb, Card, EmptyState, KpiCard, PageHeader, TabBar, ToolbarButton } from "@/components/admin/ui";
import { db, filterLeads, inr, loadLookups, nameOf, type Row } from "@/lib/crm-data";

export const Route = createFileRoute("/_authenticated/admin/crm/analytics")({
  head: () => ({ meta: [
    { title: "Advanced Analytics — Routiva CRM Admin" },
    { name: "description", content: "Lead and deal analytics from live CRM data." },
    { property: "og:title", content: "Advanced Analytics — Routiva CRM Admin" },
    { property: "og:description", content: "Lead and deal analytics from live CRM data." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AnalyticsPage,
});

async function load() {
  const [l, d, lk] = await Promise.all([
    db.from("leads").select("id,created_at,source_id,stage_id,status,assigned_to,region").limit(20000),
    db.from("deals").select("id,created_at,lead_id,stage_id,status,amount").limit(20000),
    loadLookups(),
  ]);
  if (l.error) throw l.error;
  if (d.error) throw d.error;
  return { leads: l.data as Row[], deals: d.data as Row[], ...lk };
}
const PALETTE = ["#2684FF", "#7C4DF6", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#94A3B8"];
type Tab = "exec" | "leads" | "deals";

function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-analytics"], queryFn: load });
  const [tab, setTab] = useState<Tab>("exec");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");

  const a = useMemo(() => {
    if (!data) return null;
    const range = { from: from || undefined, to: to || undefined };
    const leads = filterLeads(data.leads, range);
    const deals = filterLeads(data.deals, range);
    const count = (rows: Row[], key: (r: Row) => string) => { const m = new Map<string, number>(); rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1)); return [...m].map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value); };
    const wonLeadIds = new Set(data.deals.filter((d) => d.status === "won" && d.lead_id).map((d) => d.lead_id));
    const conv = data.sources.map((s) => { const ls = leads.filter((l) => l.source_id === s.id); return { name: s.name, leads: ls.length, converted: ls.filter((l) => l.status === "won" || wonLeadIds.has(l.id)).length }; }).filter((x) => x.leads > 0);
    const converted = leads.filter((l) => l.status === "won" || wonLeadIds.has(l.id)).length;
    return {
      leads, deals,
      total: leads.length, open: leads.filter((l) => l.status === "open").length,
      rate: leads.length ? (converted / leads.length) * 100 : 0,
      avg: deals.length ? deals.reduce((s, d) => s + Number(d.amount), 0) / deals.length : 0,
      byStage: data.leadStages.map((s) => ({ name: s.name, value: leads.filter((l) => l.stage_id === s.id).length, color: s.color })),
      bySource: count(leads, (l) => nameOf(data.sources, l.source_id, "No source")),
      byRegion: count(leads, (l) => l.region || "Unknown"),
      dealStage: data.dealStages.map((s) => ({ name: s.name, value: deals.filter((d) => d.stage_id === s.id).length, amount: deals.filter((d) => d.stage_id === s.id).reduce((t, d) => t + Number(d.amount), 0), color: s.color })),
      conv,
    };
  }, [data, from, to]);

  const inp = "h-10 rounded-md border bg-card px-3 text-[15px]";
  return (
    <div className="space-y-5">
      <Breadcrumb label="Advanced Analytics" />
      <PageHeader title="Advanced Reports & Analytics" subtitle="Live insight from your CRM records">
        <input aria-label="From date" type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input aria-label="To date" type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} />
        <ToolbarButton onClick={() => { setFrom(""); setTo(""); }}>All time</ToolbarButton>
      </PageHeader>
      <TabBar tabs={[{ id: "exec" as Tab, label: "Executive Overview" }, { id: "leads" as Tab, label: "Leads Deep-Dive" }, { id: "deals" as Tab, label: "Deals Deep-Dive" }]} value={tab} onChange={setTab} />
      {isLoading || !a ? (error ? <EmptyState title="Could not load analytics" hint={(error as Error).message} /> : <p className="py-20 text-center text-muted-foreground">Loading analytics…</p>) : <>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Users} tone="blue" label="Total Leads" value={a.total} note="In selected range" />
          <KpiCard icon={Gauge} tone="orange" label="Open Pipeline Leads" value={a.open} note="Status open" />
          <KpiCard icon={Percent} tone="green" label="Conversion Rate" value={`${a.rate.toFixed(1)}%`} note="Won leads or leads with won deals" />
          <KpiCard icon={IndianRupee} tone="purple" label="Avg Opportunity Value" value={inr(a.avg)} note={`${a.deals.length} deals`} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {(tab !== "deals") && <>
            <ChartCard title="Leads Distribution by Stage" empty={!a.total}>
              <BarChart data={a.byStage}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
                <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>{a.byStage.map((s) => <Cell key={s.name} fill={s.color} />)}</Bar></BarChart>
            </ChartCard>
            <ChartCard title="Leads Volume by Source" empty={!a.total}>
              <BarChart data={a.bySource} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={110} fontSize={12} /><Tooltip />
                <Bar dataKey="value" name="Leads" fill="#2684FF" radius={[0, 4, 4, 0]} /></BarChart>
            </ChartCard>
            <ChartCard title="Lead Distribution by Region" empty={!a.total}>
              <PieChart><Pie data={a.byRegion} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>{a.byRegion.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ChartCard>
            <ChartCard title="Conversion Efficiency by Channel" empty={!a.conv.length}>
              <BarChart data={a.conv}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend />
                <Bar dataKey="leads" name="Leads" fill="#94A3B8" radius={[4, 4, 0, 0]} /><Bar dataKey="converted" name="Converted" fill="#22C55E" radius={[4, 4, 0, 0]} /></BarChart>
            </ChartCard>
          </>}
          {(tab !== "leads") && <>
            <ChartCard title="Deal Overview by Stage" empty={!a.deals.length}>
              <BarChart data={a.dealStage}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
                <Bar dataKey="value" name="Deals" radius={[4, 4, 0, 0]}>{a.dealStage.map((s) => <Cell key={s.name} fill={s.color} />)}</Bar></BarChart>
            </ChartCard>
            <ChartCard title="Deal Value by Stage (INR)" empty={!a.deals.length}>
              <PieChart><Pie data={a.dealStage.filter((s) => s.amount > 0)} dataKey="amount" nameKey="name" innerRadius={60} outerRadius={100}>{a.dealStage.filter((s) => s.amount > 0).map((s) => <Cell key={s.name} fill={s.color} />)}</Pie><Tooltip formatter={(v: number) => inr(v)} /><Legend /></PieChart>
            </ChartCard>
          </>}
        </div>
      </>}
    </div>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactElement }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold">{title}</h3>
      {empty ? <EmptyState title="Not enough data yet" hint="This chart fills in as records arrive." /> : <div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
    </Card>
  );
}
