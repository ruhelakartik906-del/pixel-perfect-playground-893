import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export function SalesField({ label, children }: { label: string; children: ReactNode }) {
  return <Label className="grid gap-1.5 text-sm font-semibold">{label}{children}</Label>;
}
export function TextField({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <SalesField label={label}><Input type={type} step={type === "number" ? "any" : undefined} required={required} maxLength={1000} value={value} onChange={(event) => onChange(event.target.value)} className="font-normal" /></SalesField>;
}
export function SalesPagination({ page, total, size, onPage, onSize }: { page: number; total: number; size: number; onPage: (page: number) => void; onSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="flex flex-wrap items-center justify-end gap-3 pt-4 text-sm"><span>Total {total} items</span><Button variant="ghost" size="icon" disabled={page <= 1} aria-label="Previous page" onClick={() => onPage(page - 1)}><ChevronLeft /></Button><span className="grid size-9 place-items-center rounded-md bg-admin-blue text-primary-foreground">{page}</span><Button variant="ghost" size="icon" disabled={page >= pages} aria-label="Next page" onClick={() => onPage(page + 1)}><ChevronRight /></Button><select aria-label="Items per page" className="h-9 rounded-md border bg-card px-2" value={size} onChange={(event) => { onSize(Number(event.target.value)); onPage(1); }}>{[10, 25, 50].map((number) => <option key={number} value={number}>{number} / page</option>)}</select></div>;
}
export function SalesActions({ name, items }: { name: string; items: { label: string; icon: ReactNode; action: () => void; destructive?: boolean }[] }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}><MoreVertical /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{items.map((item) => <DropdownMenuItem key={item.label} className={item.destructive ? "text-destructive" : ""} onClick={item.action}>{item.icon}{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
export function SalesConfirm({ title, description, busy, open, onClose, onConfirm, action }: { title: string; description: string; busy: boolean; open: boolean; onClose: () => void; onConfirm: () => void; action: string }) {
  return <AlertDialog open={open} onOpenChange={(value) => !value && !busy && onClose()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={onConfirm}>{busy ? "Saving…" : action}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
export function ProductImage({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (path) void supabase.storage.from("sales-product-images").createSignedUrl(path, 3600).then(({ data }) => { if (live) setUrl(data?.signedUrl ?? null); });
    return () => { live = false; };
  }, [path]);
  return url ? <img src={url} alt={name} className="size-10 shrink-0 rounded-md object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-md bg-admin-blue/10 text-admin-blue"><Package className="size-5" /></span>;
}