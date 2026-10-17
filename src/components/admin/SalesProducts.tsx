import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Eye, Pencil, Plus, Power, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { salesQuery, salesMoney, type Product } from "@/lib/sales-data";
import { validateProduct } from "@/lib/sales-validation";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv } from "@/lib/crm-data";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ProductImage, SalesActions, SalesConfirm, SalesField, SalesPagination, TextField } from "@/components/admin/sales-shared";

const blank = { name: "", kind: "product", description: "", code: "", category_id: "", selling_price: "0", cost_price: "", tax_rate: "0", image_path: null as string | null, is_active: true, stock_quantity: "0", service_duration: "", billing_frequency: "one_time" };
type Form = typeof blank & { id?: string };
const toForm = (product: Product): Form => ({ ...product, category_id: product.category_id ?? "", selling_price: String(product.selling_price), cost_price: product.cost_price === null ? "" : String(product.cost_price), tax_rate: String(product.tax_rate), stock_quantity: String(product.stock_quantity) });

export function SalesProducts() {
  const { data } = useSuspenseQuery(salesQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState<Form | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [del, setDel] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const view = data.products.find((item) => item.id === viewId);
  const categoryName = (id: string | null) => data.categories.find((item) => item.id === id)?.name ?? "—";
  const filtered = data.products.filter((item) => (tab === "all" || item.kind === tab) && (!category || item.category_id === category) && (status === "all" || item.is_active === (status === "active")) && [item.name, item.code, item.description, categoryName(item.category_id)].some((text) => text.toLowerCase().includes(q.toLowerCase())));
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / size)));
  const rows = filtered.slice((current - 1) * size, current * size);
  const openForm = (value: Form) => { setFile(null); setForm(value); };
  const reload = async () => { await qc.invalidateQueries({ queryKey: salesQuery.queryKey }); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || busy) return;
    const validation = validateProduct(form);
    if (validation) { toast.error(validation); return; }
    if (file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024)) { toast.error("Choose a JPG, PNG or WebP image up to 5 MB"); return; }
    setBusy(true);
    let uploaded: string | null = null;
    try {
      let imagePath = form.image_path;
      if (file) {
        const { data: auth, error } = await supabase.auth.getUser();
        if (error || !auth.user) throw new Error("Please sign in again");
        const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        uploaded = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from("sales-product-images").upload(uploaded, file, { contentType: file.type });
        if (upload.error) throw upload.error;
        imagePath = uploaded;
      }
      const payload = { name: form.name.trim(), kind: form.kind, description: form.description.trim(), code: form.code.trim(), category_id: form.category_id || null, selling_price: Number(form.selling_price), cost_price: form.cost_price === "" ? null : Number(form.cost_price), tax_rate: Number(form.tax_rate), image_path: imagePath, is_active: form.is_active, stock_quantity: Number(form.stock_quantity), service_duration: form.service_duration.trim(), billing_frequency: form.billing_frequency };
      const result = form.id ? await supabase.from("products_services").update(payload).eq("id", form.id).select("id").single() : await supabase.from("products_services").insert(payload).select("id").single();
      if (result.error) throw result.error;
      toast.success(form.id ? "Item updated" : "Item created");
      setForm(null); setFile(null); await reload();
    } catch (error) {
      if (uploaded) await supabase.storage.from("sales-product-images").remove([uploaded]);
      toast.error(error instanceof Error ? error.message : "Could not save item");
    } finally { setBusy(false); }
  };
  const toggle = async (item: Product) => {
    const result = await supabase.from("products_services").update({ is_active: !item.is_active }).eq("id", item.id).select("id").single();
    if (result.error) toast.error(result.error.message); else { toast.success(item.is_active ? "Item deactivated" : "Item activated"); await reload(); }
  };
  const remove = async () => {
    if (!del || busy) return;
    setBusy(true);
    const result = await supabase.from("products_services").delete().eq("id", del.id).select("id").single();
    if (result.error) toast.error(result.error.message); else { setDel(null); toast.success("Item deleted"); await reload(); }
    setBusy(false);
  };
  const download = () => exportCsv(["Name", "Type", "Code", "Category", "Stock", "Duration", "Selling Price", "Cost Price", "Tax Rate", "Billing Frequency", "Status"], filtered.map((item) => [item.name, item.kind, item.code, categoryName(item.category_id), item.stock_quantity, item.service_duration, item.selling_price, item.cost_price ?? "", item.tax_rate, item.billing_frequency, item.is_active ? "Active" : "Inactive"]), "products-services");

  return <div className="space-y-5">
    <Breadcrumb label="Sales / Products & Services" />
    <PageHeader title={`Products & Services (${data.products.length})`}>
      <SearchInput placeholder="Search products..." value={q} onChange={(value) => { setQ(value); setPage(1); }} className="w-64" />
      <Button variant="outline" onClick={download}><Download />Export</Button>
      <Button className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90" onClick={() => openForm({ ...blank })}><Plus />Add Product / Service</Button>
    </PageHeader>
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <Tabs value={tab} onValueChange={(value) => { setTab(value); setPage(1); }}><TabsList className="bg-transparent"><TabsTrigger value="all">All Items ({data.products.length})</TabsTrigger><TabsTrigger value="product">Products ({data.products.filter((item) => item.kind === "product").length})</TabsTrigger><TabsTrigger value="service">Services ({data.products.filter((item) => item.kind === "service").length})</TabsTrigger></TabsList></Tabs>
        <div className="flex gap-2"><select aria-label="Category filter" className="h-9 rounded-md border bg-card px-2 text-sm" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Status filter" className="h-9 rounded-md border bg-card px-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
      <DataTable columns={["Product / Service Details", "Category", "Stock / Duration", "Price Info", "Actions"]} minWidth={800}>
        {rows.map((item) => <tr key={item.id} className="hover:bg-muted/40">
          <td className="px-4 py-4"><div className="flex items-center gap-3"><ProductImage path={item.image_path} name={item.name} /><div><p className="flex flex-wrap items-center gap-2 font-semibold">{item.name}<StatusBadge tone={item.kind === "product" ? "blue" : "purple"}>{item.kind === "product" ? "Product" : "Service"}</StatusBadge>{!item.is_active && <StatusBadge>Inactive</StatusBadge>}</p><p className="text-xs text-muted-foreground">{item.kind === "product" ? "SKU" : "Code"}: {item.code || "—"}</p></div></div></td>
          <td className="px-4 py-4"><StatusBadge>{categoryName(item.category_id)}</StatusBadge></td>
          <td className="px-4 py-4">{item.kind === "product" ? <><p>{item.stock_quantity} units</p><StatusBadge tone={item.stock_quantity > 0 ? "green" : "red"}>{item.stock_quantity > 0 ? "In stock" : "Out of stock"}</StatusBadge></> : <><p>{item.service_duration || "—"}</p><p className="text-xs text-muted-foreground">{item.billing_frequency.replaceAll("_", " ")}</p></>}</td>
          <td className="px-4 py-4"><p className="font-semibold">{salesMoney(item.selling_price)}</p><p className="text-xs text-muted-foreground">Cost: {salesMoney(item.cost_price)}</p></td>
          <td className="px-4 py-4"><SalesActions name={item.name} items={[{ label: "View", icon: <Eye />, action: () => setViewId(item.id) }, { label: "Edit", icon: <Pencil />, action: () => openForm(toForm(item)) }, { label: "Duplicate", icon: <Copy />, action: () => { const copy = toForm(item); delete copy.id; openForm({ ...copy, name: `${item.name} (copy)`, code: "" }); } }, { label: item.is_active ? "Deactivate" : "Activate", icon: <Power />, action: () => void toggle(item) }, { label: "Delete", icon: <Trash2 />, action: () => setDel(item), destructive: true }]} /></td>
        </tr>)}
      </DataTable>
      {!rows.length && <div className="bg-admin-blue/5"><EmptyState title="No data" /></div>}
      <SalesPagination page={current} total={filtered.length} size={size} onPage={setPage} onSize={setSize} />
    </Card>
    <Dialog open={!!form} onOpenChange={(open) => !open && !busy && setForm(null)}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form?.id ? "Edit Product / Service" : "Add Product / Service"}</DialogTitle><DialogDescription>Product catalog</DialogDescription></DialogHeader>{form && <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <SalesField label="Type"><select className="h-9 rounded-md border bg-card px-3" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="product">Product</option><option value="service">Service</option></select></SalesField>
      <TextField label="Name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
      <TextField label="SKU / Service Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
      <SalesField label="Category"><select className="h-9 rounded-md border bg-card px-3" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">None</option>{data.categories.filter((item) => item.is_active || item.id === form.category_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></SalesField>
      <TextField label="Selling Price" type="number" required value={form.selling_price} onChange={(value) => setForm({ ...form, selling_price: value })} />
      <TextField label="Cost Price (optional)" type="number" value={form.cost_price} onChange={(value) => setForm({ ...form, cost_price: value })} />
      <TextField label="Tax Rate (%)" type="number" value={form.tax_rate} onChange={(value) => setForm({ ...form, tax_rate: value })} />
      <SalesField label="Status"><select className="h-9 rounded-md border bg-card px-3" value={form.is_active ? "active" : "inactive"} onChange={(event) => setForm({ ...form, is_active: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></SalesField>
      {form.kind === "product" ? <TextField label="Stock Quantity" type="number" value={form.stock_quantity} onChange={(value) => setForm({ ...form, stock_quantity: value })} /> : <><TextField label="Service Duration" value={form.service_duration} onChange={(value) => setForm({ ...form, service_duration: value })} /><SalesField label="Billing Frequency"><select className="h-9 rounded-md border bg-card px-3" value={form.billing_frequency} onChange={(event) => setForm({ ...form, billing_frequency: event.target.value })}>{["one_time", "monthly", "quarterly", "yearly"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></SalesField></>}
      <div className="sm:col-span-2"><SalesField label="Description"><Textarea value={form.description} maxLength={4000} onChange={(event) => setForm({ ...form, description: event.target.value })} /></SalesField></div>
      <div className="sm:col-span-2"><SalesField label="Product Image"><div className="flex items-center gap-3"><ProductImage path={form.image_path} name={form.name} /><label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-normal"><Upload className="size-4" /><span>{file?.name ?? "Choose image"}</span><input aria-label="Product image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{form.image_path && <Button type="button" variant="ghost" size="icon" aria-label="Remove image" onClick={() => { setFile(null); setForm({ ...form, image_path: null }); }}><Trash2 /></Button>}</div></SalesField></div>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy} className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90"><Save />{busy ? "Saving…" : "Save Item"}</Button></div>
    </form>}</DialogContent></Dialog>
    <Sheet open={!!view} onOpenChange={(open) => !open && setViewId(null)}><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{view?.name}</SheetTitle></SheetHeader>{view && <div className="mt-6 space-y-5"><ProductImage path={view.image_path} name={view.name} /><dl className="grid grid-cols-2 gap-4 text-sm">{[["Type", view.kind], ["Code", view.code], ["Category", categoryName(view.category_id)], ["Selling Price", salesMoney(view.selling_price)], ["Cost Price", salesMoney(view.cost_price)], ["Tax Rate", `${view.tax_rate}%`], ["Stock", view.stock_quantity], ["Duration", view.service_duration], ["Billing", view.billing_frequency], ["Status", view.is_active ? "Active" : "Inactive"]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value || "—"}</dd></div>)}</dl><p className="text-sm">{view.description}</p><Button onClick={() => { openForm(toForm(view)); setViewId(null); }}><Pencil />Edit</Button></div>}</SheetContent></Sheet>
    <SalesConfirm open={!!del} busy={busy} title="Delete item?" description={`Permanently remove ${del?.name ?? "this item"} from the catalog?`} action="Delete" onClose={() => setDel(null)} onConfirm={() => void remove()} />
  </div>;
}