import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, CheckCircle2, Clock, Copy, Eye, GitBranch, Inbox, MoreVertical, Pause, Pencil, Play, Plus, SlidersHorizontal, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminHead } from "@/lib/admin-head";
import { WF_NODE_TYPES, WF_TRIGGERS, nodeLabel, triggerLabel, validateWorkflow, type NodeType, type WfNode } from "@/lib/wa-workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/workflows")({
  head: () => adminHead("WhatsApp Workflows", "Build and manage automated WhatsApp workflows."),
  component: WorkflowsPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["wa-workflows"];
type Wf = { id: string; name: string; description: string; trigger: string; nodes: WfNode[]; status: "draft" | "active" | "paused"; updated_at: string };
type Draft = { id?: string; name: string; description: string; trigger: string; nodes: WfNode[]; status: Wf["status"] };
const uid = () => Math.random().toString(36).slice(2, 9);

function Kpi({ icon: Icon, tone, chip, label, value, note }: { icon: typeof Zap; tone: string; chip: string; label: string; value: string | number; note: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between"><span className={cn("grid size-11 place-items-center rounded-lg text-primary-foreground", `bg-${tone}`)}><Icon className="size-5" /></span>
        <span className={cn("rounded px-2.5 py-1 text-xs font-semibold", `text-${tone}`, `bg-${tone}/10`)}>{chip}</span></div>
      <p className="mt-4 font-semibold">{label}</p><p className={cn("text-3xl font-bold", `text-${tone}`)}>{value}</p><p className="text-sm text-muted-foreground">{note}</p>
    </Card>
  );
}

function WorkflowsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: QK, queryFn: async () => { const r = await db.from("wa_workflows").select("*").order("updated_at", { ascending: false }); if (r.error) throw r.error; return r.data as Wf[]; } });
  const templates = useQuery({ queryKey: ["wa-templates"], queryFn: async () => { const r = await db.from("whatsapp_templates").select("id,name,status"); if (r.error) throw r.error; return r.data as { id: string; name: string; status: string }[]; } }).data ?? [];
  const waConnected = useQuery({ queryKey: ["integration", "whatsapp"], queryFn: async () => { const r = await db.from("integration_settings").select("status").eq("key", "whatsapp").maybeSingle(); return r.data?.status === "connected"; } }).data ?? false;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [view, setView] = useState<Wf | null>(null);
  const [del, setDel] = useState<Wf | null>(null);
  const [guide, setGuide] = useState(false);
  const list = useMemo(() => data.filter((w) => (status === "all" || w.status === status) && (!q || `${w.name} ${w.description}`.toLowerCase().includes(q.toLowerCase()))), [data, q, status]);
  const refresh = () => qc.invalidateQueries({ queryKey: QK });
  const tplIds = templates.map((t) => t.id);

  const persist = async (d: Draft, nextStatus: Wf["status"]) => {
    if (!d.name.trim()) { toast.error("Workflow name is required"); return false; }
    if (nextStatus === "active") {
      const errs = validateWorkflow(d, tplIds);
      if (errs.length) { toast.error(errs[0]!); return false; }
    }
    const payload = { name: d.name.trim().slice(0, 120), description: d.description.trim().slice(0, 500), trigger: d.trigger, nodes: d.nodes, status: nextStatus };
    const r = d.id ? await db.from("wa_workflows").update(payload).eq("id", d.id).select("id").single() : await db.from("wa_workflows").insert(payload).select("id").single();
    if (r.error) { toast.error(r.error.message); return false; }
    toast.success(nextStatus === "active" ? "Workflow activated — it will run once WhatsApp is connected" : nextStatus === "paused" ? "Workflow paused" : "Draft saved");
    refresh(); return true;
  };
  const setWfStatus = async (w: Wf, s: Wf["status"]) => { await persist({ ...w }, s); };
  const duplicate = async (w: Wf) => {
    const { error } = await db.from("wa_workflows").insert({ name: `${w.name} (copy)`.slice(0, 120), description: w.description, trigger: w.trigger, nodes: w.nodes, status: "draft" });
    if (error) { toast.error(error.message); return; } toast.success("Workflow duplicated"); refresh();
  };
  const remove = async () => { if (!del) return; const { error } = await db.from("wa_workflows").delete().eq("id", del.id); if (error) { toast.error(error.message); return; } toast.success("Workflow deleted"); setDel(null); refresh(); };
  const tone = (s: string) => s === "active" ? "green" : s === "paused" ? "orange" : "gray";

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["WhatsApp"]} label="Workflows" />
      <PageHeader title={`WhatsApp Visual Workflows (${data.length})`} subtitle="Build and manage automated WhatsApp workflows.">
        <ToolbarButton primary onClick={() => setEdit({ name: "", description: "", trigger: "lead_created", nodes: [{ id: uid(), type: "end", config: {}, next: null }], status: "draft" })}><Plus className="size-4" />Create Workflow</ToolbarButton>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={SlidersHorizontal} tone="admin-blue" chip="All Workflows" label="Total Workflows" value={data.length} note="Saved Workflows" />
        <Kpi icon={CheckCircle2} tone="admin-green" chip="Active" label="Active Workflows" value={data.filter((w) => w.status === "active").length} note={waConnected ? "Running live" : "Enabled — waiting for WhatsApp"} />
        <Kpi icon={Clock} tone="admin-orange" chip="Draft" label="Draft Workflows" value={data.filter((w) => w.status === "draft").length} note="In Development" />
        <Kpi icon={Zap} tone="admin-purple" chip="Triggers" label="Automated Triggers" value={new Set(data.filter((w) => w.status === "active").map((w) => w.trigger)).size} note={waConnected ? "Distinct live triggers" : "Execution needs WhatsApp connection"} />
      </div>
      {!waConnected && <p className="flex items-center gap-2 rounded-lg border border-admin-orange/30 bg-admin-orange/10 px-4 py-3 text-sm text-warning"><AlertTriangle className="size-4" />WhatsApp Business API is not connected. You can build and save workflows; nothing is sent until the connection is set up in Integrations.</p>}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <SearchInput placeholder="Search workflows by name or description" value={q} onChange={setQ} className="w-80" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="inp w-44"><option value="all">All Status</option><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option></select>
          <ToolbarButton onClick={() => setGuide(true)} className="ml-auto border-admin-green/40 text-success"><BookOpen className="size-4" />Follow-up Playbook & Guide</ToolbarButton>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[15px]">
            <thead><tr className="border-b bg-muted/60 text-sm uppercase tracking-wide">{["Workflow Name", "Trigger Event", "Nodes", "Status", "Last Updated", "Actions"].map((c) => <th key={c} className="px-4 py-4 font-semibold">{c}</th>)}</tr></thead>
            <tbody className="divide-y">
              {list.map((w) => <tr key={w.id} className="hover:bg-muted/40">
                <td className="px-4 py-4"><p className="font-semibold">{w.name}</p><p className="max-w-sm truncate text-sm text-muted-foreground">{w.description}</p></td>
                <td className="px-4 py-4">{triggerLabel(w.trigger)}</td><td className="px-4 py-4">{w.nodes.length}</td>
                <td className="px-4 py-4"><StatusBadge tone={tone(w.status)}>{w.status.toUpperCase()}</StatusBadge></td>
                <td className="px-4 py-4 text-muted-foreground">{new Date(w.updated_at).toLocaleString()}</td>
                <td className="px-4 py-4"><DropdownMenu><DropdownMenuTrigger aria-label={`Actions for ${w.name}`} className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setView(w)}><Eye className="size-4" />View</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEdit({ ...w, nodes: structuredClone(w.nodes) })}><Pencil className="size-4" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicate(w)}><Copy className="size-4" />Duplicate</DropdownMenuItem>
                    {w.status === "active" ? <DropdownMenuItem onClick={() => setWfStatus(w, "paused")}><Pause className="size-4" />Pause</DropdownMenuItem> : <DropdownMenuItem onClick={() => setWfStatus(w, "active")}><Play className="size-4" />Activate</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => setDel(w)} className="text-admin-red"><Trash2 className="size-4" />Delete</DropdownMenuItem>
                  </DropdownMenuContent></DropdownMenu></td>
              </tr>)}
            </tbody>
          </table>
          {!isLoading && list.length === 0 && <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground"><Inbox className="size-14 text-border" strokeWidth={1.2} />No data</div>}
        </div>
      </Card>

      {edit && <Builder draft={edit} templates={templates} onClose={() => setEdit(null)} onSave={async (d, s) => { if (await persist(d, s)) setEdit(null); }} onDelete={edit.id ? () => { const w = data.find((x) => x.id === edit.id); if (w) { setEdit(null); setDel(w); } } : undefined} />}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{view?.name}</DialogTitle></DialogHeader>
          {view && <div className="space-y-2 text-sm"><p className="text-muted-foreground">{view.description || "No description"}</p><p><b>Trigger:</b> {triggerLabel(view.trigger)}</p>
            <ol className="space-y-1">{view.nodes.map((n, i) => <li key={n.id} className="rounded border px-3 py-2">{i + 1}. {nodeLabel(n.type)}{n.type === "condition" && ` — if ${n.config["field"]} = ${n.config["value"]}`}</li>)}</ol>
            {(() => { const e = validateWorkflow(view, tplIds); return e.length ? <p className="text-admin-red">{e.length} validation issue(s): {e[0]}</p> : <p className="text-success">Workflow is valid.</p>; })()}</div>}
        </DialogContent></Dialog>
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Follow-up Playbook & Guide</DialogTitle></DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Pick a trigger such as <b>New Lead Created</b>.</li><li>Add a <b>Send WhatsApp Template</b> step using an approved template.</li>
            <li>Add <b>Wait / Delay</b> (e.g. 1440 minutes = 1 day), then a <b>Condition</b> like "replied = no".</li>
            <li>Connect the Yes branch to <b>End</b> and the No branch to a reminder template or <b>Notify Employee</b>.</li>
            <li>Click <b>Validate</b>, then <b>Activate</b>. Messages send only after WhatsApp Business is connected and templates are approved by Meta.</li>
            <li>Lead assignment stays with Ad Lead Routing; the Assign Lead step only fills in leads that routing left unassigned.</li>
          </ol></DialogContent></Dialog>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete “{del?.name}”?</AlertDialogTitle><AlertDialogDescription>This removes the workflow and all of its steps.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Builder({ draft, templates, onClose, onSave, onDelete }: { draft: Draft; templates: { id: string; name: string }[]; onClose: () => void; onSave: (d: Draft, s: Wf["status"]) => void; onDelete?: (() => void) | undefined }) {
  const [d, setD] = useState<Draft>(draft);
  const [addType, setAddType] = useState<NodeType>("send_template");
  const [errors, setErrors] = useState<string[] | null>(null);
  const setNode = (id: string, p: Partial<WfNode>) => setD({ ...d, nodes: d.nodes.map((n) => n.id === id ? { ...n, ...p } : n) });
  const setCfg = (id: string, k: string, v: string) => setD({ ...d, nodes: d.nodes.map((n) => n.id === id ? { ...n, config: { ...n.config, [k]: v } } : n) });
  const add = () => {
    const n: WfNode = { id: uid(), type: addType, config: {}, next: null, ...(addType === "condition" ? { no: null } : {}) };
    // Insert before the last End step and auto-connect the previous step to it.
    const nodes = [...d.nodes]; const endIdx = nodes.findIndex((x) => x.type === "end");
    const at = endIdx === -1 ? nodes.length : endIdx;
    const prev = nodes[at - 1]; const end = nodes[endIdx];
    if (end && n.type !== "end") n.next = end.id;
    if (prev && prev.type !== "end" && (!prev.next || prev.next === end?.id)) nodes[at - 1] = { ...prev, next: n.id };
    nodes.splice(at, 0, n); setD({ ...d, nodes }); setErrors(null);
  };
  const removeNode = (id: string) => setD({ ...d, nodes: d.nodes.filter((n) => n.id !== id).map((n) => ({ ...n, next: n.next === id ? null : n.next, no: n.no === id ? null : n.no })) });
  const move = (i: number, dir: -1 | 1) => { const nodes = [...d.nodes]; const j = i + dir; if (j < 0 || j >= nodes.length) return; [nodes[i], nodes[j]] = [nodes[j]!, nodes[i]!]; setD({ ...d, nodes }); };
  const options = (self: string) => d.nodes.filter((n) => n.id !== self).map((n) => <option key={n.id} value={n.id}>Step {d.nodes.indexOf(n) + 1}: {nodeLabel(n.type)}</option>);
  const validate = () => { const e = validateWorkflow(d, templates.map((t) => t.id)); setErrors(e); if (!e.length) toast.success("Workflow is valid"); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
        <div className="flex items-center justify-between bg-admin-blue px-6 py-4 text-primary-foreground"><div><DialogTitle className="text-xl">{d.id ? "Edit Workflow" : "Create Workflow"}</DialogTitle><p className="text-sm opacity-90">Visual WhatsApp workflow builder</p></div></div>
        <div className="grid max-h-[calc(92vh-150px)] gap-0 overflow-y-auto md:grid-cols-[300px_1fr]">
          <aside className="space-y-3 border-r p-5">
            <label className="grid gap-1 text-sm font-medium">Workflow name<input className="inp" value={d.name} maxLength={120} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Description<textarea className="inp h-20 py-2" value={d.description} maxLength={500} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Trigger<select className="inp" value={d.trigger} onChange={(e) => setD({ ...d, trigger: e.target.value })}>{WF_TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <div className="grid gap-1 text-sm font-medium">Add step<div className="flex gap-2"><select className="inp" value={addType} onChange={(e) => setAddType(e.target.value as NodeType)}>{WF_NODE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select><ToolbarButton primary onClick={add}><Plus className="size-4" /></ToolbarButton></div></div>
            {errors && (errors.length ? <ul className="space-y-1 rounded-md bg-admin-red/10 p-3 text-xs text-admin-red">{errors.map((e) => <li key={e}>• {e}</li>)}</ul> : <p className="rounded-md bg-admin-green/15 p-3 text-xs text-success">All connections are complete.</p>)}
          </aside>
          <div className="min-h-[420px] bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] p-6 [background-size:18px_18px]">
            <div className="mx-auto max-w-md space-y-0">
              <div className="rounded-xl border-2 border-admin-purple bg-card p-3 text-center shadow-card"><Zap className="mx-auto size-4 text-admin-purple" /><p className="text-xs uppercase text-muted-foreground">Trigger</p><p className="font-semibold">{triggerLabel(d.trigger)}</p></div>
              {d.nodes.map((n, i) => (
                <div key={n.id}>
                  <div className="mx-auto h-6 w-px bg-border" />
                  <div className={cn("rounded-xl border bg-card p-3 shadow-card", n.type === "end" && "border-admin-red/40", n.type === "condition" && "border-admin-orange/50")}>
                    <div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded bg-admin-blue/10 text-xs font-bold text-admin-blue">{i + 1}</span>
                      <select className="flex-1 bg-transparent font-semibold outline-none" value={n.type} onChange={(e) => setNode(n.id, { type: e.target.value as NodeType, config: {}, ...(e.target.value === "condition" ? { no: null } : { no: undefined }) })}>{WF_NODE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                      <button aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button><button aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                      <button aria-label="Remove step" onClick={() => removeNode(n.id)}><X className="size-4 text-admin-red" /></button></div>
                    <div className="mt-2 grid gap-2 text-sm">
                      {n.type === "send_template" && <select className="inp" value={n.config["template_id"] ?? ""} onChange={(e) => setCfg(n.id, "template_id", e.target.value)}><option value="">Select template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                      {n.type === "wait" && <input className="inp" type="number" min={1} placeholder="Delay in minutes" value={n.config["minutes"] ?? ""} onChange={(e) => setCfg(n.id, "minutes", e.target.value)} />}
                      {n.type === "condition" && <div className="flex gap-2"><select className="inp" value={n.config["field"] ?? ""} onChange={(e) => setCfg(n.id, "field", e.target.value)}><option value="">Field…</option><option value="replied">Customer replied</option><option value="lead_status">Lead status</option><option value="interest_level">Interest level</option></select><input className="inp" placeholder="equals…" value={n.config["value"] ?? ""} onChange={(e) => setCfg(n.id, "value", e.target.value)} /></div>}
                      {n.type === "update_lead_status" && <select className="inp" value={n.config["status"] ?? ""} onChange={(e) => setCfg(n.id, "status", e.target.value)}><option value="">Status…</option>{["open", "contacted", "qualified", "won", "lost"].map((s) => <option key={s}>{s}</option>)}</select>}
                      {(n.type === "notify_employee" || n.type === "create_followup") && <input className="inp" placeholder={n.type === "notify_employee" ? "Notification message" : "Follow-up note"} value={n.config["message"] ?? ""} onChange={(e) => setCfg(n.id, "message", e.target.value)} />}
                      {n.type === "assign_lead" && <p className="text-xs text-muted-foreground">Only applies when Ad Lead Routing left the lead unassigned.</p>}
                      {n.type !== "end" && <label className="flex items-center gap-2 text-xs">{n.type === "condition" ? <><GitBranch className="size-3 text-success" />Yes →</> : "Next →"}<select className="inp h-8" value={n.next ?? ""} onChange={(e) => setNode(n.id, { next: e.target.value || null })}><option value="">Not connected</option>{options(n.id)}</select></label>}
                      {n.type === "condition" && <label className="flex items-center gap-2 text-xs"><GitBranch className="size-3 text-admin-red" />No →<select className="inp h-8" value={n.no ?? ""} onChange={(e) => setNode(n.id, { no: e.target.value || null })}><option value="">Not connected</option>{options(n.id)}</select></label>}
                    </div>
                  </div>
                </div>))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
          {onDelete && <ToolbarButton onClick={onDelete} className="mr-auto text-admin-red"><Trash2 className="size-4" />Delete</ToolbarButton>}
          <ToolbarButton onClick={validate}>Validate</ToolbarButton>
          <ToolbarButton onClick={() => onSave(d, "draft")}>Save Draft</ToolbarButton>
          {d.status === "active" ? <ToolbarButton onClick={() => onSave(d, "paused")}><Pause className="size-4" />Pause</ToolbarButton> : <ToolbarButton primary onClick={() => onSave(d, "active")}><Play className="size-4" />Activate</ToolbarButton>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
