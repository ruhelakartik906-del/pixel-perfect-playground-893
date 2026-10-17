import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Eye, Pencil, Plus, Power, Save, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { salesQuery, salesMoney, type Customer } from "@/lib/sales-data";
import { existingCustomerForLead, validateCustomer } from "@/lib/sales-validation";
import { exportCsv } from "@/lib/crm-data";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SalesActions, SalesConfirm, SalesField, SalesPagination, TextField } from "@/components/admin/sales-shared";

const blank = { name: "", kind: "individual", company_name: "", phone: "", email: "", gstin: "", address: "", city: "", state: "", country: "", postal_code: "", notes: "", lead_id: "" };
type Form = typeof blank & { id?: string };
const toForm = (customer: Customer): Form => ({ ...customer, lead_id: customer.lead_id ?? "" });
export function SalesCustomers() {
  const { data } = useSuspenseQuery(salesQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState<Form | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [archive, setArchive] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const filtered = data.customers.filter((customer) => (status === "all" || customer.is_active === (status === "active")) && [customer.name, customer.company_name, customer.phone, customer.email, customer.city, customer.state, customer.gstin, `CN#${customer.customer_number}`].some((text) => text.toLowerCase().includes(q.toLowerCase())));
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / size)));
  const rows = filtered.slice((current - 1) * size, current * size);
  const view = data.customers.find((customer) => customer.id === viewId);
  const lead = data.leads.find((item) => item.id === view?.lead_id);
  const linkedDeals = view?.lead_id ? data.deals.filter((item) => item.lead_id === view.lead_id) : [];
  const reload = async () => { await qc.invalidateQueries({ queryKey: salesQuery.queryKey }); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || busy) return;
    const validation = validateCustomer(form);
    if (validation) { toast.error(validation); return; }
    const existing = existingCustomerForLead(data.customers, form.lead_id);
    if (existing && existing.id !== form.id) { toast.info("This lead already has a sales customer"); setForm(null); setViewId(existing.id); return; }
    setBusy(true);
    const payload = { name: form.name.trim(), kind: form.kind, company_name: form.company_name.trim(), phone: form.phone.trim(), email: form.email.trim(), gstin: form.gstin.trim(), address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), country: form.country.trim(), postal_code: form.postal_code.trim(), notes: form.notes.trim(), lead_id: form.lead_id || null };
    const result = form.id ? await supabase.from("sales_customers").update(payload).eq("id", form.id).select("id").single() : await supabase.from("sales_customers").insert(payload).select("id").single();
    if (result.error) toast.error(result.error.message); else { toast.success(form.id ? "Customer updated" : "Customer created"); setForm(null); await reload(); }
    setBusy(false);
  };
  const archiveCustomer = async () => {
    if (!archive || busy) return;
    setBusy(true);
    const result = await supabase.from("sales_customers").update({ is_active: !archive.is_active }).eq("id", archive.id).select("id").single();
    if (result.error) toast.error(result.error.message); else { toast.success(archive.is_active ? "Customer archived" : "Customer restored"); setArchive(null); await reload(); }
    setBusy(false);
  };
  const convert = (id: string) => {
    if (!form) return;
    const existing = existingCustomerForLead(data.customers, id);
    if (existing && existing.id !== form.id) { toast.info("This lead already has a sales customer"); setForm(null); setViewId(existing.id); return; }
    const selected = data.leads.find((item) => item.id === id);
    setForm(selected ? { ...form, lead_id: id, name: selected.customer_name, phone: selected.phone, email: selected.email, company_name: selected.business_name, city: selected.region, kind: selected.business_name ? "business" : "individual" } : { ...form, lead_id: "" });
  };
  const download = () => exportCsv(["Customer ID", "Name", "Type", "Company", "Phone", "Email", "GSTIN", "Address", "City", "State", "Country", "Postal Code", "Notes", "Status", "Created At"], filtered.map((customer) => [`CN#${customer.customer_number}`, customer.name, customer.kind, customer.company_name, customer.phone, customer.email, customer.gstin, customer.address, customer.city, customer.state, customer.country, customer.postal_code, customer.notes, customer.is_active ? "Active" : "Archived", customer.created_at]), "sales-customers");
  return <div className="space-y-5"><Breadcrumb label="Sales / Customers" /><PageHeader title={`Customers (${data.customers.length})`}>
    <SearchInput placeholder="Search customers..." value={q} onChange={(value) => { setQ(value); setPage(1); }} className="w-64" /><Button variant="outline" onClick={download}><Download />Export</Button><Button className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90" onClick={() => setForm({ ...blank })}><Plus />Add Customer</Button>
  </PageHeader><Card className="p-5"><div className="mb-4 flex justify-end"><select aria-label="Customer status filter" className="h-9 rounded-md border bg-card px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="active">Active customers</option><option value="archived">Archived customers</option><option value="all">All customers</option></select></div><DataTable columns={["Customer Details", "Contact Info", "Location", "GST / Tax Number", "Created At", "Actions"]} minWidth={850}>
    {rows.map((customer) => <tr key={customer.id} className="hover:bg-muted/40"><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground"><User className="size-4" /></span><div><p className="font-semibold">{customer.name}</p><p className="text-xs text-muted-foreground">CN#{customer.customer_number}</p>{!customer.is_active && <StatusBadge>Archived</StatusBadge>}</div></div></td><td className="px-4 py-4"><p>{customer.phone || "N/A"}</p><p className="text-xs text-muted-foreground">{customer.email || "N/A"}</p></td><td className="px-4 py-4"><p>{customer.city || "N/A"}</p><p className="text-xs text-muted-foreground">{[customer.state, customer.country].filter(Boolean).join(", ") || "N/A"}</p></td><td className="px-4 py-4">{customer.gstin || "—"}</td><td className="px-4 py-4 text-sm text-muted-foreground">{new Date(customer.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td><td className="px-4 py-4"><SalesActions name={customer.name} items={[{ label: "View", icon: <Eye />, action: () => setViewId(customer.id) }, { label: "Edit", icon: <Pencil />, action: () => setForm(toForm(customer)) }, { label: customer.is_active ? "Archive" : "Restore", icon: customer.is_active ? <Archive /> : <Power />, action: () => setArchive(customer), destructive: customer.is_active }]} /></td></tr>)}
  </DataTable>{!rows.length && <div className="bg-admin-blue/5"><EmptyState title="No data" /></div>}<SalesPagination page={current} total={filtered.length} size={size} onPage={setPage} onSize={setSize} /></Card>
  <Dialog open={!!form} onOpenChange={(open) => !open && !busy && setForm(null)}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form?.id ? "Edit Customer" : "Add Customer"}</DialogTitle><DialogDescription>Sales customer details</DialogDescription></DialogHeader>{form && <form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><SalesField label="Convert Existing Lead (optional)"><select aria-label="Convert existing lead" className="h-9 rounded-md border bg-card px-3" value={form.lead_id} onChange={(event) => convert(event.target.value)}><option value="">None</option>{data.leads.map((item) => <option key={item.id} value={item.id}>{item.customer_name} — {item.phone}</option>)}</select></SalesField></div><SalesField label="Customer Type"><select className="h-9 rounded-md border bg-card px-3" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="individual">Individual</option><option value="business">Business</option></select></SalesField>
    {([['name', 'Customer Name'], ['company_name', 'Company Name'], ['phone', 'Phone'], ['email', 'Email'], ['gstin', 'GSTIN (optional)'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['postal_code', 'Postal Code']] as const).map(([key, label]) => <TextField key={key} label={label} required={key === "name"} type={key === "email" ? "email" : "text"} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} />)}
    <div className="sm:col-span-2"><SalesField label="Notes"><Textarea value={form.notes} maxLength={4000} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></SalesField></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy} className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90"><Save />{busy ? "Saving…" : "Save Customer"}</Button></div>
  </form>}</DialogContent></Dialog>
  <Sheet open={!!view} onOpenChange={(open) => !open && setViewId(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>{view?.name}</SheetTitle></SheetHeader>{view && <div className="mt-6 space-y-6"><StatusBadge tone={view.is_active ? "green" : "gray"}>CN#{view.customer_number} · {view.is_active ? "Active" : "Archived"}</StatusBadge><dl className="grid grid-cols-2 gap-4 text-sm">{[["Type", view.kind], ["Company", view.company_name], ["Phone", view.phone], ["Email", view.email], ["GSTIN", view.gstin], ["Address", view.address], ["City", view.city], ["State", view.state], ["Country", view.country], ["Postal Code", view.postal_code]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-semibold">{value || "—"}</dd></div>)}</dl><p className="text-sm">{view.notes}</p><section><h3 className="mb-2 font-semibold">Linked Lead</h3>{lead ? <p className="text-sm">{lead.customer_name} · {lead.phone}</p> : <p className="text-sm text-muted-foreground">No linked lead</p>}</section><section><h3 className="mb-2 font-semibold">Linked Deals ({linkedDeals.length})</h3>{linkedDeals.length ? linkedDeals.map((deal) => <div key={deal.id} className="flex justify-between border-b py-2 text-sm"><span>{deal.title}</span><span>{salesMoney(deal.amount)}</span></div>) : <p className="text-sm text-muted-foreground">No linked deals</p>}</section><section className="space-y-3 text-sm text-muted-foreground"><h3 className="font-semibold text-foreground">Invoices, Payments & Credit Notes</h3><p>Not available yet</p></section><Button onClick={() => { setForm(toForm(view)); setViewId(null); }}><Pencil />Edit Customer</Button></div>}</SheetContent></Sheet>
  <SalesConfirm open={!!archive} busy={busy} title={archive?.is_active ? "Archive customer?" : "Restore customer?"} description={archive?.is_active ? `Archive ${archive.name}? Their records and lead association will be preserved.` : `Restore ${archive?.name ?? "this customer"} to the active list?`} action={archive?.is_active ? "Archive" : "Restore"} onClose={() => setArchive(null)} onConfirm={() => void archiveCustomer()} /></div>;
}