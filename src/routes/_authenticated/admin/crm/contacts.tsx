import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
type Contact = { id: string; name: string; phone: string; email: string; location: string; job_title: string; company_id: string | null; is_active: boolean; created_at: string };

async function load() {
  const r = await Promise.all([
    db.from("contacts").select("*").order("created_at", { ascending: false }).limit(2000),
    db.from("companies").select("id,name"),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  return { contacts: r[0].data as Contact[], companies: r[1].data as { id: string; name: string }[] };
}

const blank = { name: "", phone: "", email: "", location: "", job_title: "", company_id: "" };

function ContactsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [del, setDel] = useState<Contact | null>(null);

  const companyName = (id: string | null) => data?.companies.find((c) => c.id === id)?.name ?? "—";
  const filtered = useMemo(() => (data?.contacts ?? []).filter((c) =>
    !q || [c.name, c.phone, c.email, c.location, companyName(c.company_id)].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase()))), [data, q]);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { toast.error("Contact name is required"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Enter a valid email"); return; }
    const payload = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), location: form.location.trim(), job_title: form.job_title.trim(), company_id: form.company_id || null };
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
    const csv = [["Name", "Phone", "Email", "Company", "Location", "Job Title"].map(esc).join(","),
      ...filtered.map((c) => [c.name, c.phone, c.email, companyName(c.company_id), c.location, c.job_title].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "contacts.csv"; a.click();
  };

  return (
    <div className="space-y-5">
      <Breadcrumb label={`Contacts (${data?.contacts.length ?? 0})`} />
      <PageHeader title={`All Contacts (${filtered.length})`} subtitle="Manage all customer contacts in the system">
        <SearchInput placeholder="Search contacts..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton onClick={exportCsv}><Download className="size-4" />Export</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank })}><Plus className="size-4" />Create Contact</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading contacts…</p>
          : error ? <EmptyState title="Could not load contacts" hint={(error as Error).message} />
          : <>
            <DataTable columns={["No.", "Name", "Phone", "Email", "Company", "Location", "Job Title", "Status", "Actions"]} minWidth={1100}>
              {filtered.map((c, i) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{c.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.phone || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.email || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{companyName(c.company_id)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.location || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.job_title || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge tone={c.is_active ? "green" : "gray"}>{c.is_active ? "Active" : "Inactive"}</StatusBadge></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setForm({ id: c.id, name: c.name, phone: c.phone, email: c.email, location: c.location, job_title: c.job_title, company_id: c.company_id ?? "" })}><Pencil className="mr-2 size-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-admin-red" onClick={() => setDel(c)}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </DataTable>
            {filtered.length === 0 && <EmptyState title="No contacts" hint="Create a contact to start building your customer directory." />}
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Contact" : "Create Contact"}</DialogTitle></DialogHeader>
          {form && data && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([["name", "Name *"], ["phone", "Phone"], ["email", "Email"], ["location", "Location"], ["job_title", "Job Title"]] as const).map(([k, lbl]) => (
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
              <div className="flex justify-end gap-2 sm:col-span-2">
                <ToolbarButton onClick={() => setForm(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={save}><Save className="size-4" />Save Contact</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
