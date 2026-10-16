import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, FileSpreadsheet, FileText, FileDown, Users, UserCheck, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, StatusBadge, TabBar, ToolbarButton } from "@/components/admin/ui";
import { db, exportCsv, exportPdf, exportXlsx, filterLeads, loadLookups, nameOf, type ReportFilters, type Row } from "@/lib/crm-data";

export const Route = createFileRoute("/_authenticated/admin/crm/reports")({
  head: () => ({ meta: [
    { title: "Reports Manager — Routiva CRM Admin" },
    { name: "description", content: "Filter CRM data and export lead, activity and employee reports." },
    { property: "og:title", content: "Reports Manager — Routiva CRM Admin" },
    { property: "og:description", content: "Filter CRM data and export lead, activity and employee reports." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ReportsPage,
});

async function load() {
  const [l, a, lk] = await Promise.all([
    db.from("leads").select("*").order("created_at", { ascending: false }).limit(10000),
    db.from("lead_activities").select("*").order("created_at", { ascending: false }).limit(10000),
    loadLookups(),
  ]);
  if (l.error) throw l.error;
  if (a.error) throw a.error;
  return { leads: l.data as Row[], acts: a.data as Row[], ...lk };
}

type Cat = "leads" | "activities" | "employees";
type Table = { headers: string[]; rows: (string | number)[][] };
const PAGE = 10;

function ReportsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-reports"], queryFn: load });
  const [f, setF] = useState<ReportFilters>({});
  const [cat, setCat] = useState<Cat>("leads");
  const [page, setPage] = useState(0);

  const leads = useMemo(() => data ? filterLeads(data.leads, f) : [], [data, f]);
  const leadIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads]);
  const acts = useMemo(() => (data?.acts ?? []).filter((a) => leadIds.has(a.lead_id)), [data, leadIds]);

  const reports = useMemo((): Record<Cat, { id: string; title: string; desc: string; build: () => Table }[]> => {
    if (!data) return { leads: [], activities: [], employees: [] };
    const stage = (id: string) => nameOf(data.leadStages, id);
    return {
      leads: [
        { id: "lead-list", title: "Lead Register", desc: "Every lead matching the filters with contact and source details.", build: () => ({
          headers: ["Received", "Customer", "Phone", "Email", "Source", "Stage", "Status", "Assignee", "Campaign"],
          rows: leads.map((l) => [new Date(l.created_at).toLocaleString("en-IN"), l.customer_name, l.phone, l.email, nameOf(data.sources, l.source_id), stage(l.stage_id), l.status, nameOf(data.people, l.assigned_to, "Unassigned"), l.meta_campaign_name ?? ""]) }) },
        { id: "by-source", title: "Acquisition by Source", desc: "Lead volume grouped by source.", build: () => group(leads, (l) => nameOf(data.sources, l.source_id, "No source"), "Source") },
        { id: "by-campaign", title: "Campaign Performance", desc: "Lead volume grouped by ad campaign.", build: () => group(leads, (l) => l.meta_campaign_name || "Manual / no campaign", "Campaign") },
      ],
      activities: [
        { id: "activity-log", title: "Activity Log", desc: "Stage changes, reassignments and status updates on filtered leads.", build: () => ({
          headers: ["Date", "Lead", "Type", "Detail", "By"],
          rows: acts.map((a) => [new Date(a.created_at).toLocaleString("en-IN"), data.leads.find((l) => l.id === a.lead_id)?.customer_name ?? "", a.type.replace("_", " "),
            a.type === "reassigned" ? nameOf(data.people, a.detail, a.detail) : a.detail, nameOf(data.people, a.actor_id, "System")]) }) },
        { id: "activity-type", title: "Activities by Type", desc: "Count of each activity type.", build: () => group(acts, (a) => a.type.replace("_", " "), "Activity") },
      ],
      employees: [
        { id: "emp-leads", title: "Employee Lead Load", desc: "Leads assigned to each employee with open/won counts.", build: () => {
          const m = new Map<string, number[]>();
          for (const l of leads) { const k = nameOf(data.people, l.assigned_to, "Unassigned"); const v = m.get(k) ?? [0, 0, 0]; v[0]!++; if (l.status === "open") v[1]!++; if (l.status === "won") v[2]!++; m.set(k, v); }
          return { headers: ["Employee", "Leads", "Open", "Won"], rows: [...m].map(([k, v]) => [k, ...v]) };
        } },
        { id: "emp-acts", title: "Employee Activity", desc: "Recorded CRM actions per employee.", build: () => group(acts, (a) => nameOf(data.people, a.actor_id, "System"), "Employee") },
      ],
    };
  }, [data, leads, acts]);

  const run = async (r: { id: string; title: string; build: () => Table }, kind: "pdf" | "xlsx" | "csv") => {
    const t = r.build();
    if (!t.rows.length) { toast.info("No records match the selected filters"); return; }
    const name = `${r.id}-${new Date().toISOString().slice(0, 10)}`;
    if (kind === "csv") exportCsv(t.headers, t.rows, name);
    else if (kind === "xlsx") await exportXlsx(t.headers, t.rows, name);
    else await exportPdf(r.title, t.headers, t.rows, name);
  };

  const counts = { total: leads.length, open: leads.filter((l) => l.status === "open").length, won: leads.filter((l) => l.status === "won").length, unassigned: leads.filter((l) => !l.assigned_to).length };
  const sel = "h-10 rounded-md border bg-card px-3 text-[15px]";
  const shown = leads.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(leads.length / PAGE));
  const upd = (p: Partial<ReportFilters>) => { setF({ ...f, ...p }); setPage(0); };

  return (
    <div className="space-y-5">
      <Breadcrumb label="Reports Manager" />
      <PageHeader title="Reports Manager" subtitle="Generate and export reports from live CRM records" />
      <div className="grid gap-5 md:grid-cols-3">
        {[{ i: BarChart3, l: "Leads in range", v: counts.total, c: "text-admin-blue bg-admin-blue/10" },
          { i: Activity, l: "Activities recorded", v: acts.length, c: "text-admin-purple bg-admin-purple/10" },
          { i: Users, l: "Employees with leads", v: new Set(leads.map((x) => x.assigned_to).filter(Boolean)).size, c: "text-success bg-admin-green/15" }].map((k) => (
          <Card key={k.l} className="flex items-center gap-4 p-5">
            <span className={`grid size-12 place-items-center rounded-lg ${k.c}`}><k.i className="size-6" /></span>
            <div><p className="text-sm text-muted-foreground">{k.l}</p><p className="text-2xl font-bold">{isLoading ? "…" : k.v}</p></div>
          </Card>
        ))}
      </div>
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs font-semibold text-muted-foreground">From<input type="date" className={`${sel} block`} value={f.from ?? ""} onChange={(e) => upd({ from: e.target.value || undefined })} /></label>
        <label className="text-xs font-semibold text-muted-foreground">To<input type="date" className={`${sel} block`} value={f.to ?? ""} onChange={(e) => upd({ to: e.target.value || undefined })} /></label>
        <select aria-label="Source" className={sel} value={f.sourceId ?? ""} onChange={(e) => upd({ sourceId: e.target.value || undefined })}>
          <option value="">All sources</option>{data?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select aria-label="Status" className={sel} value={f.status ?? ""} onChange={(e) => upd({ status: e.target.value || undefined })}>
          <option value="">All statuses</option><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select>
        <select aria-label="Employee" className={sel} value={f.assignee ?? ""} onChange={(e) => upd({ assignee: e.target.value || undefined })}>
          <option value="">All employees</option><option value="unassigned">Unassigned</option>{data?.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <ToolbarButton onClick={() => { setF({}); setPage(0); }}>Reset</ToolbarButton>
      </Card>
      <Card className="p-5">
        <div className="mb-5"><TabBar tabs={[{ id: "leads" as Cat, label: "Leads & Acquisition" }, { id: "activities" as Cat, label: "Follow-ups & Activities" }, { id: "employees" as Cat, label: "Employee Activity" }]} value={cat} onChange={setCat} /></div>
        {cat === "activities" && <p className="mb-4 rounded-md bg-admin-orange/10 p-3 text-sm text-warning">Follow-up scheduling isn't built yet; these reports cover recorded lead activity history.</p>}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {reports[cat].map((r) => (
            <div key={r.id} className="rounded-lg border p-5 transition-shadow hover:shadow-float">
              <FileText className="mb-3 size-8 text-admin-blue" />
              <h3 className="font-bold">{r.title}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{r.desc}</p>
              <div className="flex gap-2">
                <ToolbarButton onClick={() => run(r, "pdf")}><FileDown className="size-4" />PDF</ToolbarButton>
                <ToolbarButton onClick={() => run(r, "xlsx")}><FileSpreadsheet className="size-4" />Excel</ToolbarButton>
                <ToolbarButton onClick={() => run(r, "csv")}>CSV</ToolbarButton>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-xl font-bold">Live Lead Data Preview</h2>
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          {[["Total", counts.total, "bg-admin-blue/10 text-admin-blue"], ["Open", counts.open, "bg-admin-orange/15 text-warning"], ["Won", counts.won, "bg-admin-green/15 text-success"], ["Unassigned", counts.unassigned, "bg-admin-red/10 text-admin-red"]].map(([l, v, c]) => (
            <div key={l as string} className={`rounded-lg p-4 ${c}`}><p className="text-sm font-semibold">{l}</p><p className="text-2xl font-bold">{v}</p></div>
          ))}
        </div>
        {isLoading ? <p className="py-16 text-center text-muted-foreground">Loading…</p> : error ? <EmptyState title="Could not load data" hint={(error as Error).message} /> : <>
          <DataTable columns={["Received", "Customer", "Phone", "Source", "Stage", "Status", "Assignee"]} minWidth={1000}>
            {shown.map((l) => (
              <tr key={l.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-semibold">{l.customer_name}</td><td className="px-4 py-3">{l.phone}</td>
                <td className="px-4 py-3"><StatusBadge tone="purple">{nameOf(data!.sources, l.source_id)}</StatusBadge></td>
                <td className="px-4 py-3">{nameOf(data!.leadStages, l.stage_id)}</td>
                <td className="px-4 py-3"><StatusBadge tone={l.status === "won" ? "green" : l.status === "lost" ? "red" : "blue"}>{l.status}</StatusBadge></td>
                <td className="px-4 py-3">{l.assigned_to ? nameOf(data!.people, l.assigned_to) : <span className="inline-flex items-center gap-1 text-warning"><UserCheck className="size-4" />Unassigned</span>}</td>
              </tr>
            ))}
          </DataTable>
          {leads.length === 0 ? <EmptyState title="No leads match these filters" /> : (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {page + 1} of {pages} · {leads.length} records</span>
              <div className="flex gap-2"><ToolbarButton onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</ToolbarButton><ToolbarButton onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</ToolbarButton></div>
            </div>
          )}
        </>}
      </Card>
    </div>
  );
}

function group(rows: Row[], key: (r: Row) => string, label: string): Table {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return { headers: [label, "Count"], rows: [...m].sort((a, b) => b[1] - a[1]) };
}
