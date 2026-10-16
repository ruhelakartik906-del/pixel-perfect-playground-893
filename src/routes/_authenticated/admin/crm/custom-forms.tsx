import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Eye, Lock, MoreVertical, Pencil, Plus, Save, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { db, loadLookups, type Row } from "@/lib/crm-data";
import { moveItem } from "@/lib/crm-config";

export const Route = createFileRoute("/_authenticated/admin/crm/custom-forms")({
  head: () => ({ meta: [
    { title: "Custom Form Builder — Routiva CRM Admin" },
    { name: "description", content: "Build inquiry forms that create CRM leads." },
    { property: "og:title", content: "Custom Form Builder — Routiva CRM Admin" },
    { property: "og:description", content: "Build inquiry forms that create CRM leads." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: FormsPage,
});

const QK = ["admin-forms"];
const fieldTypes = { short_text: "Short Text", long_text: "Long Text", phone: "Phone", email: "Email", number: "Number", dropdown: "Dropdown", checkbox: "Checkbox", file: "File Upload" } as const;
type FieldType = keyof typeof fieldTypes;
type Field = { id: string; label: string; type: FieldType; required: boolean; options?: string[]; position?: number };
type Form = { id?: string; name: string; description: string; module: "lead" | "deal"; fields: Field[]; is_active: boolean; is_system?: boolean; company_id?: string | null };
const leadKeys = ["customer_name", "phone", "email", "business_name", "business_category", "requirements", "interest_level", "region"];

async function load() {
  const [f, lk] = await Promise.all([db.from("custom_forms").select("*").order("created_at"), loadLookups()]);
  if (f.error) throw f.error;
  return { forms: f.data as (Form & { id: string; created_at: string })[], ...lk };
}

function FormsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Form | null>(null);
  const [preview, setPreview] = useState<Form | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: QK });
  const custom = (data?.forms ?? []).filter((f) => !f.is_system && f.name.toLowerCase().includes(q.toLowerCase()));
  const system = (data?.forms ?? []).filter((f) => f.is_system);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error("Form name is required"); return; }
    if (!edit.fields.length) { toast.error("Add at least one field"); return; }
    if (edit.fields.some((f) => !f.label.trim())) { toast.error("Every field needs a label"); return; }
    if (edit.fields.some((f) => f.type === "dropdown" && !(f.options ?? []).filter(Boolean).length)) { toast.error("Dropdown fields need at least one option"); return; }
    const payload = { name: edit.name.trim().slice(0, 120), description: edit.description.slice(0, 500), module: edit.module, is_active: edit.is_active, company_id: edit.company_id || null,
      fields: edit.fields.map(({ position: _p, ...f }) => ({ ...f, options: f.type === "dropdown" ? (f.options ?? []).filter(Boolean) : undefined })), updated_at: new Date().toISOString() };
    const res = edit.id ? await db.from("custom_forms").update(payload).eq("id", edit.id) : await db.from("custom_forms").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Form saved"); setEdit(null); refresh();
  };
  const duplicate = async (f: Form) => {
    const { error } = await db.from("custom_forms").insert({ name: `${f.name} (Copy)`, description: f.description, module: f.module, fields: f.fields, is_active: false, company_id: f.company_id ?? null });
    if (error) toast.error(error.message); else { toast.success("Form duplicated (inactive)"); refresh(); }
  };
  const toggle = async (f: Form, v: boolean) => { const { error } = await db.from("custom_forms").update({ is_active: v }).eq("id", f.id); if (error) toast.error(error.message); else refresh(); };

  const row = (f: Form & { id: string; created_at: string }, i: number) => (
    <tr key={f.id} className="hover:bg-muted/40">
      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
      <td className="px-4 py-3 font-semibold">{f.is_system && <Lock className="mr-1 inline size-3.5 text-muted-foreground" />}{f.name}<p className="text-xs font-normal text-muted-foreground">{f.description}</p></td>
      <td className="px-4 py-3"><StatusBadge tone={f.module === "lead" ? "blue" : "purple"}>{f.module}</StatusBadge></td>
      <td className="px-4 py-3">{f.fields.length}</td>
      <td className="px-4 py-3"><Switch aria-label="Active" checked={f.is_active} onCheckedChange={(v) => toggle(f, v)} /></td>
      <td className="px-4 py-3">{new Date(f.created_at).toLocaleDateString("en-IN")}</td>
      <td className="px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Form actions" className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setPreview(f)}><Eye className="size-4" />Preview</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEdit(structuredClone(f))}><Pencil className="size-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicate(f)}><Copy className="size-4" />Duplicate</DropdownMenuItem>
            {!f.is_system && <DropdownMenuItem className="text-admin-red" onClick={() => setDel(f)}><Trash2 className="size-4" />Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
  const cols = ["No.", "Form Name", "Module", "Fields", "Active", "Created", "Actions"];

  return (
    <div className="space-y-5">
      <Breadcrumb label="Custom Form Builder" />
      <PageHeader title="Custom Form Builder" subtitle="Design inquiry forms that create leads in your CRM">
        <SearchInput placeholder="Search forms..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton primary onClick={() => setEdit({ name: "", description: "", module: "lead", is_active: true, fields: [{ id: "customer_name", label: "Customer Name", type: "short_text", required: true }, { id: "phone", label: "Contact Number", type: "phone", required: true }] })}><Plus className="size-4" />Create New Form</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">Custom Inquiry Forms</h2>
        {isLoading ? <p className="py-16 text-center text-muted-foreground">Loading…</p> : error ? <EmptyState title="Could not load forms" hint={(error as Error).message} /> : <>
          <DataTable columns={cols} minWidth={900}>{custom.map(row)}</DataTable>
          {!custom.length && <EmptyState title="No custom forms yet" hint="Create a form to collect inquiries as leads." />}
        </>}
      </Card>
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-bold">System Default Templates</h2>
        <p className="mb-4 text-sm text-muted-foreground">Protected templates — they can be edited or duplicated but never deleted.</p>
        <DataTable columns={cols} minWidth={900}>{system.map(row)}</DataTable>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit Form" : "Create New Form"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Form Name *<input maxLength={120} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" /></label>
              <label className="text-sm font-semibold">Module
                <select value={edit.module} disabled={edit.is_system} onChange={(e) => setEdit({ ...edit, module: e.target.value as "lead" | "deal" })} className="mt-1 h-10 w-full rounded-md border bg-card px-3 font-normal"><option value="lead">Lead</option><option value="deal">Deal</option></select></label>
              <label className="text-sm font-semibold sm:col-span-2">Description<input maxLength={500} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" /></label>
              <label className="text-sm font-semibold">Company
                <select value={edit.company_id ?? ""} onChange={(e) => setEdit({ ...edit, company_id: e.target.value || null })} className="mt-1 h-10 w-full rounded-md border bg-card px-3 font-normal"><option value="">All companies</option>{data?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="flex items-center gap-3 self-end text-sm font-semibold">Active<Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /></label>
            </div>
            <div className="flex items-center justify-between"><h3 className="font-bold">Fields</h3>
              <ToolbarButton onClick={() => setEdit({ ...edit, fields: [...edit.fields, { id: `field_${Date.now()}`, label: "", type: "short_text", required: false }] })}><Plus className="size-4" />Add Field</ToolbarButton></div>
            {edit.fields.map((f, i) => {
              const set = (p: Partial<Field>) => setEdit({ ...edit, fields: edit.fields.map((x, j) => j === i ? { ...x, ...p } : x) });
              return (
                <div key={f.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input aria-label="Field label" placeholder="Field label" value={f.label} onChange={(e) => set({ label: e.target.value })} className="h-9 flex-1 rounded-md border px-3" />
                    <select aria-label="Field type" value={f.type} onChange={(e) => set({ type: e.target.value as FieldType })} className="h-9 rounded-md border bg-card px-2">
                      {Object.entries(fieldTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <label className="flex items-center gap-2 text-sm">Required<Switch checked={f.required} onCheckedChange={(v) => set({ required: v })} /></label>
                    <button aria-label="Move up" onClick={() => setEdit({ ...edit, fields: moveItem(edit.fields.map((x, j) => ({ ...x, position: j })), i, -1) })} className="grid size-8 place-items-center rounded border"><ArrowUp className="size-4" /></button>
                    <button aria-label="Move down" onClick={() => setEdit({ ...edit, fields: moveItem(edit.fields.map((x, j) => ({ ...x, position: j })), i, 1) })} className="grid size-8 place-items-center rounded border"><ArrowDown className="size-4" /></button>
                    <button aria-label="Remove field" onClick={() => setEdit({ ...edit, fields: edit.fields.filter((_, j) => j !== i) })} className="grid size-8 place-items-center rounded text-admin-red hover:bg-admin-red/10"><X className="size-4" /></button>
                  </div>
                  {f.type === "dropdown" && <input placeholder="Options, comma separated" value={(f.options ?? []).join(", ")} onChange={(e) => set({ options: e.target.value.split(",").map((s) => s.trim()) })} className="h-9 w-full rounded-md border px-3 text-sm" />}
                </div>
              );
            })}
            <div className="flex justify-end gap-2"><ToolbarButton onClick={() => setPreview(edit)}><Eye className="size-4" />Preview</ToolbarButton><ToolbarButton primary onClick={save}><Save className="size-4" />Save Form</ToolbarButton></div>
          </div>}
        </DialogContent>
      </Dialog>

      <Preview form={preview} onClose={() => setPreview(null)} defaultPipeline={data?.defaultPipeline ?? null} onDone={() => qc.invalidateQueries({ queryKey: ["admin-leads"] })} />

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete “{del?.name}”?</AlertDialogTitle><AlertDialogDescription>Existing leads keep their answers. This can't be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-admin-red" onClick={async () => { const { error } = await db.from("custom_forms").delete().eq("id", del!.id); if (error) toast.error(error.message); else { toast.success("Form deleted"); refresh(); } setDel(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Preview({ form, onClose, defaultPipeline, onDone }: { form: Form | null; onClose: () => void; defaultPipeline: string | null; onDone: () => void }) {
  const [vals, setVals] = useState<Record<string, string | boolean>>({});
  const submit = async () => {
    if (!form) return;
    for (const f of form.fields) {
      const v = vals[f.id];
      if (f.required && (v === undefined || v === "" || v === false)) { toast.error(`${f.label} is required`); return; }
      if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) { toast.error(`${f.label}: invalid email`); return; }
    }
    if (form.module !== "lead" || !form.id) { onClose(); toast.info("Preview only — save the form to submit test leads"); return; }
    const answers = Object.fromEntries(form.fields.map((f) => [f.label, f.type === "file" ? "(file upload not stored yet)" : vals[f.id] ?? ""]));
    const mapped = Object.fromEntries(form.fields.filter((f) => leadKeys.includes(f.id)).map((f) => [f.id, String(vals[f.id] ?? "").slice(0, 500)]));
    // Created unassigned; Ad Lead Routing / admin assignment decides the owner.
    const { error } = await db.from("leads").insert({ ...mapped, form_answers: answers, form_id: form.id, company_id: form.company_id ?? null, pipeline_id: defaultPipeline, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Submission saved as a new unassigned lead"); setVals({}); onDone(); onClose();
  };
  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{form?.name || "Form preview"}</DialogTitle></DialogHeader>
        {form && <div className="space-y-3">
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
          {form.fields.map((f) => (
            <label key={f.id} className="block text-sm font-semibold">{f.label}{f.required && " *"}
              {f.type === "long_text" ? <textarea className="mt-1 w-full rounded-md border p-2 font-normal" rows={3} value={String(vals[f.id] ?? "")} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })} />
                : f.type === "dropdown" ? <select className="mt-1 h-10 w-full rounded-md border bg-card px-2 font-normal" value={String(vals[f.id] ?? "")} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })}><option value="">Select…</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
                : f.type === "checkbox" ? <input type="checkbox" className="ml-2" checked={!!vals[f.id]} onChange={(e) => setVals({ ...vals, [f.id]: e.target.checked })} />
                : f.type === "file" ? <input type="file" className="mt-1 block text-sm font-normal" onChange={(e) => setVals({ ...vals, [f.id]: e.target.files?.[0]?.name ?? "" })} />
                : <input type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" value={String(vals[f.id] ?? "")} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })} />}
            </label>
          ))}
          <div className="flex justify-end"><ToolbarButton primary onClick={submit}><Send className="size-4" />Submit test entry</ToolbarButton></div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
