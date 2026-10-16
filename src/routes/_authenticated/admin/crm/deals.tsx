import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Filter, LayoutGrid, List, MoreVertical, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { db, exportCsv, inr, loadLookups, nameOf, type Row } from "@/lib/crm-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/crm/deals")({
  head: () => ({ meta: [
    { title: "Deals — Routiva CRM Admin" },
    { name: "description", content: "Track deal value, stages and owners across the pipeline." },
    { property: "og:title", content: "Deals — Routiva CRM Admin" },
    { property: "og:description", content: "Track deal value, stages and owners across the pipeline." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DealsPage,
});

const QK = ["admin-deals"];
const PAGE = 10;
async function load() {
  const [d, l, lk] = await Promise.all([
    db.from("deals").select("*").order("created_at", { ascending: false }).limit(5000),
    db.from("leads").select("id,customer_name,phone,company_id").order("created_at", { ascending: false }).limit(5000),
    loadLookups(),
  ]);
  if (d.error) throw d.error;
  if (l.error) throw l.error;
  return { deals: d.data as Row[], leads: l.data as Row[], ...lk };
}

const blank = { title: "", amount: "", stage_id: "", lead_id: "", expected_close_date: "", assigned_to: "", company_id: "", contract_type_id: "", status: "open" };
type Form = typeof blank & { id?: string };

function DealsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [showFilters, setShowFilters] = useState(false);
  const [stageF, setStageF] = useState(""); const [ownerF, setOwnerF] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "high" | "low" | "close">("new");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [del, setDel] = useState<Row | null>(null);

  const rows = useMemo(() => {
    const list = (data?.deals ?? []).filter((d) => (!stageF || d.stage_id === stageF) && (!ownerF || d.assigned_to === ownerF) &&
      (!q || [d.title, nameOf(data!.leads.map((l) => ({ id: l.id, name: l.customer_name })), d.lead_id, "")].some((v) => String(v).toLowerCase().includes(q.toLowerCase()))));
    const s = [...list];
    if (sort === "old") s.reverse();
    if (sort === "high") s.sort((a, b) => b.amount - a.amount);
    if (sort === "low") s.sort((a, b) => a.amount - b.amount);
    if (sort === "close") s.sort((a, b) => String(a.expected_close_date ?? "9999").localeCompare(String(b.expected_close_date ?? "9999")));
    return s;
  }, [data, q, stageF, ownerF, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const leadName = (id: string | null) => data?.leads.find((l) => l.id === id)?.customer_name ?? "—";

  const refresh = () => qc.invalidateQueries({ queryKey: QK });
  const save = async () => {
    if (!form) return;
    const amount = Number(form.amount);
    if (!form.title.trim()) { toast.error("Deal name is required"); return; }
    if (!Number.isFinite(amount) || amount < 0) { toast.error("Enter a valid deal value in INR"); return; }
    const payload = {
      title: form.title.trim().slice(0, 200), amount, status: form.status,
      stage_id: form.stage_id || null, lead_id: form.lead_id || null, expected_close_date: form.expected_close_date || null,
      assigned_to: form.assigned_to || null, company_id: form.company_id || null, contract_type_id: form.contract_type_id || null,
    };
    const res = form.id ? await db.from("deals").update(payload).eq("id", form.id)
      : await db.from("deals").insert({ ...payload, pipeline_id: data?.defaultPipeline, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(form.id ? "Deal updated" : "Deal created"); setForm(null); refresh();
  };
  const moveStage = async (id: string, stage_id: string) => {
    const stage = data!.dealStages.find((s) => s.id === stage_id)?.name.toLowerCase();
    const { error } = await db.from("deals").update({ stage_id, status: stage === "won" ? "won" : stage === "lost" ? "lost" : "open" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const edit = (d: Row) => setForm({ id: d.id, title: d.title, amount: String(d.amount), stage_id: d.stage_id ?? "", lead_id: d.lead_id ?? "",
    expected_close_date: d.expected_close_date ?? "", assigned_to: d.assigned_to ?? "", company_id: d.company_id ?? "", contract_type_id: d.contract_type_id ?? "", status: d.status });
  const doExport = () => {
    if (!rows.length) { toast.info("No deals to export"); return; }
    exportCsv(["Deal", "Customer", "Stage", "Value (INR)", "Expected Close", "Assignee", "Company", "Status", "Created"],
      rows.map((d) => [d.title, leadName(d.lead_id), nameOf(data!.dealStages, d.stage_id), d.amount, d.expected_close_date ?? "", nameOf(data!.people, d.assigned_to, "Unassigned"),
        nameOf(data!.companies, d.company_id), d.status, new Date(d.created_at).toLocaleDateString()]), "deals");
  };
  const actions = (d: Row) => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Deal actions" className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => edit(d)}><Pencil className="size-4" />Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-admin-red" onClick={() => setDel(d)}><Trash2 className="size-4" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const sel = "h-10 rounded-md border bg-card px-3 text-[15px]";

  return (
    <div className="space-y-5">
      <Breadcrumb label={`All Deals (${data?.deals.length ?? 0})`} />
      <PageHeader title={`Deals (${rows.length})`} subtitle={`Pipeline value ${inr(rows.reduce((s, d) => s + Number(d.amount), 0))}`}>
        <SearchInput placeholder="Search deals..." value={q} onChange={(v) => { setQ(v); setPage(0); }} className="w-72" />
        <ToolbarButton onClick={() => setShowFilters((s) => !s)}><Filter className="size-4" />Filters</ToolbarButton>
        <div className="flex overflow-hidden rounded-md border">
          {(["table", "kanban"] as const).map((v) => { const I = v === "table" ? List : LayoutGrid;
            return <button key={v} aria-label={`${v} view`} onClick={() => setView(v)} className={cn("grid h-10 w-12 place-items-center", view === v ? "bg-admin-blue text-primary-foreground" : "bg-card hover:bg-muted")}><I className="size-4" /></button>; })}
        </div>
        <ToolbarButton onClick={doExport}><Download className="size-4" />Export</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank, stage_id: data?.dealStages.find((s) => s.is_active)?.id ?? "" })}><Plus className="size-4" />Create Deal</ToolbarButton>
      </PageHeader>
      {showFilters && data && (
        <Card className="flex flex-wrap gap-3 p-4">
          <select aria-label="Stage filter" className={sel} value={stageF} onChange={(e) => { setStageF(e.target.value); setPage(0); }}>
            <option value="">All stages</option>{data.dealStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Assignee filter" className={sel} value={ownerF} onChange={(e) => { setOwnerF(e.target.value); setPage(0); }}>
            <option value="">All employees</option>{data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Sort" className={sel} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="new">Newest first</option><option value="old">Oldest first</option><option value="high">Highest value</option>
            <option value="low">Lowest value</option><option value="close">Closing soonest</option>
          </select>
        </Card>
      )}
      <Card className="p-5">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading deals…</p>
          : error ? <EmptyState title="Could not load deals" hint={(error as Error).message} />
          : view === "table" ? <>
            <DataTable columns={["No.", "Deal Name", "Customer", "Stage", "Value", "Expected Close", "Assignee", "Company", "Status", "Actions"]} minWidth={1300}>
              {shown.map((d, i) => { const st = data!.dealStages.find((s) => s.id === d.stage_id);
                return (
                  <tr key={d.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground">{page * PAGE + i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{d.title}</td>
                    <td className="px-4 py-3">{leadName(d.lead_id)}</td>
                    <td className="px-4 py-3">{st ? <span className="rounded px-2 py-1 text-xs font-semibold" style={{ background: `${st.color}22`, color: st.color }}>{st.name}</span> : "—"}</td>
                    <td className="px-4 py-3 font-semibold">{inr(Number(d.amount))}</td>
                    <td className="px-4 py-3">{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3">{nameOf(data!.people, d.assigned_to, "Unassigned")}</td>
                    <td className="px-4 py-3">{nameOf(data!.companies, d.company_id)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={d.status === "won" ? "green" : d.status === "lost" ? "red" : "blue"}>{d.status}</StatusBadge></td>
                    <td className="px-4 py-3">{actions(d)}</td>
                  </tr>
                ); })}
            </DataTable>
            {rows.length === 0 ? <EmptyState title="No deals" hint="Create a deal to start tracking your pipeline." /> : (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Showing {page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length}</span>
                <div className="flex gap-2">
                  <ToolbarButton onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</ToolbarButton>
                  <span className="self-center">Page {page + 1} / {pages}</span>
                  <ToolbarButton onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</ToolbarButton>
                </div>
              </div>
            )}
          </> : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data!.dealStages.filter((s) => s.is_active).map((s) => { const col = rows.filter((d) => d.stage_id === s.id);
                return (
                  <div key={s.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => moveStage(e.dataTransfer.getData("id"), s.id)}
                    className="w-72 shrink-0 rounded-lg border bg-muted/40 p-3">
                    <div className="mb-3 flex items-center justify-between border-b-2 pb-2" style={{ borderColor: s.color }}>
                      <span className="font-semibold">{s.name} ({col.length})</span>
                      <span className="text-xs text-muted-foreground">{inr(col.reduce((t, d) => t + Number(d.amount), 0))}</span>
                    </div>
                    <div className="min-h-24 space-y-2">
                      {col.map((d) => (
                        <div key={d.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", d.id)} className="cursor-grab rounded-md border bg-card p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2"><p className="font-semibold">{d.title}</p>{actions(d)}</div>
                          <p className="text-sm text-muted-foreground">{leadName(d.lead_id)}</p>
                          <p className="mt-1 font-semibold text-admin-blue">{inr(Number(d.amount))}</p>
                          <p className="text-xs text-muted-foreground">{nameOf(data!.people, d.assigned_to, "Unassigned")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ); })}
            </div>
          )}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Deal" : "Create Deal"}</DialogTitle></DialogHeader>
          {form && data && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">Deal Name *
                <input maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" /></label>
              <label className="text-sm font-semibold">Deal Value (INR) *
                <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" /></label>
              <label className="text-sm font-semibold">Expected Closing Date
                <input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" /></label>
              {([["stage_id", "Stage", data.dealStages.filter((s) => s.is_active || s.id === form.stage_id)],
                ["lead_id", "Customer / Lead", data.leads.map((l) => ({ id: l.id, name: `${l.customer_name} (${l.phone})` }))],
                ["assigned_to", "Assigned Employee", data.people.filter((p) => p.is_active || p.id === form.assigned_to)],
                ["company_id", "Company", data.companies], ["contract_type_id", "Contract Type", data.contractTypes]] as const).map(([k, lbl, list]) => (
                <label key={k} className="text-sm font-semibold">{lbl}
                  <select value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-card px-3 font-normal">
                    <option value="">— None —</option>{list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select></label>
              ))}
              <label className="text-sm font-semibold">Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-card px-3 font-normal">
                  <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select></label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <ToolbarButton onClick={() => setForm(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={save}><Save className="size-4" />Save Deal</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete “{del?.title}”?</AlertDialogTitle><AlertDialogDescription>This deal will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-admin-red" onClick={async () => { const { error } = await db.from("deals").delete().eq("id", del!.id); if (error) toast.error(error.message); else { toast.success("Deal deleted"); refresh(); } setDel(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
