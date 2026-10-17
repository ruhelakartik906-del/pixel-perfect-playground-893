import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Download, Mail, MoreHorizontal, Pencil, Phone, Plus, Save, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { dateBadge } from "@/lib/crm-data";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/crm/contacts")({
  head: () => ({ meta: [
    { title: "Contacts — Routiva CRM Admin" },
    { name: "description", content: "Manage every customer contact across companies." },
    { property: "og:title", content: "Contacts — Routiva CRM Admin" },
    { property: "og:description", content: "Manage every customer contact across companies." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ContactsPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["admin-contacts"];
const PAGE_SIZE = 10;
type Contact = { id: string; name: string; phone: string; email: string; city: string; state: string; country: string; job_title: string; notes: string; company_id: string | null; is_active: boolean; created_at: string };
type Company = { id: string; name: string; phone: string };

async function load() {
  const r = await Promise.all([
    db.from("contacts").select("*").order("created_at", { ascending: false }).limit(5000),
    db.from("companies").select("id,name,phone"),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  return { contacts: r[0].data as Contact[], companies: r[1].data as Company[] };
}

const blank = { name: "", phone: "", email: "", city: "", state: "", country: "", job_title: "", notes: "", company_id: "" };

function ContactsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [view, setView] = useState<Contact | null>(null);
  const [del, setDel] = useState<Contact | null>(null);

  const company = (id: string | null) => data?.companies.find((c) => c.id === id);
  const filtered = useMemo(() => (data?.contacts ?? []).filter((c) =>
    !q || [c.name, c.phone, c.email, c.city, c.state, company(c.company_id)?.name].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase()))), [data, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const toggleAll = (on: boolean) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set());
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { toast.error("Contact name is required"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Enter a valid email"); return; }
    const payload = Object.fromEntries(Object.entries(form).filter(([k]) => k !== "id").map(([k, v]) => [k, k === "company_id" ? (v || null) : (v as string).trim()]));
    const { error } = form.id
      ? await db.from("contacts").update(payload).eq("id", form.id)
      : await db.from("contacts").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Contact updated" : "Contact created");
    setForm(null); qc.invalidateQueries({ queryKey: QK });
  };

  const remove = async () => {
    if (!del) return;
    const { error } = await db.from("contacts").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact deleted"); setDel(null); qc.invalidateQueries({ queryKey: QK });
  };

  const exportCsv = () => {
    if (!filtered.length) { toast.info("No contacts to export"); return; }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Date", "Name", "Email", "Phone", "Company", "Company Phone", "City", "State", "Country", "Job Title"].map(esc).join(","),
      ...filtered.map((c) => [new Date(c.created_at).toLocaleDateString(), c.name, c.email, c.phone, company(c.company_id)?.name ?? "", company(c.company_id)?.phone ?? "", c.city, c.state, c.country, c.job_title].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "contacts.csv"; a.click();
  };

  return (
    <div className="space-y-5">
      <Breadcrumb label="Contacts" />
      <PageHeader title={`Contacts (${filtered.length})`} subtitle="Manage all contacts in the organization">
        <SearchInput placeholder="Search contacts..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-72" />
        <ToolbarButton onClick={exportCsv}><Download className="size-4" />Export</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank })}><Plus className="size-4" />Create Contact</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading contacts…</p>
          : error ? <EmptyState title="Could not load contacts" hint={(error as Error).message} />
          : filtered.length === 0 ? <EmptyState title="No data" hint="Create a contact to start building your customer directory." />
          : <>
            <DataTable columns={["No.", "", "Date", "Contact Details", "Company Details", "Location", "Actions"]} minWidth={1000}>
              {rows.map((c, i) => {
                const co = company(c.company_id);
                return (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-4 text-muted-foreground">{(cur - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-4"><input type="checkbox" checked={selected.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} className="size-4 accent-admin-blue" aria-label={`Select ${c.name}`} /></td>
                    <td className="px-4 py-4"><span className="rounded border border-admin-blue/40 bg-admin-blue/5 px-2 py-1 text-xs font-bold text-admin-blue">{dateBadge(c.created_at)}</span></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-admin-blue text-primary-foreground"><User className="size-5" /></span>
                        <div>
                          <p className="font-semibold">{c.name}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" />{c.email || "N/A"}</p>
                          {c.phone && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{c.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {co ? <><p className="font-semibold">{co.name}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{co.phone || "N/A"}</p></> : <span className="text-muted-foreground">N/A</span>}
                    </td>
                    <td className="px-4 py-4"><span className="rounded bg-admin-blue/5 px-2 py-1 text-xs font-semibold text-admin-blue">{[c.city, c.state, c.country].filter(Boolean).join(", ") || "N/A"}</span></td>
                    <td className="px-4 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 hover:bg-muted" aria-label={`Actions for ${c.name}`}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setView(c)}><User className="mr-2 size-4" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setForm({ id: c.id, name: c.name, phone: c.phone, email: c.email, city: c.city, state: c.state, country: c.country, job_title: c.job_title, notes: c.notes, company_id: c.company_id ?? "" })}><Pencil className="mr-2 size-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-admin-red" onClick={() => setDel(c)}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="grid size-9 place-items-center rounded-md border disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`grid size-9 place-items-center rounded-md text-sm font-semibold ${cur === i + 1 ? "bg-admin-blue text-primary-foreground" : "border hover:bg-muted"}`}>{i + 1}</button>
              ))}
              <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="grid size-9 place-items-center rounded-md border disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
            </div>
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Contact" : "Create Contact"}</DialogTitle></DialogHeader>
          {form && data && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([["name", "Customer Name *"], ["email", "Email"], ["phone", "Phone"], ["job_title", "Job Title"],
                ["city", "City"], ["state", "State"], ["country", "Country"]] as const).map(([k, lbl]) => (
                <label key={k} className="text-sm font-semibold">{lbl}
                  <input maxLength={200} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" />
                </label>
              ))}
              <label className="text-sm font-semibold">Company
                <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-card px-3 font-normal">
                  <option value="">— None —</option>
                  {data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">Notes
                <textarea maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-20 w-full rounded-md border px-3 py-2 font-normal" />
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <ToolbarButton onClick={() => setForm(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={save}><Save className="size-4" />Save Contact</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{view?.name || "Contact"}</SheetTitle></SheetHeader>
          {view && (
            <div className="mt-5 space-y-6 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-14 place-items-center rounded-full bg-admin-blue text-primary-foreground"><User className="size-7" /></span>
                <div><p className="text-lg font-bold">{view.name}</p><p className="text-muted-foreground">{view.job_title || "Contact"}</p></div>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[["Email", view.email], ["Phone", view.phone], ["City", view.city], ["State", view.state], ["Country", view.country],
                  ["Company", company(view.company_id)?.name], ["Added", new Date(view.created_at).toLocaleString()]]
                  .map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v || "—"}</dd></div>)}
              </dl>
              {view.notes && <section><h3 className="mb-1 font-bold">Notes</h3><p className="text-muted-foreground">{view.notes}</p></section>}
              <ToolbarButton primary onClick={() => { setForm({ id: view.id, name: view.name, phone: view.phone, email: view.email, city: view.city, state: view.state, country: view.country, job_title: view.job_title, notes: view.notes, company_id: view.company_id ?? "" }); setView(null); }}><Pencil className="size-4" />Edit Contact</ToolbarButton>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes {del?.name}. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-admin-red text-primary-foreground hover:opacity-90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
