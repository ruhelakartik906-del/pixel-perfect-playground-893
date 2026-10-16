import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Clock, Eye, Filter, Pause, Pencil, Play, Plus, RotateCcw,
  Rocket, Trash2, X, Zap, PlayCircle, PauseCircle, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  actionMeta, ASSIGN_RESPECTS_ROUTING_NOTE, missingDefaults, triggerLabels, workflowStats,
  type ActionType, type Condition, type Trigger, type Workflow, type WorkflowAction,
} from "@/lib/automation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/crm/automation")({
  head: () => ({ meta: [
    { title: "CRM Automations — Routiva CRM Admin" },
    { name: "description", content: "Design and manage CRM automation workflows." },
    { property: "og:title", content: "CRM Automations — Routiva CRM Admin" },
    { property: "og:description", content: "Design and manage CRM automation workflows." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AutomationPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["automation"];

async function load() {
  const [w, e] = await Promise.all([
    db.from("automation_workflows").select("*").order("created_at", { ascending: true }),
    db.from("automation_executions").select("workflow_id,status,created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  if (w.error) throw w.error;
  if (e.error) throw e.error;
  return { workflows: (w.data ?? []) as Workflow[], executions: (e.data ?? []) as { workflow_id: string; status: string; created_at: string }[] };
}

type Draft = Omit<Workflow, "id" | "created_at" | "is_default"> & { id?: string };
const emptyDraft = (): Draft => ({ name: "", description: "", trigger: "lead_created", conditions: [], actions: [{ type: "create_task", delayHours: 0, note: "" }], status: "paused" });

function AutomationPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<Workflow | null>(null);
  const [del, setDel] = useState<Workflow | null>(null);
  const [reset, setReset] = useState(false);
  const [howTo, setHowTo] = useState(false);

  const done = (msg: string) => { qc.invalidateQueries({ queryKey: QK }); toast.success(msg); };
  const fail = (e: { message?: string }) => toast.error(e.message?.includes("row-level") ? "You don't have permission for this action." : e.message ?? "Something went wrong");

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const { id, ...row } = d;
      const r = id ? await db.from("automation_workflows").update(row).eq("id", id) : await db.from("automation_workflows").insert(row);
      if (r.error) throw r.error;
    },
    onSuccess: () => { setDraft(null); done("Workflow saved"); }, onError: fail,
  });
  const toggle = useMutation({
    mutationFn: async (w: Workflow) => { const r = await db.from("automation_workflows").update({ status: w.status === "active" ? "paused" : "active" }).eq("id", w.id); if (r.error) throw r.error; },
    onSuccess: () => done("Status updated"), onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const r = await db.from("automation_workflows").delete().eq("id", id); if (r.error) throw r.error; },
    onSuccess: () => { setDel(null); done("Workflow deleted"); }, onError: fail,
  });
  const genDefaults = useMutation({
    mutationFn: async () => {
      const rows = missingDefaults((data?.workflows ?? []).map((w) => w.name));
      if (!rows.length) return 0;
      const r = await db.from("automation_workflows").insert(rows); if (r.error) throw r.error; return rows.length;
    },
    onSuccess: (n) => n ? done(`${n} default workflow(s) added`) : toast.info("All default workflows already exist"), onError: fail,
  });
  const resetDefaults = useMutation({
    mutationFn: async () => {
      // Only system defaults are removed and re-created; custom workflows stay untouched.
      const r = await db.from("automation_workflows").delete().eq("is_default", true); if (r.error) throw r.error;
      const rows = missingDefaults((data?.workflows ?? []).filter((w) => !w.is_default).map((w) => w.name));
      const i = await db.from("automation_workflows").insert(rows); if (i.error) throw i.error;
    },
    onSuccess: () => { setReset(false); done("Default workflows reset"); }, onError: fail,
  });

  const wfs = data?.workflows ?? [];
  const execs = data?.executions ?? [];
  const s = workflowStats(wfs, execs);

  return (
    <div className="space-y-5">
      <Breadcrumb label="CRM / Automation" />
      <div className="rounded-xl border bg-card px-5 py-3 shadow-card">
        <h1 className="text-2xl font-bold">CRM Automations ({wfs.length})</h1>
        <p className="text-[15px] text-muted-foreground">Automate repetitive tasks and streamline your lead management workflow.</p>
      </div>

      <section className="rounded-xl border bg-admin-blue/5 p-6 shadow-card md:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-admin-blue text-primary-foreground shadow-cta"><Rocket className="size-7" /></span>
            <div>
              <h2 className="text-2xl font-bold text-admin-blue">CRM Automation Hub</h2>
              <p className="text-muted-foreground">Design intelligent workflows to manage your leads automatically.</p>
            </div>
          </div>
          <ToolbarButton onClick={() => setHowTo(true)} className="border-admin-blue/30 text-admin-blue"><Rocket className="size-4" />How to Setup</ToolbarButton>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { n: "1. TRIGGER", I: Zap, c: "text-admin-orange", t: "Events such as new leads, form submissions or stage changes." },
            { n: "2. FILTER", I: Filter, c: "text-success", t: "Filter by lead stage, source, priority, campaign or assigned user." },
            { n: "3. ACTIONS", I: Plus, c: "text-admin-blue", t: "Automatically create tasks, assign users, send authorized messages or update records." },
            { n: "4. INTELLIGENCE", I: Clock, c: "text-admin-purple", t: "Configure delays, conditions and stop rules." },
          ].map(({ n, I, c, t }) => (
            <div key={n} className="rounded-xl border bg-card p-5">
              <p className={cn("flex items-center gap-2 text-sm font-bold tracking-wide", c)}><I className="size-5" />{n}</p>
              <p className="mt-3 text-[15px] text-muted-foreground">{t}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { l: "Active Workflows", v: s.active, I: Rocket, bg: "bg-admin-blue", soft: "bg-admin-blue/5" },
          { l: "Paused Workflows", v: s.paused, I: PauseCircle, bg: "bg-admin-red", soft: "bg-admin-red/5" },
          { l: "Custom Workflows", v: s.custom, I: Zap, bg: "bg-admin-purple", soft: "bg-admin-purple/5" },
          { l: "Total Executions", v: s.executions, I: PlayCircle, bg: "bg-admin-green", soft: "bg-admin-green/5" },
          { l: "Workflow Success Rate", v: s.successRate === null ? "—" : `${s.successRate}%`, I: Zap, bg: "bg-admin-orange", soft: "bg-admin-orange/5" },
        ].map(({ l, v, I, bg, soft }) => (
          <div key={l} className={cn("flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card", soft)}>
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-lg text-primary-foreground", bg)}><I className="size-5" /></span>
            <div><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-bold">{isLoading ? "…" : v}</p></div>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-bold">Automation Workflows</h2>
          <div className="flex flex-wrap gap-2.5">
            <ToolbarButton primary onClick={() => setDraft(emptyDraft())}><Plus className="size-4" />New Workflow</ToolbarButton>
            <ToolbarButton onClick={() => genDefaults.mutate()}><Wand2 className="size-4" />Generate Defaults</ToolbarButton>
            <ToolbarButton onClick={() => setReset(true)} className="border-admin-red/30 bg-admin-red/5 text-admin-red hover:bg-admin-red/10"><RotateCcw className="size-4" />Reset Defaults</ToolbarButton>
          </div>
        </div>
        <div className="p-6">
          <DataTable columns={["Workflow Name", "Trigger", "Conditions", "Workflow Sequence", "Performance & Usage", "Status", "Actions"]} minWidth={1250}>
            {wfs.map((w) => {
              const mine = execs.filter((e) => e.workflow_id === w.id);
              return (
                <tr key={w.id} className="align-middle hover:bg-muted/40">
                  <td className="max-w-64 px-4 py-5">
                    <p className="flex items-start gap-2 font-semibold"><Zap className="mt-1 size-4 shrink-0 text-admin-purple" />{w.name}</p>
                    {w.description && <p className="ml-6 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>}
                  </td>
                  <td className="px-4"><span className="whitespace-nowrap rounded bg-admin-purple/10 px-2 py-1 text-xs font-bold text-admin-purple">{triggerLabels[w.trigger]}</span></td>
                  <td className="px-4">{w.conditions.length ? (
                    <div className="flex flex-wrap gap-1">{w.conditions.map((c, i) => <span key={i} className="rounded bg-admin-green/15 px-2 py-1 text-xs text-success">{c.field} {c.op} {c.value}</span>)}</div>
                  ) : <span className="text-muted-foreground">No Conditions</span>}</td>
                  <td className="px-4"><Sequence actions={w.actions} /></td>
                  <td className="px-4">
                    <p className="font-semibold">{mine.length} Runs {!mine.length && <span className="ml-1 rounded bg-admin-blue/10 px-2 py-0.5 text-xs text-admin-blue">FRESH</span>}</p>
                    <p className="text-sm italic text-muted-foreground">{mine[0] ? `Last: ${new Date(mine[0].created_at).toLocaleString()}` : "Never executed"}</p>
                  </td>
                  <td className="px-4"><Switch checked={w.status === "active"} onCheckedChange={() => toggle.mutate(w)} aria-label="Toggle status" /></td>
                  <td className="px-4">
                    <div className="flex items-center gap-3">
                      <button aria-label="View" onClick={() => setView(w)} className="text-admin-blue"><Eye className="size-5" /></button>
                      <button aria-label="Edit" onClick={() => setDraft({ id: w.id, name: w.name, description: w.description, trigger: w.trigger, conditions: w.conditions, actions: w.actions, status: w.status })}><Pencil className="size-5" /></button>
                      <button aria-label={w.status === "active" ? "Pause" : "Resume"} onClick={() => toggle.mutate(w)} className={w.status === "active" ? "text-warning" : "text-success"}>{w.status === "active" ? <Pause className="size-5" /> : <Play className="size-5" />}</button>
                      <button aria-label="Delete" onClick={() => setDel(w)} className="text-admin-red"><Trash2 className="size-5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
          {isLoading && <p className="py-10 text-center text-muted-foreground">Loading workflows…</p>}
          {error && <p className="py-10 text-center text-admin-red">Couldn't load workflows. You may not have admin permission.</p>}
          {!isLoading && !error && !wfs.length && <EmptyState title="No workflows yet" hint="Create one or click Generate Defaults to add starter workflows (they start paused)." />}
        </div>
      </Card>

      {draft && <Builder draft={draft} onClose={() => setDraft(null)} onSave={(d) => save.mutate(d)} saving={save.isPending} />}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{view?.name}</DialogTitle></DialogHeader>
          {view && <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{view.description || "No description"}</p>
            <p><b>Trigger:</b> {triggerLabels[view.trigger]}</p>
            <p><b>Status:</b> {view.status}</p>
            <Sequence actions={view.actions} />
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={howTo} onOpenChange={setHowTo}>
        <DialogContent>
          <DialogHeader><DialogTitle>How to set up a workflow</DialogTitle></DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Click <b>New Workflow</b> and pick the event that starts it.</li>
            <li>Add conditions to narrow which leads it applies to.</li>
            <li>Add actions in order, with optional delays between them.</li>
            <li>Switch it on. Actions marked "Needs integration" won't run until that service is connected.</li>
            <li>Ad Lead Routing always decides lead ownership first; Assign steps only touch unassigned leads.</li>
          </ol>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{del?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the workflow and its run history.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del && remove.mutate(del.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reset default workflows?</AlertDialogTitle>
            <AlertDialogDescription>System default workflows will be restored to their original settings. Your custom workflows are not affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetDefaults.mutate()}>Reset</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Sequence({ actions }: { actions: WorkflowAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="size-3.5 text-muted-foreground" />}
          <span title={actionMeta[a.type].needsIntegration ? "Needs integration — not executed yet" : a.note}
            className={cn("rounded-md border bg-card px-2 py-1 text-center text-[11px] font-bold", actionMeta[a.type].needsIntegration ? "text-warning" : "text-admin-blue")}>
            {actionMeta[a.type].label}
            {a.delayHours > 0 && <span className="block font-normal text-muted-foreground">⏱ {a.delayHours}h</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

const field = "h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30";

function Builder({ draft, onClose, onSave, saving }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => void; saving: boolean }) {
  const [d, setD] = useState<Draft>(draft);
  const [err, setErr] = useState("");
  const setA = (i: number, p: Partial<WorkflowAction>) => setD({ ...d, actions: d.actions.map((a, j) => j === i ? { ...a, ...p } : a) });
  const setC = (i: number, p: Partial<Condition>) => setD({ ...d, conditions: d.conditions.map((c, j) => j === i ? { ...c, ...p } : c) });
  const move = (i: number, dir: -1 | 1) => { const a = [...d.actions]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; setD({ ...d, actions: a }); };
  const submit = () => {
    const name = d.name.trim();
    if (!name || name.length > 120) return setErr("Name is required (max 120 characters).");
    if (!d.actions.length) return setErr("Add at least one action.");
    if (d.actions.some((a) => a.delayHours < 0 || a.delayHours > 720)) return setErr("Delays must be between 0 and 720 hours.");
    onSave({ ...d, name, description: d.description.trim().slice(0, 500) });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{d.id ? "Edit Workflow" : "New Workflow"}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <label className="block space-y-1"><span className="font-semibold">Workflow Name *</span><input className={field} value={d.name} maxLength={120} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
          <label className="block space-y-1"><span className="font-semibold">Description</span><textarea className={cn(field, "h-20 py-2")} maxLength={500} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1"><span className="font-semibold">Trigger</span>
              <select className={field} value={d.trigger} onChange={(e) => setD({ ...d, trigger: e.target.value as Trigger })}>
                {Object.entries(triggerLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="block space-y-1"><span className="font-semibold">Status</span>
              <select className={field} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as Draft["status"] })}>
                <option value="paused">Paused</option><option value="active">Active</option>
              </select></label>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Conditions</span>
              <button className="text-admin-blue" onClick={() => setD({ ...d, conditions: [...d.conditions, { field: "source", op: "equals", value: "" }] })}>+ Add condition</button></div>
            {d.conditions.map((c, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <select className={field} value={c.field} onChange={(e) => setC(i, { field: e.target.value })}>
                  {["stage", "source", "priority", "campaign", "assigned_user"].map((f) => <option key={f}>{f}</option>)}</select>
                <select className={field} value={c.op} onChange={(e) => setC(i, { op: e.target.value })}><option>equals</option><option>not equals</option></select>
                <input className={field} value={c.value} maxLength={80} onChange={(e) => setC(i, { value: e.target.value })} placeholder="Value" />
                <button aria-label="Remove condition" onClick={() => setD({ ...d, conditions: d.conditions.filter((_, j) => j !== i) })}><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Actions (in order)</span>
              <button className="text-admin-blue" onClick={() => setD({ ...d, actions: [...d.actions, { type: "notify", delayHours: 0, note: "" }] })}>+ Add action</button></div>
            {d.actions.map((a, i) => (
              <div key={i} className="mb-2 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <select className={field} value={a.type} onChange={(e) => setA(i, { type: e.target.value as ActionType })}>
                    {Object.entries(actionMeta).map(([k, v]) => <option key={k} value={k}>{v.label}{v.needsIntegration ? " (needs integration)" : ""}</option>)}</select>
                  <input type="number" min={0} max={720} step={0.25} className={cn(field, "w-28")} value={a.delayHours} onChange={(e) => setA(i, { delayHours: Number(e.target.value) })} aria-label="Delay hours" />
                  <span className="text-muted-foreground">h</span>
                  <button aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                  <button aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                  <button aria-label="Remove action" onClick={() => setD({ ...d, actions: d.actions.filter((_, j) => j !== i) })}><X className="size-4" /></button>
                </div>
                <input className={cn(field, "mt-2")} placeholder="Note (template, task title…)" maxLength={200} value={a.note} onChange={(e) => setA(i, { note: e.target.value })} />
                {a.type === "assign" && <p className="mt-1 text-xs text-warning">{ASSIGN_RESPECTS_ROUTING_NOTE}</p>}
              </div>
            ))}
          </div>
          {err && <p className="text-admin-red">{err}</p>}
          <div className="flex justify-end gap-2">
            <ToolbarButton onClick={onClose}>Cancel</ToolbarButton>
            <ToolbarButton primary onClick={submit}><CheckCircle2 className="size-4" />{saving ? "Saving…" : "Save Workflow"}</ToolbarButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
