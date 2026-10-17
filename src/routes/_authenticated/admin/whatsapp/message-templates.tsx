import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, MoreVertical, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminHead } from "@/lib/admin-head";
import { validTemplateName } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/message-templates")({
  head: () => adminHead("Message Templates", "Manage, sync and create WhatsApp templates for broadcast campaigns."),
  component: Templates,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["wa-templates"];
type Btn = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value: string };
type T = { id: string; name: string; category: string; language: string; header: string; body: string; footer: string; buttons: Btn[]; status: string; sync_status: string; updated_at: string };
const blank = { name: "", category: "UTILITY", language: "en", header: "", body: "", footer: "", buttons: [] as Btn[], status: "draft" };

function Templates() {
  const qc = useQueryClient();
  const { data = [], isLoading, isFetching, refetch, error } = useQuery({ queryKey: QK, queryFn: async () => { const r = await db.from("whatsapp_templates").select("*").order("updated_at", { ascending: false }); if (r.error) throw r.error; return r.data as T[]; } });
  const [q, setQ] = useState("");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [del, setDel] = useState<T | null>(null);
  const list = useMemo(() => data.filter((t) => !q || `${t.name} ${t.category} ${t.body}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  const save = async () => {
    if (!form) return;
    if (!validTemplateName(form.name)) { toast.error("Name: lowercase letters, numbers and underscores only"); return; }
    if (!form.body.trim() || form.body.length > 1024) { toast.error("Body is required (max 1024 characters)"); return; }
    if (form.header.length > 60 || form.footer.length > 60) { toast.error("Header and footer are limited to 60 characters"); return; }
    if (form.buttons.some((b) => !b.text.trim() || (b.type !== "QUICK_REPLY" && !b.value.trim()))) { toast.error("Complete every button"); return; }
    const { id, ...payload } = form;
    const { error } = id ? await db.from("whatsapp_templates").update({ ...payload, sync_status: "not_synced" }).eq("id", id) : await db.from("whatsapp_templates").insert(payload);
    if (error) { toast.error(error.message.includes("duplicate") ? "A template with this name already exists" : error.message); return; }
    toast.success(id ? "Template updated" : "Template created"); setForm(null); qc.invalidateQueries({ queryKey: QK });
  };
  const remove = async () => {
    if (!del) return;
    const { error } = await db.from("whatsapp_templates").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template deleted"); setDel(null); qc.invalidateQueries({ queryKey: QK });
  };

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["WhatsApp"]} label="Message Templates" />
      <PageHeader title="Message Templates (Meta WABA)" subtitle="Manage, sync, and create templates for your broadcast campaigns directly from Routiva CRM.">
        {data.length > 0 && <SearchInput placeholder="Search templates..." value={q} onChange={setQ} className="w-60" />}
        <ToolbarButton onClick={() => refetch().then(() => toast.success("Templates refreshed"))}><RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />Refresh</ToolbarButton>
        <ToolbarButton onClick={() => toast.info("Meta sync is not connected yet. Templates are saved locally and marked “Not synced”.")}>Sync Meta Templates</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank, buttons: [] })}><Plus className="size-4" />Create Template</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-16 text-center text-muted-foreground">Loading…</p>
          : error ? <p className="py-16 text-center text-admin-red">{(error as Error).message}</p>
          : list.length === 0 ? <div className="flex flex-col items-center gap-4 py-6"><Inbox className="size-28 text-border" strokeWidth={1} /><p className="text-lg text-muted-foreground">{q ? "No templates match your search." : "No templates found. Build your first template by clicking 'Create Template' above!"}</p></div>
          : <DataTable columns={["Name", "Category", "Language", "Body", "Status", "Sync", "Actions"]} minWidth={900}>
            {list.map((t) => <tr key={t.id} className="hover:bg-muted/40">
              <td className="px-4 py-4 font-semibold">{t.name}</td><td className="px-4 py-4">{t.category}</td><td className="px-4 py-4">{t.language}</td>
              <td className="max-w-sm truncate px-4 py-4 text-muted-foreground">{t.body}</td>
              <td className="px-4 py-4"><StatusBadge tone="gray">{t.status.toUpperCase()}</StatusBadge></td>
              <td className="px-4 py-4"><StatusBadge tone="orange">{t.sync_status === "not_synced" ? "NOT SYNCED" : t.sync_status.toUpperCase()}</StatusBadge></td>
              <td className="px-4 py-4"><DropdownMenu><DropdownMenuTrigger aria-label={`Actions for ${t.name}`} className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setForm({ id: t.id, name: t.name, category: t.category, language: t.language, header: t.header, body: t.body, footer: t.footer, buttons: t.buttons ?? [], status: t.status })}><Pencil className="size-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDel(t)} className="text-admin-red"><Trash2 className="size-4" />Delete</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu></td>
            </tr>)}
          </DataTable>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Template" : "Create Template"}</DialogTitle></DialogHeader>
          {form && <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <label className="grid gap-1 text-sm font-medium">Template name<input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="order_update" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-medium">Category<select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{["MARKETING", "UTILITY", "AUTHENTICATION"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium">Language<select className="inp" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>{[["en", "English"], ["en_US", "English (US)"], ["hi", "Hindi"], ["mr", "Marathi"], ["ta", "Tamil"], ["te", "Telugu"], ["bn", "Bengali"], ["gu", "Gujarati"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>
            <label className="grid gap-1 text-sm font-medium">Header (optional)<input className="inp" value={form.header} maxLength={60} onChange={(e) => setForm({ ...form, header: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Body<textarea className="inp h-32 py-2" value={form.body} maxLength={1024} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hi {{1}}, your order {{2}} is on the way." /><span className="text-xs text-muted-foreground">{form.body.length}/1024 · use {"{{1}}"}, {"{{2}}"} for variables</span></label>
            <label className="grid gap-1 text-sm font-medium">Footer (optional)<input className="inp" value={form.footer} maxLength={60} onChange={(e) => setForm({ ...form, footer: e.target.value })} /></label>
            <div className="space-y-2"><p className="text-sm font-medium">Buttons</p>
              {form.buttons.map((b, i) => <div key={i} className="flex gap-2">
                <select className="inp w-40" value={b.type} onChange={(e) => setForm({ ...form, buttons: form.buttons.map((x, j) => j === i ? { ...x, type: e.target.value as Btn["type"] } : x) })}><option value="QUICK_REPLY">Quick reply</option><option value="URL">Website</option><option value="PHONE_NUMBER">Call</option></select>
                <input className="inp" placeholder="Button text" maxLength={25} value={b.text} onChange={(e) => setForm({ ...form, buttons: form.buttons.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
                {b.type !== "QUICK_REPLY" && <input className="inp" placeholder={b.type === "URL" ? "https://…" : "+91…"} value={b.value} onChange={(e) => setForm({ ...form, buttons: form.buttons.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} />}
                <button aria-label="Remove button" onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, j) => j !== i) })}><X className="size-4" /></button></div>)}
              {form.buttons.length < 3 && <ToolbarButton onClick={() => setForm({ ...form, buttons: [...form.buttons, { type: "QUICK_REPLY", text: "", value: "" }] })}><Plus className="size-4" />Add button</ToolbarButton>}
            </div>
            <ToolbarButton primary onClick={save} className="justify-center">{form.id ? "Save changes" : "Create template"}</ToolbarButton>
          </div>}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete template “{del?.name}”?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
