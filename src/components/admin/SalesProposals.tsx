import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import { salesQuery } from "@/lib/sales-data";
import { invoiceTotals, type TaxMode } from "@/lib/sales-finance";
import { salesDocument } from "@/lib/sales-documents";
import { safeLines, money } from "@/lib/user-phase4";
import { exportCsv } from "@/lib/crm-data";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const tone = (s: string) => (s === "accepted" ? "green" : s === "rejected" ? "red" : s === "sent" ? "blue" : "gray") as "green" | "red" | "blue" | "gray";

/** Read-only Admin oversight of the same proposal records users create. */
export function SalesProposals() {
  const { data } = useSuspenseQuery(salesQuery);
  const [q, setQ] = useState(""), [status, setStatus] = useState("all"), [creator, setCreator] = useState("all"), [page, setPage] = useState(1), [open, setOpen] = useState<string | null>(null);
  const size = 20;
  const client = (p: (typeof data.proposals)[number]) => String(rec(rec(p.document)["billing"])["name"] ?? "") || data.leads.find((l) => l.id === p.lead_id)?.customer_name || "—";
  const rows = data.proposals.filter((p) => (status === "all" || p.status === status) && (creator === "all" || p.created_by === creator) && [p.number, p.title, client(p), p.created_by_name, p.created_by_email].some((t) => t.toLowerCase().includes(q.toLowerCase())));
  const creators = [...new Map(data.proposals.map((p) => [p.created_by, p.created_by_name || p.created_by_email || "Unknown"])).entries()];
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  const viewed = data.proposals.find((p) => p.id === open);
  const pdf = async (p: (typeof data.proposals)[number]) => {
    const doc = rec(p.document), items = safeLines(doc["items"]), mode = (doc["tax_mode"] ?? "none") as TaxMode, t = invoiceTotals(items, mode);
    await salesDocument({ title: "Proposal", number: p.number, seller: rec(doc["seller"]), customer: rec(doc["billing"]), date: p.created_at.slice(0, 10), due: p.valid_until, currency: p.currency, lines: items.map((l) => [l.name, l.quantity, l.unit_price, l.discount_percent, l.tax_rate, invoiceTotals([l], mode).total]), summary: [["Subtotal", t.subtotal], ["Discount", t.discount], ["Tax", t.tax], ["Total", t.total]], terms: String(doc["terms"] ?? ""), notes: [doc["description"], doc["notes"]].filter(Boolean).join("\n") });
  };
  return <div className="space-y-5"><Breadcrumb label="Sales / Proposals" /><PageHeader title={`Proposals (${data.proposals.length})`}>
    <SearchInput placeholder="Search proposals..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-56" />
    <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All statuses</option>{["draft", "sent", "accepted", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
    <select aria-label="Filter by creator" value={creator} onChange={(e) => { setCreator(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All creators</option>{creators.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
    <Button variant="outline" onClick={() => exportCsv(["Number", "Title", "Client", "Created By", "Creator Email", "Workspace", "Total", "Currency", "Created", "Valid Until", "Status"], rows.map((p) => [p.number, p.title, client(p), p.created_by_name, p.created_by_email, p.company_id ? "Company" : "Personal", p.total, p.currency, p.created_at.slice(0, 10), p.valid_until, p.status]), "proposals")}><Download />Export</Button>
  </PageHeader>
  <Card className="p-5"><DataTable columns={["Proposal", "Client", "Created By", "Total", "Created", "Valid Until", "Status", "Actions"]} minWidth={1000}>
    {rows.slice((current - 1) * size, current * size).map((p) => <tr key={p.id} className="hover:bg-muted/40"><td className="px-4 py-4"><p className="font-semibold">{p.title}</p><p className="text-xs text-muted-foreground">{p.number} · {p.company_id ? "Company" : "Personal workspace"}</p></td><td className="px-4 py-4">{client(p)}</td><td className="px-4 py-4"><p className="font-medium">{p.created_by_name || "—"}</p><p className="text-xs text-muted-foreground">{p.created_by_email}</p></td><td className="px-4 py-4 font-semibold text-admin-blue">{money(p.total, p.currency)}</td><td className="px-4 py-4">{p.created_at.slice(0, 10)}</td><td className="px-4 py-4">{p.valid_until}</td><td className="px-4 py-4"><StatusBadge tone={tone(p.status)}>{p.status}</StatusBadge></td><td className="px-4 py-4"><div className="flex"><Button variant="ghost" size="icon" aria-label={`View ${p.number}`} onClick={() => setOpen(p.id)}><Eye /></Button><Button variant="ghost" size="icon" aria-label={`Download ${p.number}`} onClick={() => void pdf(p)}><Download /></Button></div></td></tr>)}
  </DataTable>{!rows.length && <EmptyState title="No proposals" hint="Proposals created in the User Panel appear here." />}
  <div className="mt-4 flex items-center justify-between text-sm"><span>{rows.length} records</span><div className="flex gap-2"><Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button><Button variant="outline" disabled={current * size >= rows.length} onClick={() => setPage(current + 1)}>Next</Button></div></div></Card>
  <Dialog open={!!viewed} onOpenChange={(v) => !v && setOpen(null)}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{viewed?.title} · {viewed?.number}</DialogTitle></DialogHeader>{viewed && (() => { const doc = rec(viewed.document), b = rec(doc["billing"]), s = rec(doc["seller"]), items = safeLines(doc["items"]); return <div className="space-y-4 text-sm">
    <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-muted-foreground">Created by</p><p className="font-semibold">{viewed.created_by_name || "—"}</p><p>{viewed.created_by_email}</p><p className="text-xs text-muted-foreground">{new Date(viewed.created_at).toLocaleString()} · {viewed.company_id ? "Company workspace" : "Personal workspace"}</p></div><div><p className="text-muted-foreground">Status</p><StatusBadge tone={tone(viewed.status)}>{viewed.status}</StatusBadge><p className="mt-1">Valid until {viewed.valid_until}</p></div>
    <div><p className="text-muted-foreground">Client</p>{["name", "company_name", "email", "phone", "address", "state", "country"].map((k) => b[k] ? <p key={k}>{String(b[k])}</p> : null)}</div><div><p className="text-muted-foreground">Seller</p>{["company_name", "address", "email", "phone", "gstin", "state"].map((k) => s[k] ? <p key={k}>{String(s[k])}</p> : null)}</div></div>
    <table className="w-full"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Item</th><th>Qty</th><th>Price</th><th>Disc %</th><th>Tax %</th><th className="text-right">Total</th></tr></thead><tbody>{items.map((l, i) => <tr key={i} className="border-b"><td className="py-2">{l.name}</td><td>{l.quantity}</td><td>{money(l.unit_price, viewed.currency)}</td><td>{l.discount_percent}</td><td>{l.tax_rate}</td><td className="text-right">{money(invoiceTotals([l], (doc["tax_mode"] ?? "none") as TaxMode).total, viewed.currency)}</td></tr>)}</tbody></table>
    <div className="flex justify-end gap-6"><span>Subtotal {money(viewed.subtotal, viewed.currency)}</span><span>Discount {money(viewed.discount_total, viewed.currency)}</span><span>Tax {money(viewed.tax_total, viewed.currency)}</span><span className="font-bold">Total {money(viewed.total, viewed.currency)}</span></div>
    {["description", "terms", "notes"].map((k) => doc[k] ? <div key={k}><p className="capitalize text-muted-foreground">{k}</p><p className="whitespace-pre-wrap">{String(doc[k])}</p></div> : null)}
    <div><p className="text-muted-foreground">History</p>{data.proposalEvents.filter((e) => e.proposal_id === viewed.id).map((e) => <p key={e.id} className="border-b py-1">{e.action.replaceAll("_", " ")} · {new Date(e.created_at).toLocaleString()}{e.note ? ` · ${e.note}` : ""}</p>)}</div>
  </div>; })()}</DialogContent></Dialog></div>;
}
