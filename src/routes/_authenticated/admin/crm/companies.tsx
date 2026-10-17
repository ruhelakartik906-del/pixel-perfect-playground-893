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
type Company = { id: string; name: string; phone: string; email: string; location: string; industry: string; is_active: boolean; created_at: string };

async function load() {
  const r = await Promise.all([
    db.from("companies").select("*").order("created_at", { ascending: false }),
    db.from("contacts").select("company_id"),
    db.from("leads").select("company_id"),
    db.from("deals").select("company_id"),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  const count = (rows: { company_id: string | null }[]) => rows.reduce<Record<string, number>>((m, x) => { if (x.company_id) m[x.company_id] = (m[x.company_id] ?? 0) + 1; return m; }, {});
  return { companies: r[0].data as Company[], contacts: count(r[1].data), leads: count(r[2].data), deals: count(r[3].data) };
}

const blank = { name: "", phone: "", email: "", location: "", industry: "" };

function CompaniesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [del, setDel] = useState<Company | null>(null);

  const filtered = useMemo(() => (data?.companies ?? []).filter((c) =>
    !q || [c.name, c.phone, c.email, c.location, c.industry].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase()))), [data, q]);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Enter a valid email"); return; }
    const payload = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), location: form.location.trim(), industry: form.industry.trim() };
    const { error } = form.id
      ? await db.from("companies").update(payload).eq("id", form.id)
      : await db.from("companies").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Company updated" : "Company created");
    setForm(null); qc.invalidateQueries({ queryKey: QK });
  };

  const usage = (id: string) => (data?.contacts[id] ?? 0) + (data?.leads[id] ?? 0) + (data?.deals[id] ?? 0);

  const remove = async () => {
    if (!del) return;
    if (usage(del.id) > 0) { toast.error("This company has contacts, leads or deals. Reassign them before deleting."); setDel(null); return; }
    const { error } = await db.from("companies").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Company deleted"); setDel(null); qc.invalidateQueries({ queryKey: QK });
  };

  const exportCsv = () => {
    if (!filtered.length) { toast.info("No companies to export"); return; }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Company", "Phone", "Email", "Location", "Industry", "Contacts", "Leads", "Deals"].map(esc).join(","),
      ...filtered.map((c) => [c.name, c.phone, c.email, c.location, c.industry, data?.contacts[c.id] ?? 0, data?.leads[c.id] ?? 0, data?.deals[c.id] ?? 0].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "companies.csv"; a.click();
  };

  return (
    <div className="space-y-5">
      <Breadcrumb label={`Companies (${data?.companies.length ?? 0})`} />
      <PageHeader title={`All Companies (${filtered.length})`} subtitle="Manage client companies in the system">
        <SearchInput placeholder="Search companies..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton onClick={exportCsv}><Download className="size-4" />Export</ToolbarButton>
        <ToolbarButton primary onClick={() => setForm({ ...blank })}><Plus className="size-4" />Create Company</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading companies…</p>
          : error ? <EmptyState title="Could not load companies" hint={(error as Error).message} />
          : <>
            <DataTable columns={["No.", "Company Name", "Phone", "Email", "Location", "Industry", "Contacts", "Leads", "Deals", "Status", "Actions"]} minWidth={1200}>
              {filtered.map((c, i) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{c.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.phone || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.email || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.location || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.industry || "—"}</td>
                  <td className="px-4 py-3">{data?.contacts[c.id] ?? 0}</td>
                  <td className="px-4 py-3">{data?.leads[c.id] ?? 0}</td>
                  <td className="px-4 py-3">{data?.deals[c.id] ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge tone={c.is_active ? "green" : "gray"}>{c.is_active ? "Active" : "Inactive"}</StatusBadge></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setForm({ id: c.id, name: c.name, phone: c.phone, email: c.email, location: c.location, industry: c.industry })}><Pencil className="mr-2 size-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-admin-red" onClick={() => setDel(c)}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </DataTable>
            {filtered.length === 0 && <EmptyState title="No companies" hint="Create a company to group contacts, leads and deals." />}
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Company" : "Create Company"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([["name", "Company Name *"], ["phone", "Phone"], ["email", "Email"], ["location", "Location"], ["industry", "Industry"]] as const).map(([k, lbl]) => (
                <label key={k} className="text-sm font-semibold">{lbl}
                  <input maxLength={200} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" />
                </label>
              ))}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <ToolbarButton onClick={() => setForm(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={save}><Save className="size-4" />Save Company</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
