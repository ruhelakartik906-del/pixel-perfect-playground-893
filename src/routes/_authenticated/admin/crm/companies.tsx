import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Download, Link2, Mail, MoreHorizontal, Pencil, Phone, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { dateBadge } from "./contacts";

export const Route = createFileRoute("/_authenticated/admin/crm/companies")({
  head: () => ({ meta: [
    { title: "Companies — Routiva CRM Admin" },
    { name: "description", content: "Manage client companies and their contact details." },
    { property: "og:title", content: "Companies — Routiva CRM Admin" },
    { property: "og:description", content: "Manage client companies and their contact details." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CompaniesPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["admin-companies"];
const PAGE_SIZE = 10;
type Company = { id: string; name: string; contact_person: string; industry: string; phone: string; email: string; website: string; address: string; city: string; state: string; country: string; notes: string; is_active: boolean; created_at: string };
type ContactOpt = { id: string; name: string; company_id: string | null };

async function load() {
  const r = await Promise.all([
    db.from("companies").select("*").order("created_at", { ascending: false }),
    db.from("contacts").select("id,name,company_id"),
    db.from("leads").select("company_id"),
    db.from("deals").select("company_id"),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  const count = (rows: { company_id: string | null }[]) => rows.reduce<Record<string, number>>((m, x) => { if (x.company_id) m[x.company_id] = (m[x.company_id] ?? 0) + 1; return m; }, {});
  return { companies: r[0].data as Company[], contacts: r[1].data as ContactOpt[], contactCounts: count(r[1].data), leads: count(r[2].data), deals: count(r[3].data) };
}

const blank = { name: "", contact_person: "", industry: "", phone: "", email: "", website: "", address: "", city: "", state: "", country: "", notes: "" };

function CompaniesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [view, setView] = useState<Company | null>(null);
  const [del, setDel] = useState<Company | null>(null);
  const [link, setLink] = useState<Company | null>(null);
  const [linkContact, setLinkContact] = useState("");

  const filtered = useMemo(() => (data?.companies ?? []).filter((c) =>
    !q || [c.name, c.contact_person, c.phone, c.email, c.city, c.industry].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase()))), [data, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Enter a valid email"); return; }
    const payload = Object.fromEntries(Object.entries(form).filter(([k]) => k !== "id").map(([k, v]) => [k, (v as string).trim()]));
    const { error } = form.id
      ? await db.from("companies").update(payload).eq("id", form.id)
      : await db.from("companies").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Company updated" : "Company created");
    setForm(null); qc.invalidateQueries({ queryKey: QK });
  };

  const usage = (id: string) => (data?.contactCounts[id] ?? 0) + (data?.leads[id] ?? 0) + (data?.deals[id] ?? 0);

  const remove = async () => {
    if (!del) return;
    if (usage(del.id) > 0) { toast.error("This company has contacts, leads or deals. Reassign them before deleting."); setDel(null); return; }
    const { error } = await db.from("companies").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Company deleted"); setDel(null); qc.invalidateQueries({ queryKey: QK });
  };

  const linkSave = async () => {
    if (!link || !linkContact) return;
    const { error } = await db.from("contacts").update({ company_id: link.id }).eq("id", linkContact);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact linked to company"); setLink(null); setLinkContact(""); qc.invalidateQueries({ queryKey: QK });
  };

  const exportCsv = () => {
    if (!filtered.length) { toast.info("No companies to export"); return; }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Date", "Company", "Contact Person", "Phone", "City", "Email", "Industry", "Contacts", "Leads", "Deals"].map(esc).join(","),
      ...filtered.map((c) => [new Date(c.created_at).toLocaleDateString(), c.name, c.contact_person, c.phone, c.city, c.email, c.industry, data?.contactCounts[c.id] ?? 0, data?.leads[c.id] ?? 0, data?.deals[c.id] ?? 0].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "companies.csv"; a.click();
  };

  const startEdit = (c: Company) => setForm({ id: c.id, name: c.name, contact_person: c.contact_person, industry: c.industry, phone: c.phone, email: c.email, website: c.website, address: c.address, city: c.city, state: c.state, country: c.country, notes: c.notes });

  return (
    <div className="space-y-5">
      <Breadcrumb label="Companies" />
      <PageHeader title={`Companies (${filtered.length})`} subtitle="Manage all companies in the system">
        <SearchInput placeholder="Search companies..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-72" />
        <ToolbarButton onClick={exportCsv}><Download className="size-4" />Export</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank })}><Plus className="size-4" />Create Company</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading companies…</p>
          : error ? <EmptyState title="Could not load companies" hint={(error as Error).message} />
          : <>
            <DataTable columns={["No.", "", "Date", "Company Details", "Contact Phone", "City", "Email Address", "Created", "Actions"]} minWidth={1100}>
              {rows.map((c, i) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-4 text-muted-foreground">{(cur - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-4"><input type="checkbox" checked={selected.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} className="size-4 accent-admin-blue" aria-label={`Select ${c.name}`} /></td>
                  <td className="px-4 py-4"><span className="rounded border border-admin-blue/40 bg-admin-blue/5 px-2 py-1 text-xs font-bold text-admin-blue">{dateBadge(c.created_at)}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-admin-blue text-primary-foreground"><Building2 className="size-5" /></span>
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.contact_person || "N/A"}{c.industry ? ` · ${c.industry}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">{c.phone || "N/A"}</td>
                  <td className="whitespace-nowrap px-4 py-4">{c.city || "N/A"}</td>
                  <td className="whitespace-nowrap px-4 py-4">{c.email || "N/A"}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 hover:bg-muted" aria-label={`Actions for ${c.name}`}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setView(c)}><Building2 className="mr-2 size-4" />View Company</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => startEdit(c)}><Pencil className="mr-2 size-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setLink(c); setLinkContact(""); }}><Link2 className="mr-2 size-4" />Link Contact</DropdownMenuItem>
                        <DropdownMenuItem className="text-admin-red" onClick={() => setDel(c)}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </DataTable>
            {filtered.length === 0 && <EmptyState title="No data" hint="Create a company to group contacts, leads and deals." />}
            {filtered.length > 0 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="grid size-9 place-items-center rounded-md border disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
                {Array.from({ length: pages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} className={`grid size-9 place-items-center rounded-md text-sm font-semibold ${cur === i + 1 ? "bg-admin-blue text-primary-foreground" : "border hover:bg-muted"}`}>{i + 1}</button>
                ))}
                <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="grid size-9 place-items-center rounded-md border disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
              </div>
            )}
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Company" : "Create Company"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([["name", "Company Name *"], ["contact_person", "Contact Person"], ["industry", "Business Category"], ["phone", "Phone"],
                ["email", "Email"], ["website", "Website"], ["city", "City"], ["state", "State"], ["country", "Country"]] as const).map(([k, lbl]) => (
                <label key={k} className="text-sm font-semibold">{lbl}
                  <input maxLength={200} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" />
                </label>
              ))}
              <label className="text-sm font-semibold sm:col-span-2">Address
                <input maxLength={300} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">Notes
                <textarea maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-20 w-full rounded-md border px-3 py-2 font-normal" />
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <ToolbarButton onClick={() => setForm(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={save}><Save className="size-4" />Save Company</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Contact to {link?.name}</DialogTitle></DialogHeader>
          {link && data && (
            <div className="space-y-4">
              <select value={linkContact} onChange={(e) => setLinkContact(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3">
                <option value="">— Select contact —</option>
                {data.contacts.filter((c) => c.company_id !== link.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex justify-end gap-2">
                <ToolbarButton onClick={() => setLink(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={linkSave}><Link2 className="size-4" />Link Contact</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{view?.name || "Company"}</SheetTitle></SheetHeader>
          {view && data && (
            <div className="mt-5 space-y-6 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-14 place-items-center rounded-full bg-admin-blue text-primary-foreground"><Building2 className="size-7" /></span>
                <div><p className="text-lg font-bold">{view.name}</p><p className="text-muted-foreground">{view.industry || "Company"}</p></div>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[["Contact Person", view.contact_person], ["Phone", view.phone], ["Email", view.email], ["Website", view.website],
                  ["Address", view.address], ["City", view.city], ["State", view.state], ["Country", view.country],
                  ["Contacts", String(data.contactCounts[view.id] ?? 0)], ["Leads", String(data.leads[view.id] ?? 0)], ["Deals", String(data.deals[view.id] ?? 0)],
                  ["Created", new Date(view.created_at).toLocaleString()]]
                  .map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v || "—"}</dd></div>)}
              </dl>
              {view.notes && <section><h3 className="mb-1 font-bold">Notes</h3><p className="text-muted-foreground">{view.notes}</p></section>}
              <div className="flex items-center gap-2">
                <StatusBadge tone={view.is_active ? "green" : "gray"}>{view.is_active ? "Active" : "Inactive"}</StatusBadge>
                <ToolbarButton primary onClick={() => { startEdit(view); setView(null); }}><Pencil className="size-4" />Edit Company</ToolbarButton>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes {del?.name}. Companies with contacts, leads or deals cannot be deleted.</AlertDialogDescription>
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
