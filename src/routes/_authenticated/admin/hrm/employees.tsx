import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, ChevronLeft, ChevronRight, Download, Eye, LayoutGrid, List, MoreVertical, Pencil, Plus, Power, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminHead, initials } from "@/lib/admin-head";
import { csvDownload, employeeMetrics, loadHrm, type Employee } from "@/lib/hrm-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/hrm/employees")({
  head: () => adminHead("Employees", "Manage all employees and their HR records."),
  component: EmployeesPage,
});

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: unknown) => any };
type Form = { id?: string; profile_id: string; employee_code: string; phone: string; department_id: string; designation_id: string; branch_id: string; joining_date: string; employment_type: string; reporting_manager_id: string; is_active: boolean };
const blank: Form = { profile_id: "", employee_code: "", phone: "", department_id: "", designation_id: "", branch_id: "", joining_date: "", employment_type: "full_time", reporting_manager_id: "", is_active: true };
const types: Record<string, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", intern: "Intern" };

function EmployeesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["hrm"], queryFn: loadHrm });
  const profiles = useQuery({ queryKey: ["hrm-profiles"], queryFn: async () => (await db.from("profiles").select("id,full_name,email,phone").order("full_name")).data as { id: string; full_name: string; email: string; phone: string }[] }).data ?? [];
  const me = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "" }).data;
  const [q, setQ] = useState(""); const [grid, setGrid] = useState(false); const [page, setPage] = useState(1); const [size, setSize] = useState(10);
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<Employee | null>(null);
  const [reject, setReject] = useState<Employee | null>(null);
  const [newOpt, setNewOpt] = useState<{ table: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["hrm"] });
  const nm = (list: { id: string; name: string }[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.name ?? "N/A";
  const list = useMemo(() => (data?.employees ?? []).filter((e) => !q || [e.profiles?.full_name, e.profiles?.email, e.employee_code, nm(data?.departments, e.department_id), nm(data?.designations, e.designation_id)].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))), [data, q]);
  const pages = Math.max(1, Math.ceil(list.length / size)); const cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * size, cur * size);
  const linked = new Set((data?.employees ?? []).map((e) => e.profile_id));
  const audit = useQuery({ queryKey: ["hr-audit", view?.id], enabled: !!view, queryFn: async () => (await db.from("hr_access_audit").select("*").eq("employee_id", view!.id).order("created_at", { ascending: false })).data as { id: string; action: string; note: string; created_at: string }[] });

  const save = async () => {
    if (!form) return;
    if (!form.profile_id) { toast.error("Link a user account"); return; }
    if (form.reporting_manager_id && form.reporting_manager_id === form.id) { toast.error("An employee can't report to themselves"); return; }
    const p = { profile_id: form.profile_id, employee_code: form.employee_code.trim() || null, phone: form.phone.trim().slice(0, 30), department_id: form.department_id || null, designation_id: form.designation_id || null, branch_id: form.branch_id || null,
      joining_date: form.joining_date || null, employment_type: form.employment_type, reporting_manager_id: form.reporting_manager_id || null, is_active: form.is_active };
    const { error } = form.id ? await db.from("hr_employees").update(p).eq("id", form.id) : await db.from("hr_employees").insert(p);
    if (error) { toast.error(error.message.includes("duplicate") ? "That user or employee ID already has an employee record" : error.message); return; }
    toast.success(form.id ? "Employee updated" : "Employee added — approve access when ready"); setForm(null); refresh();
  };
  const decide = async (e: Employee, d: "approved" | "rejected") => {
    if (e.profile_id === me) { toast.error("You cannot change your own access"); return; }
    const { error } = await db.rpc("hr_set_access", { _employee: e.id, _decision: d, _note: "" });
    if (error) { toast.error(error.message); return; }
    toast.success(d === "approved" ? "Access approved" : "Access rejected — login blocked"); setReject(null); refresh();
  };
  const toggleActive = async (e: Employee) => { const { error } = await db.from("hr_employees").update({ is_active: !e.is_active }).eq("id", e.id); if (error) { toast.error(error.message); return; } toast.success(e.is_active ? "Employee deactivated" : "Employee activated"); refresh(); };
  const addOpt = async () => {
    if (!newOpt || !newOpt.name.trim()) return;
    const { error } = await db.from(newOpt.table).insert({ name: newOpt.name.trim().slice(0, 80) });
    if (error) { toast.error(error.message.includes("duplicate") ? "Already exists" : error.message); return; }
    toast.success("Added"); setNewOpt(null); refresh();
  };
  const edit = (e: Employee) => setForm({ id: e.id, profile_id: e.profile_id, employee_code: e.employee_code ?? "", phone: e.phone, department_id: e.department_id ?? "", designation_id: e.designation_id ?? "", branch_id: e.branch_id ?? "", joining_date: e.joining_date ?? "", employment_type: e.employment_type, reporting_manager_id: e.reporting_manager_id ?? "", is_active: e.is_active });
  const exportCsv = () => csvDownload("employees.csv", [["Name", "Email", "Employee ID", "Department", "Designation", "Branch", "Type", "Joining", "Access", "Active"],
    ...list.map((e) => [e.profiles?.full_name ?? "", e.profiles?.email ?? "", e.employee_code ?? "", nm(data?.departments, e.department_id), nm(data?.designations, e.designation_id), nm(data?.branches, e.branch_id), types[e.employment_type] ?? "", e.joining_date ?? "", e.access_status, e.is_active ? "Yes" : "No"])]);

  const Av = ({ e }: { e: Employee }) => e.profiles?.avatar_url ? <img src={e.profiles.avatar_url} alt="" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-admin-blue text-primary-foreground">{e.profiles?.full_name ? initials(e.profiles.full_name) : <User className="size-5" />}</span>;
  const Access = ({ e }: { e: Employee }) => e.access_status === "pending"
    ? <div className="flex gap-2"><button onClick={() => decide(e, "approved")} className="inline-flex items-center gap-1 rounded-md bg-admin-green px-4 py-1.5 font-semibold text-primary-foreground"><Check className="size-4" />Approve</button><button onClick={() => setReject(e)} className="inline-flex items-center gap-1 rounded-md border border-admin-red/30 bg-admin-red/5 px-4 py-1.5 font-semibold text-admin-red"><X className="size-4" />Reject</button></div>
    : <StatusBadge tone={e.access_status === "approved" ? "green" : "red"}>{e.access_status.toUpperCase()}</StatusBadge>;
  const Menu = ({ e }: { e: Employee }) => <DropdownMenu><DropdownMenuTrigger aria-label={`Actions for ${e.profiles?.full_name || e.profiles?.email}`} className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => setView(e)}><Eye className="size-4" />View</DropdownMenuItem>
      <DropdownMenuItem onClick={() => edit(e)}><Pencil className="size-4" />Edit / assign</DropdownMenuItem>
      {e.access_status !== "approved" && <DropdownMenuItem onClick={() => decide(e, "approved")}><Check className="size-4" />Approve access</DropdownMenuItem>}
      {e.access_status !== "rejected" && <DropdownMenuItem onClick={() => setReject(e)} className="text-admin-red"><X className="size-4" />{e.access_status === "approved" ? "Revoke access" : "Reject access"}</DropdownMenuItem>}
      <DropdownMenuItem onClick={() => toggleActive(e)}><Power className="size-4" />{e.is_active ? "Deactivate" : "Activate"}</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>;
  const Sel = ({ label, k, opts, table }: { label: string; k: keyof Form; opts: { id: string; name: string }[]; table?: string }) => form && <label className="grid gap-1 text-sm font-medium">{label}<div className="flex gap-1">
    <select className="inp" value={String(form[k])} onChange={(ev) => setForm({ ...form, [k]: ev.target.value })}><option value="">None</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
    {table && <button type="button" aria-label={`Add ${label}`} onClick={() => setNewOpt({ table, name: "" })} className="grid size-10 shrink-0 place-items-center rounded-md border"><Plus className="size-4" /></button>}</div></label>;

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["HRM"]} label="Employees" />
      <PageHeader title={`Employees (${list.length})`} subtitle="Manage all employees in the system">
        <SearchInput placeholder="Search employees..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-72" />
        <div className="flex overflow-hidden rounded-md border"><button aria-label="List view" onClick={() => setGrid(false)} className={cn("grid size-10 place-items-center", !grid ? "bg-admin-blue text-primary-foreground" : "")}><List className="size-4" /></button><button aria-label="Grid view" onClick={() => setGrid(true)} className={cn("grid size-10 place-items-center", grid ? "bg-admin-blue text-primary-foreground" : "")}><LayoutGrid className="size-4" /></button></div>
        <ToolbarButton onClick={exportCsv}><Download className="size-4" />Export</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank })}><Plus className="size-4" />Add Employee</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-16 text-center text-muted-foreground">Loading…</p> : list.length === 0 ? <p className="py-16 text-center text-muted-foreground">No employees yet. Use Add Employee to link a user account.</p>
          : grid ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map((e) => <div key={e.id} className="rounded-xl border p-5"><div className="flex items-start gap-3"><Av e={e} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{e.profiles?.full_name || "N/A"}</p><p className="truncate text-sm text-muted-foreground">{e.profiles?.email}</p></div><Menu e={e} /></div>
              <p className="mt-3 text-sm">{nm(data?.departments, e.department_id)} · {nm(data?.designations, e.designation_id)}</p><div className="mt-3"><Access e={e} /></div></div>)}</div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[15px]">
            <thead><tr className="bg-muted/60">{["Employee", "Department", "Designation", "User Access", "Actions"].map((c) => <th key={c} className="px-4 py-4 font-semibold">{c}</th>)}</tr></thead>
            <tbody className="divide-y">{rows.map((e) => <tr key={e.id} className={cn("hover:bg-muted/40", !e.is_active && "opacity-60")}>
              <td className="px-4 py-3"><div className="flex items-center gap-3"><Av e={e} /><div><p className="font-semibold">{e.profiles?.full_name || "N/A"}</p><p className="text-sm text-muted-foreground">{e.profiles?.email}</p></div></div></td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded bg-admin-blue/10 px-2 py-1 text-sm font-medium text-admin-blue"><LayoutGrid className="size-3" />{nm(data?.departments, e.department_id)}</span></td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded bg-admin-purple/10 px-2 py-1 text-sm font-medium text-admin-purple"><Award className="size-3" />{nm(data?.designations, e.designation_id)}</span></td>
              <td className="px-4 py-3"><Access e={e} /></td><td className="px-4 py-3"><Menu e={e} /></td></tr>)}</tbody></table></div>}
        <div className="mt-5 flex items-center justify-end gap-3"><span>Total {list.length} employees</span>
          <button aria-label="Previous" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="disabled:opacity-30"><ChevronLeft className="size-4" /></button><span className="grid size-10 place-items-center rounded-md bg-admin-blue font-semibold text-primary-foreground">{cur}</span>
          <button aria-label="Next" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="disabled:opacity-30"><ChevronRight className="size-4" /></button>
          <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }} className="h-10 rounded-md border bg-card px-3">{[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}</select></div>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{form?.id ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          {form && <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">Linked user account<select className="inp" value={form.profile_id} disabled={!!form.id} onChange={(e) => { const p = profiles.find((x) => x.id === e.target.value); setForm({ ...form, profile_id: e.target.value, phone: form.phone || p?.phone || "" }); }}>
              <option value="">Select a user…</option>{profiles.filter((p) => !linked.has(p.id) || p.id === form.profile_id).map((p) => <option key={p.id} value={p.id}>{p.full_name || "(no name)"} — {p.email}</option>)}</select>
              <span className="text-xs font-normal text-muted-foreground">Full name and work email come from the linked account. New people are invited from User Management → Users first.</span></label>
            <label className="grid gap-1 text-sm font-medium">Employee ID<input className="inp" value={form.employee_code} maxLength={40} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Phone<input className="inp" value={form.phone} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            {Sel({ label: "Department", k: "department_id", opts: data?.departments ?? [], table: "hr_departments" })}
            {Sel({ label: "Designation", k: "designation_id", opts: data?.designations ?? [], table: "hr_designations" })}
            {Sel({ label: "Branch", k: "branch_id", opts: data?.branches ?? [], table: "hr_branches" })}
            {Sel({ label: "Reporting manager", k: "reporting_manager_id", opts: (data?.employees ?? []).filter((e) => e.id !== form.id).map((e) => ({ id: e.id, name: e.profiles?.full_name || e.profiles?.email || "" })) })}
            <label className="grid gap-1 text-sm font-medium">Joining date<input type="date" className="inp" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Employment type<select className="inp" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-admin-blue" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />Active employee</label>
            <ToolbarButton primary onClick={save} className="justify-center sm:col-span-2">{form.id ? "Save changes" : "Add employee"}</ToolbarButton>
          </div>}
        </DialogContent></Dialog>

      <Dialog open={!!newOpt} onOpenChange={(o) => !o && setNewOpt(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Add {newOpt?.table.replace("hr_", "").replace(/s$/, "").replace(/che$/, "ch")}</DialogTitle></DialogHeader>
          {newOpt && <div className="flex gap-2"><input autoFocus className="inp" value={newOpt.name} onChange={(e) => setNewOpt({ ...newOpt, name: e.target.value })} /><ToolbarButton primary onClick={addOpt}>Add</ToolbarButton></div>}</DialogContent></Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{view?.profiles?.full_name || view?.profiles?.email}</DialogTitle></DialogHeader>
          {view && data && (() => { const m = employeeMetrics(view.profile_id, data.leads, data.deals); return <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[150px_1fr] gap-y-1.5">{([["Email", view.profiles?.email], ["Phone", view.phone || view.profiles?.phone || "—"], ["Employee ID", view.employee_code || "—"], ["Department", nm(data.departments, view.department_id)], ["Designation", nm(data.designations, view.designation_id)], ["Branch", nm(data.branches, view.branch_id)],
              ["Employment", `${types[view.employment_type]} · ${view.is_active ? "Active" : "Inactive"}`], ["Joining date", view.joining_date || "—"], ["User access", view.access_status], ["Login status", view.profiles?.account_status], ["Assigned leads", `${m.assigned} (${m.pending} pending)`], ["Won deals", m.won], ["Tasks / attendance", "Not tracked yet"]] as const).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v ?? "—")}</dd></div>)}</dl>
            <div><p className="mb-1 font-semibold">Access history</p>{audit.data?.length ? <ul className="space-y-1">{audit.data.map((a) => <li key={a.id} className="rounded border px-2 py-1">{a.action} · {new Date(a.created_at).toLocaleString()}</li>)}</ul> : <p className="text-muted-foreground">No approval actions yet.</p>}</div>
          </div>; })()}
        </DialogContent></Dialog>

      <AlertDialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{reject?.access_status === "approved" ? "Revoke" : "Reject"} access for {reject?.profiles?.full_name || reject?.profiles?.email}?</AlertDialogTitle>
          <AlertDialogDescription>Their login will be blocked until access is approved again. Their roles are not changed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => reject && decide(reject, "rejected")}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
