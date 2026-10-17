import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpDown, Award, Briefcase, ChevronLeft, ChevronRight, Download, LayoutGrid, MapPin, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Breadcrumb, Card, PageHeader, SearchInput } from "@/components/admin/ui";
import { MiniKpi } from "@/components/admin/MiniKpi";
import { adminHead, initials } from "@/lib/admin-head";
import { csvDownload, employeeMetrics, loadHrm } from "@/lib/hrm-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/hrm/analytics")({
  head: () => adminHead("HRM Analytics", "Employee performance, lead handling metrics and organizational statistics."),
  component: HrmAnalytics,
});

const C = { blue: "var(--admin-blue)", purple: "var(--admin-purple)", green: "var(--admin-green)", orange: "var(--admin-orange)", pink: "var(--admin-pink)", red: "var(--admin-red)" };
type SortKey = "name" | "assigned" | "pending" | "won" | "openDeals";
const PAGE = 10;

function HrmAnalytics() {
  const { data, isLoading, error } = useQuery({ queryKey: ["hrm"], queryFn: loadHrm });
  const [tab, setTab] = useState<"perf" | "org">("perf");
  const [q, setQ] = useState(""); const [dept, setDept] = useState(""); const [branch, setBranch] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "assigned", asc: false });
  const [page, setPage] = useState(1);

  const rows = useMemo(() => (data?.employees ?? [])
    .filter((e) => (!dept || e.department_id === dept) && (!branch || e.branch_id === branch) && (!q || `${e.profiles?.full_name} ${e.profiles?.email}`.toLowerCase().includes(q.toLowerCase())))
    .map((e) => ({ e, name: e.profiles?.full_name || e.profiles?.email || "Employee", ...employeeMetrics(e.profile_id, data?.leads ?? [], data?.deals ?? [], from, to), meetings: (data?.meetings ?? []).filter(m => m.status === "scheduled" && m.details.employee_ids?.includes(e.id) && (!from || m.start_date >= from) && (!to || m.start_date <= to)).length, attendance: (data?.attendance ?? []).filter(a => a.employee_id === e.id && a.status === "present" && (!from || a.attendance_date >= from) && (!to || a.attendance_date <= to)).length }))
    .sort((a, b) => { const va = a[sort.k], vb = b[sort.k]; const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number); return sort.asc ? c : -c; }), [data, q, dept, branch, from, to, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PAGE, cur * PAGE);
  const short = (n: string) => n.split(" ")[0] ?? n;
  const group = (key: "department_id" | "branch_id" | "designation_id", names: { id: string; name: string }[]) => {
    const m = new Map<string, number>(); for (const e of data?.employees ?? []) { const n = names.find((x) => x.id === e[key])?.name ?? "Unassigned"; m.set(n, (m.get(n) ?? 0) + 1); }
    return [...m].map(([name, value]) => ({ name, value }));
  };
  const Th = ({ k, l }: { k: SortKey; l: string }) => <th className="px-4 py-4"><button onClick={() => setSort({ k, asc: sort.k === k ? !sort.asc : false })} className="flex items-center gap-2 text-left font-semibold">{l}<ArrowUpDown className="size-3.5 text-muted-foreground" /></button></th>;
  const exportCsv = () => csvDownload("employee-performance.csv", [["Employee", "Email", "Assigned Leads", "Pending Leads", "Won Deals", "Open Deals", "Pending Tasks", "Pending Follow-ups", "Avg Reply Speed", "Scheduled Meetings"],
    ...rows.map((r) => [r.name, r.e.profiles?.email ?? "", r.assigned, r.pending, r.won, r.openDeals, "Not tracked", "Not tracked", "Not tracked", r.meetings])]);

  if (error) return <p className="p-10 text-admin-red">{(error as Error).message}</p>;
  const activeBranches = data?.branches.filter((b) => b.is_active).length ?? 0;

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["HRM"]} label="Analytics" />
      <PageHeader title="HRM Reports & Performance Analytics" subtitle="Real-time insights into employee performance, lead handling metrics and organizational statistics." />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MiniKpi iconRight icon={Users} tone="purple" label="Total Employees" value={isLoading ? "…" : data?.employees.length ?? 0} note={<><b className="text-success">{data?.employees.filter((e) => e.is_active).length ?? 0} Active</b> staff count</>} />
        <MiniKpi iconRight icon={MapPin} tone="green" label="Active Branches" value={activeBranches} note={<><b className="text-success">Operational</b> branch network</>} />
        <MiniKpi iconRight icon={Briefcase} tone="orange" label="Designations" value={data?.designations.length ?? 0} note={<><b className="text-warning">Roles</b> in organization</>} />
        <MiniKpi iconRight icon={LayoutGrid} tone="blue" label="Departments" value={data?.departments.length ?? 0} note={<><b className="text-admin-blue">Departments</b> established</>} />
      </div>
      <div className="flex justify-center"><div className="flex rounded-xl border bg-card p-1">
        <button onClick={() => setTab("perf")} className={cn("flex items-center gap-2 rounded-lg px-6 py-3 font-semibold", tab === "perf" ? "bg-admin-blue text-primary-foreground" : "text-muted-foreground")}><TrendingUp className="size-4" />Employee Performance</button>
        <button onClick={() => setTab("org")} className={cn("flex items-center gap-2 rounded-lg px-6 py-3 font-semibold", tab === "org" ? "bg-admin-blue text-primary-foreground" : "text-muted-foreground")}><Activity className="size-4" />Org Demographics</button></div></div>

      {tab === "perf" ? <>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><h3 className="flex items-center gap-2 border-b px-6 py-5 text-xl font-semibold"><Award className="size-5" />CRM & Sales Performance Analysis</h3>
            <div className="h-80 p-4"><ResponsiveContainer><BarChart data={rows.map((r) => ({ n: short(r.name), "Assigned Leads": r.assigned, "Won Deals": r.won }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="n" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="Assigned Leads" fill={C.blue} radius={[4, 4, 0, 0]} /><Bar dataKey="Won Deals" fill={C.green} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
          <Card><h3 className="flex items-center gap-2 border-b px-6 py-5 text-xl font-semibold"><Activity className="size-5 text-admin-blue" />Active Operational Workload</h3>
            <div className="h-80 p-4"><ResponsiveContainer><BarChart data={rows.map((r) => ({ n: short(r.name), "Pending Leads": r.pending, "Open Deals": r.openDeals }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="n" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="Pending Leads" fill={C.orange} radius={[4, 4, 0, 0]} /><Bar dataKey="Open Deals" fill={C.purple} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <p className="px-6 pb-4 text-xs text-muted-foreground">Recorded present days: {rows.reduce((n, r) => n + r.attendance, 0)} · Scheduled meetings: {rows.reduce((n, r) => n + r.meetings, 0)}. Tasks and follow-ups are not tracked.</p></Card>
        </div>
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b px-6 py-5"><h3 className="flex flex-1 items-center gap-2 text-xl font-semibold"><Users className="size-5" />Full Employee Performance Ledger</h3>
            <SearchInput placeholder="Search employee..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-56" />
            <select aria-label="Department" className="inp w-40" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select aria-label="Branch" className="inp w-36" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">All branches</option>{data?.branches.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <input aria-label="From" type="date" className="inp w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><input aria-label="To" type="date" className="inp w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            <button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-md border px-3"><Download className="size-4" />Export</button></div>
          <div className="overflow-x-auto p-6"><table className="w-full min-w-[1100px] text-left">
            <thead><tr className="bg-muted/60"><Th k="name" l="Employee Name" /><Th k="assigned" l="Assigned Leads" /><Th k="pending" l="Pending Leads" /><Th k="won" l="Won Deals" /><th className="px-4 py-4 font-semibold">Pending Tasks</th><th className="px-4 py-4 font-semibold">Pending Follow-ups</th><th className="px-4 py-4 font-semibold">Avg. Reply Speed</th><th className="px-4 py-4 font-semibold">Scheduled Meetings</th></tr></thead>
            <tbody className="divide-y">{slice.map((r) => <tr key={r.e.id} className="hover:bg-muted/40">
              <td className="px-4 py-5"><div className="flex items-center gap-3">{r.e.profiles?.avatar_url ? <img src={r.e.profiles.avatar_url} alt="" className="size-11 rounded-full object-cover" /> : <span className="grid size-11 place-items-center rounded-full bg-admin-blue font-bold text-primary-foreground">{initials(r.name)}</span>}<span>{r.name}</span></div></td>
              <td className="px-4 py-5 font-semibold">{r.assigned} Leads</td><td className="px-4 py-5 font-semibold text-warning">{r.pending} Leads</td><td className="px-4 py-5 font-semibold text-success">{r.won} Won</td>
              {[0, 1, 2].map((i) => <td key={i} className="px-4 py-5 text-sm text-muted-foreground">Not tracked</td>)}<td className="px-4 py-5 font-semibold">{r.meetings}</td>
            </tr>)}</tbody></table>
            {!isLoading && rows.length === 0 && <p className="py-16 text-center text-muted-foreground">No employee records yet. Add employees in HRM → Employees.</p>}
            <div className="mt-5 flex items-center justify-end gap-3"><button aria-label="Previous" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="grid size-11 place-items-center rounded-md border border-admin-blue text-admin-blue">{cur}</span><button aria-label="Next" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="disabled:opacity-30"><ChevronRight className="size-4" /></button></div>
          </div>
        </Card>
      </> : <div className="grid gap-5 lg:grid-cols-3">
        {([["By Department", group("department_id", data?.departments ?? [])], ["By Branch", group("branch_id", data?.branches ?? [])], ["By Designation", group("designation_id", data?.designations ?? [])]] as const).map(([t, d]) =>
          <Card key={t}><h3 className="border-b px-6 py-4 text-lg font-semibold">{t}</h3><div className="h-72 p-4">{d.length ? <ResponsiveContainer><PieChart><Pie data={d as { name: string; value: number }[]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>{d.map((_, i) => <Cell key={i} fill={Object.values(C)[i % 6]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p className="pt-20 text-center text-muted-foreground">No employees</p>}</div></Card>)}
      </div>}
    </div>
  );
}
