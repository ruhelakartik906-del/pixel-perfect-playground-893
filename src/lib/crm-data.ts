/** Shared CRM data helpers: lookups, filters, import validation and file exports. */
import { supabase } from "@/integrations/supabase/client";

export const db = supabase as unknown as { from: (t: string) => any };
export type Named = { id: string; name: string; color?: string; is_active?: boolean };
export type Row = any;

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export async function loadLookups() {
  const r = await Promise.all([
    db.from("crm_stages").select("id,name,color,is_active,kind,position").order("position"),
    db.from("crm_options").select("id,name,is_active,category").order("position"),
    db.from("profiles").select("id,full_name,email,account_status"),
    db.from("companies").select("id,name"),
    db.from("crm_pipelines").select("id,is_default"),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  return {
    leadStages: (r[0].data as Row[]).filter((s) => s.kind === "lead") as Named[],
    dealStages: (r[0].data as Row[]).filter((s) => s.kind === "deal") as Named[],
    sources: (r[1].data as Row[]).filter((o) => o.category === "source") as Named[],
    contractTypes: (r[1].data as Row[]).filter((o) => o.category === "contract_type") as Named[],
    people: (r[2].data as Row[]).map((p) => ({ id: p.id, name: p.full_name || p.email, is_active: p.account_status === "active" })) as Named[],
    companies: r[3].data as Named[],
    defaultPipeline: ((r[4].data as Row[]).find((p) => p.is_default)?.id ?? null) as string | null,
  };
}
export type Lookups = Awaited<ReturnType<typeof loadLookups>>;
export const nameOf = (list: Named[] | undefined, id: string | null | undefined, fallback = "—") => list?.find((x) => x.id === id)?.name ?? fallback;

// ---------- Report filters ----------
export type ReportFilters = { from?: string | undefined; to?: string | undefined; sourceId?: string | undefined; status?: string | undefined; assignee?: string | undefined };
export function filterLeads<T extends { created_at: string; source_id?: string | null; status?: string; assigned_to?: string | null }>(rows: T[], f: ReportFilters): T[] {
  const from = f.from ? new Date(f.from + "T00:00:00") : null;
  const to = f.to ? new Date(f.to + "T23:59:59.999") : null;
  return rows.filter((r) => {
    const d = new Date(r.created_at);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (f.sourceId && r.source_id !== f.sourceId) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.assignee === "unassigned" ? r.assigned_to : f.assignee && r.assigned_to !== f.assignee) return false;
    return true;
  });
}

// ---------- Import ----------
export const importFields = [
  { id: "customer_name", label: "Customer Name", required: true }, { id: "phone", label: "Contact Number", required: true },
  { id: "email", label: "Email" }, { id: "business_name", label: "Business Name" }, { id: "business_category", label: "Business Category" },
  { id: "requirements", label: "Required Service" }, { id: "interest_level", label: "Interest Level" }, { id: "region", label: "Region" },
] as const;
export type ImportField = (typeof importFields)[number]["id"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Guess a field mapping from spreadsheet headers. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, string>> {
  const alias: Record<ImportField, string[]> = {
    customer_name: ["customername", "name", "fullname", "customer"], phone: ["phone", "contactnumber", "mobile", "contactno", "phonenumber"],
    email: ["email", "emailaddress"], business_name: ["businessname", "company", "business"], business_category: ["businesscategory", "category"],
    requirements: ["requiredservice", "requirement", "requirements", "service"], interest_level: ["interestlevel", "interest"], region: ["region", "city", "state", "location"],
  };
  const out: Partial<Record<ImportField, string>> = {};
  for (const [f, names] of Object.entries(alias) as [ImportField, string[]][]) {
    const h = headers.find((x) => names.includes(norm(x)));
    if (h) out[f] = h;
  }
  return out;
}
export const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);

export type ImportRow = { row: number; data: Record<ImportField, string>; errors: string[]; duplicate: boolean };
/** Validate mapped rows; duplicates are matched by last 10 phone digits or email against existing leads and earlier rows. */
export function prepareImport(raw: Record<string, unknown>[], map: Partial<Record<ImportField, string>>, existing: { phone: string; email: string }[]): ImportRow[] {
  const phones = new Set(existing.map((e) => normPhone(e.phone)).filter(Boolean));
  const emails = new Set(existing.map((e) => e.email.toLowerCase()).filter(Boolean));
  return raw.map((r, i) => {
    const data = Object.fromEntries(importFields.map((f) => [f.id, String((map[f.id] ? r[map[f.id]!] : "") ?? "").trim().slice(0, 500)])) as Record<ImportField, string>;
    const errors: string[] = [];
    if (!data.customer_name) errors.push("Customer name missing");
    if (normPhone(data.phone).length < 7) errors.push("Invalid phone");
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Invalid email");
    const p = normPhone(data.phone), e = data.email.toLowerCase();
    const duplicate = (!!p && phones.has(p)) || (!!e && emails.has(e));
    if (p) phones.add(p);
    if (e) emails.add(e);
    return { row: i + 2, data, errors, duplicate };
  });
}

// ---------- Exports ----------
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function exportCsv(headers: string[], rows: (string | number)[][], name: string) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  downloadBlob(new Blob([[headers, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}
export async function exportXlsx(headers: string[], rows: (string | number)[][], name: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Report");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
}
export async function exportPdf(title: string, headers: string[], rows: (string | number)[][], name: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: headers.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14); doc.text(title, 14, 16);
  doc.setFontSize(9); doc.text(`Routiva CRM — generated ${new Date().toLocaleString()} — ${rows.length} records`, 14, 22);
  autoTable(doc, { head: [headers], body: rows.map((r) => r.map(String)), startY: 27, styles: { fontSize: 8 }, headStyles: { fillColor: [38, 132, 255] } });
  downloadBlob(doc.output("blob"), `${name}.pdf`);
}
export async function readSheet(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
  const headers = (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] ?? []).map(String);
  return { headers, rows };
}

/** Blue date badge label: TODAY / YESTERDAY / formatted date. */
export function dateBadge(iso: string) {
  const d = new Date(iso), now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day.getTime() - that.getTime()) / 864e5);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "YESTERDAY";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}
