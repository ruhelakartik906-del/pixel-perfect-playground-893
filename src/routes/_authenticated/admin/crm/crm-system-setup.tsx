import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, Columns3, FileSignature, Folder, GitBranch, Layers, ListChecks, Pencil, Plus, Radio, Save, Tag, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { canDelete, dealColumnCatalog, leadColumnCatalog, moveItem, type OptionCategory, type StageKind } from "@/lib/crm-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/crm/crm-system-setup")({
  head: () => ({ meta: [
    { title: "CRM System Setup — Routiva CRM Admin" },
    { name: "description", content: "Configure pipelines, stages, sources, tags and list views." },
    { property: "og:title", content: "CRM System Setup — Routiva CRM Admin" },
    { property: "og:description", content: "Configure pipelines, stages, sources, tags and list views." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SetupPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["crm-setup"];

type Item = { id: string; name: string; color?: string; position: number; is_active: boolean; is_default?: boolean; pipeline_id?: string; kind?: string; category?: string };
type Section = "pipeline" | "lead_stages" | "deal_stages" | OptionCategory | "list_view";

const menu: { id: Section; label: string; icon: typeof Tag }[] = [
  { id: "pipeline", label: "Pipeline", icon: GitBranch }, { id: "lead_stages", label: "Lead Stages", icon: Layers },
  { id: "deal_stages", label: "Deal Stages", icon: ListChecks }, { id: "source", label: "Sources", icon: Radio },
  { id: "tag", label: "Tags", icon: Tag }, { id: "category", label: "Categories", icon: Folder },
  { id: "contract_type", label: "Contract Type", icon: FileSignature }, { id: "list_view", label: "List View Settings", icon: Columns3 },
];

async function load() {
  const r = await Promise.all([
    db.from("crm_pipelines").select("*").order("position"),
    db.from("crm_stages").select("*").order("position"),
    db.from("crm_options").select("*").order("position"),
    db.from("crm_list_views").select("*"),
    db.from("leads").select("pipeline_id,stage_id,source_id").limit(10000),
    db.from("deals").select("pipeline_id,stage_id,contract_type_id").limit(10000),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  const usage = new Map<string, number>();
  for (const row of [...r[4].data, ...r[5].data]) for (const v of Object.values(row)) if (v) usage.set(v as string, (usage.get(v as string) ?? 0) + 1);
  for (const s of r[1].data as Item[]) usage.set(s.pipeline_id!, (usage.get(s.pipeline_id!) ?? 0) + 1);
  return {
    pipelines: r[0].data as Item[], stages: r[1].data as Item[], options: r[2].data as Item[],
    views: r[3].data as { module: string; columns: string[] }[], usage,
  };
}

function SetupPage() {
  const [section, setSection] = useState<Section>("pipeline");
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const title = menu.find((m) => m.id === section)!.label;

  return (
    <div className="space-y-5">
      <Breadcrumb label="CRM System Setup" />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-3">
          <p className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Setup Menu</p>
          <nav className="space-y-1">
            {menu.map((m) => (
              <button key={m.id} onClick={() => setSection(m.id)}
                className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] font-medium transition-colors",
                  section === m.id ? "bg-admin-blue text-primary-foreground" : "text-foreground hover:bg-muted")}>
                <m.icon className="size-4" />{m.label}
              </button>
            ))}
          </nav>
        </Card>
        <Card className="p-5">
          {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading configuration…</p>
            : error ? <EmptyState title="Could not load configuration" hint={(error as Error).message} />
            : section === "list_view" ? <ListViewSettings views={data!.views} />
            : <ConfigTable key={section} section={section} title={title} data={data!} />}
        </Card>
      </div>
    </div>
  );
}

function ConfigTable({ section, title, data }: { section: Exclude<Section, "list_view">; title: string; data: Awaited<ReturnType<typeof load>> }) {
  const qc = useQueryClient();
  const isPipeline = section === "pipeline";
  const stageKind: StageKind | null = section === "lead_stages" ? "lead" : section === "deal_stages" ? "deal" : null;
  const defaultPipe = data.pipelines.find((p) => p.is_default) ?? data.pipelines[0];
  const [pipelineId, setPipelineId] = useState<string | undefined>(defaultPipe?.id);
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const [del, setDel] = useState<Item | null>(null);

  const table = isPipeline ? "crm_pipelines" : stageKind ? "crm_stages" : "crm_options";
  const rows = useMemo(() => isPipeline ? data.pipelines
    : stageKind ? data.stages.filter((s) => s.kind === stageKind && s.pipeline_id === pipelineId)
    : data.options.filter((o) => o.category === section), [data, section, pipelineId, isPipeline, stageKind]);

  const refresh = () => qc.invalidateQueries({ queryKey: QK });
  const run = async (p: Promise<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) return toast.error(error.message.includes("row-level") ? "You don't have permission for this action." : error.message);
    toast.success(ok); refresh();
  };

  const save = async () => {
    const name = edit?.name?.trim();
    if (!name) return toast.error("Name is required");
    if (name.length > 80) return toast.error("Name must be 80 characters or fewer");
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== edit!.id)) return toast.error("That name already exists");
    if (stageKind && !pipelineId) return toast.error("Create a pipeline first");
    const payload: Record<string, unknown> = { name, is_active: edit!.is_active ?? true };
    if (!isPipeline) payload.color = edit!.color ?? "#2684FF";
    if (edit!.id) await run(db.from(table).update(payload).eq("id", edit!.id), `${title} updated`);
    else {
      payload.position = rows.length;
      if (stageKind) Object.assign(payload, { kind: stageKind, pipeline_id: pipelineId });
      else if (!isPipeline) payload.category = section;
      await run(db.from(table).insert(payload), `${title} created`);
    }
    setEdit(null);
  };

  const move = async (i: number, d: -1 | 1) => {
    const next = moveItem(rows, i, d);
    if (next === rows) return;
    await run(Promise.all(next.map((r) => db.from(table).update({ position: r.position }).eq("id", r.id)))
      .then((res: { error: { message: string } | null }[]) => ({ error: res.find((x) => x.error)?.error ?? null })), "Order saved");
  };

  const makeDefault = async (p: Item) => {
    await run(db.from("crm_pipelines").update({ is_default: false }).neq("id", p.id), "");
    await run(db.from("crm_pipelines").update({ is_default: true, is_active: true }).eq("id", p.id), `${p.name} is now the default pipeline`);
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">{title} Configuration</h2>
          <p className="text-sm text-muted-foreground">Changes apply immediately to Leads and Deals.</p>
        </div>
        <div className="flex items-center gap-3">
          {stageKind && (
            <select aria-label="Pipeline" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-[15px]">
              {data.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <ToolbarButton primary onClick={() => setEdit({ is_active: true, color: "#2684FF" })}><Plus className="size-4" />Add {title.replace(/s$/, "")}</ToolbarButton>
        </div>
      </div>
      <DataTable columns={["#", "Name", ...(isPipeline ? ["Default"] : ["Color"]), "Usage", "Status", "Order", "Actions"]} minWidth={760}>
        {rows.map((r, i) => {
          const usage = data.usage.get(r.id) ?? 0;
          return (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-semibold">{r.name}</td>
              <td className="px-4 py-3">
                {isPipeline ? (r.is_default ? <StatusBadge tone="blue">Default</StatusBadge>
                  : <button className="text-sm font-semibold text-admin-blue hover:underline" onClick={() => makeDefault(r)}>Make default</button>)
                  : <span className="inline-flex items-center gap-2"><span className="size-4 rounded" style={{ background: r.color }} />{r.color}</span>}
              </td>
              <td className="px-4 py-3"><StatusBadge tone={usage ? "purple" : "gray"}>{usage} {isPipeline ? "stages/records" : "in use"}</StatusBadge></td>
              <td className="px-4 py-3">
                <Switch aria-label="Active" checked={r.is_active} disabled={!!r.is_default}
                  onCheckedChange={(v) => run(db.from(table).update({ is_active: v }).eq("id", r.id), v ? "Activated" : "Deactivated")} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded border hover:bg-muted disabled:opacity-40"><ArrowUp className="size-4" /></button>
                  <button aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded border hover:bg-muted disabled:opacity-40"><ArrowDown className="size-4" /></button>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button aria-label="Edit" onClick={() => setEdit(r)} className="grid size-8 place-items-center rounded text-admin-blue hover:bg-admin-blue/10"><Pencil className="size-4" /></button>
                  <button aria-label="Delete" onClick={() => canDelete(usage, r.is_default) ? setDel(r) : toast.error(r.is_default ? "The default pipeline can't be deleted." : "In use — deactivate it instead.")}
                    className="grid size-8 place-items-center rounded text-admin-red hover:bg-admin-red/10"><Trash2 className="size-4" /></button>
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>
      {rows.length === 0 && <EmptyState title={`No ${title.toLowerCase()} yet`} hint={`Click “Add” to create the first one.`} />}
      <p className="mt-4 text-sm text-muted-foreground">Showing {rows.length} of {rows.length} entries</p>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit" : "Add"} {title.replace(/s$/, "")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Name
              <input autoFocus maxLength={80} value={edit?.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border px-3 font-normal" />
            </label>
            {!isPipeline && (
              <label className="block text-sm font-semibold">Color
                <input type="color" value={edit?.color ?? "#2684FF"} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="mt-1 h-10 w-20 rounded border" />
              </label>
            )}
            <label className="flex items-center justify-between text-sm font-semibold">Active
              <Switch checked={edit?.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
            </label>
            <div className="flex justify-end gap-2">
              <ToolbarButton onClick={() => setEdit(null)}>Cancel</ToolbarButton>
              <ToolbarButton primary onClick={save}><Save className="size-4" />Save</ToolbarButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{del?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-admin-red" onClick={() => { run(db.from(table).delete().eq("id", del!.id), "Deleted"); setDel(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ListViewSettings({ views }: { views: { module: string; columns: string[] }[] }) {
  const qc = useQueryClient();
  const [module, setModule] = useState<"leads" | "deals">("leads");
  const catalog = module === "leads" ? leadColumnCatalog : dealColumnCatalog;
  const [cols, setCols] = useState<string[]>([]);
  useEffect(() => { setCols(views.find((v) => v.module === module)?.columns ?? catalog.map((c) => c.id)); }, [module, views, catalog]);
  const ordered = [...cols.map((id) => catalog.find((c) => c.id === id)!).filter(Boolean), ...catalog.filter((c) => !cols.includes(c.id))];

  const move = (id: string, d: -1 | 1) => {
    const i = cols.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= cols.length) return;
    const n = [...cols]; [n[i], n[j]] = [n[j], n[i]]; setCols(n);
  };
  const save = async () => {
    if (cols.length === 0) return toast.error("Keep at least one column visible");
    const { error } = await db.from("crm_list_views").upsert({ module, columns: cols, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("List view saved"); qc.invalidateQueries({ queryKey: QK }); qc.invalidateQueries({ queryKey: ["admin-leads"] });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">List View Settings</h2>
          <p className="text-sm text-muted-foreground">Choose and order the columns shown in the table.</p>
        </div>
        <div className="flex gap-3">
          <select aria-label="Module" value={module} onChange={(e) => setModule(e.target.value as "leads" | "deals")} className="h-10 rounded-md border bg-card px-3 text-[15px]">
            <option value="leads">Leads</option><option value="deals">Deals</option>
          </select>
          <ToolbarButton primary onClick={save}><Save className="size-4" />Save</ToolbarButton>
        </div>
      </div>
      <DataTable columns={["Column", "Visible", "Order"]} minWidth={500}>
        {ordered.map((c) => {
          const on = cols.includes(c.id);
          return (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className="px-4 py-3 font-semibold">{c.label}</td>
              <td className="px-4 py-3"><Switch aria-label={`Show ${c.label}`} checked={on} onCheckedChange={(v) => setCols(v ? [...cols, c.id] : cols.filter((x) => x !== c.id))} /></td>
              <td className="px-4 py-3">
                {on && <div className="flex gap-1">
                  <button aria-label="Move up" onClick={() => move(c.id, -1)} className="grid size-8 place-items-center rounded border hover:bg-muted"><ArrowUp className="size-4" /></button>
                  <button aria-label="Move down" onClick={() => move(c.id, 1)} className="grid size-8 place-items-center rounded border hover:bg-muted"><ArrowDown className="size-4" /></button>
                </div>}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </>
  );
}
