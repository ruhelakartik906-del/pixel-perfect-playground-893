import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { db, exportCsv, guessMapping, importFields, prepareImport, readSheet, type ImportField, type ImportRow, type Named } from "@/lib/crm-data";

type Props = { open: boolean; onClose: () => void; sources: Named[]; companies: Named[]; stageId: string | null; pipelineId: string | null; existing: { phone: string; email: string }[] };

export function LeadImportDialog({ open, onClose, sources, companies, stageId, pipelineId, existing }: Props) {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<{ headers: string[]; rows: Record<string, unknown>[]; name: string } | null>(null);
  const [map, setMap] = useState<Partial<Record<ImportField, string>>>({});
  const [sourceId, setSourceId] = useState(""); const [companyId, setCompanyId] = useState("");
  const [result, setResult] = useState<{ ok: number; skipped: ImportRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const reset = () => { setSheet(null); setMap({}); setResult(null); };
  const prepared = sheet ? prepareImport(sheet.rows, map, existing) : [];
  const valid = prepared.filter((r) => !r.errors.length && !r.duplicate);

  const pick = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File must be under 5 MB"); return; }
    try {
      const s = await readSheet(file);
      if (!s.rows.length) { toast.error("No rows found in the file"); return; }
      if (s.rows.length > 5000) { toast.error("Import up to 5,000 rows at a time"); return; }
      setSheet({ ...s, name: file.name }); setMap(guessMapping(s.headers)); setResult(null);
    } catch { toast.error("Could not read this file. Use CSV or Excel (.xlsx)."); }
  };

  const run = async () => {
    if (!map.customer_name || !map.phone) { toast.error("Map Customer Name and Contact Number columns"); return; }
    if (!valid.length) { toast.error("No valid new rows to import"); return; }
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user?.id;
    let ok = 0; const failed: ImportRow[] = [];
    for (let i = 0; i < valid.length; i += 200) {
      const chunk = valid.slice(i, i + 200);
      // Imported leads stay unassigned so routing rules / admins decide ownership.
      const { error } = await db.from("leads").insert(chunk.map((r) => ({ ...r.data, source_id: sourceId || null, company_id: companyId || null, stage_id: stageId, pipeline_id: pipelineId, created_by: uid, form_answers: { imported_from: sheet!.name } })));
      if (error) failed.push(...chunk.map((r) => ({ ...r, errors: [error.message] }))); else ok += chunk.length;
    }
    setBusy(false);
    setResult({ ok, skipped: [...prepared.filter((r) => r.errors.length || r.duplicate), ...failed] });
    qc.invalidateQueries({ queryKey: ["admin-leads"] });
    toast.success(`${ok} leads imported`);
  };

  const sel = "mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm font-normal";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Import Leads</DialogTitle></DialogHeader>
        {!sheet ? (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center hover:bg-muted/40">
            <Upload className="size-10 text-admin-blue" />
            <span className="font-semibold">Choose a CSV or Excel file</span>
            <span className="text-sm text-muted-foreground">First row must contain column headers. Max 5,000 rows.</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-admin-green/15 p-4 text-success"><p className="text-sm font-semibold">Imported</p><p className="text-2xl font-bold">{result.ok}</p></div>
              <div className="rounded-lg bg-admin-red/10 p-4 text-admin-red"><p className="text-sm font-semibold">Skipped / failed</p><p className="text-2xl font-bold">{result.skipped.length}</p></div>
            </div>
            <div className="flex justify-end gap-2">
              {result.skipped.length > 0 && <ToolbarButton onClick={() => exportCsv(["Row", "Customer", "Phone", "Email", "Reason"], result.skipped.map((r) => [r.row, r.data.customer_name, r.data.phone, r.data.email, [...r.errors, r.duplicate ? "Duplicate" : ""].filter(Boolean).join("; ")]), "import-errors")}><Download className="size-4" />Error report</ToolbarButton>}
              <ToolbarButton primary onClick={() => { reset(); onClose(); }}>Done</ToolbarButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{sheet.name} · {sheet.rows.length} rows</p>
            <div className="grid gap-3 sm:grid-cols-4">
              {importFields.map((f) => (
                <label key={f.id} className="text-xs font-semibold">{f.label}{"required" in f && " *"}
                  <select className={sel} value={map[f.id] ?? ""} onChange={(e) => setMap({ ...map, [f.id]: e.target.value || undefined })}>
                    <option value="">— Skip —</option>{sheet.headers.map((h) => <option key={h}>{h}</option>)}</select></label>
              ))}
              <label className="text-xs font-semibold">Source for all rows<select className={sel} value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">— None —</option>{sources.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-xs font-semibold">Company<select className={sel} value={companyId} onChange={(e) => setCompanyId(e.target.value)}><option value="">— None —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <StatusBadge tone="green">{valid.length} ready</StatusBadge>
              <StatusBadge tone="orange">{prepared.filter((r) => r.duplicate && !r.errors.length).length} duplicates</StatusBadge>
              <StatusBadge tone="red">{prepared.filter((r) => r.errors.length).length} invalid</StatusBadge>
            </div>
            <DataTable columns={["Row", "Customer", "Phone", "Email", "Check"]} minWidth={700}>
              {prepared.slice(0, 20).map((r) => (
                <tr key={r.row}><td className="px-4 py-2">{r.row}</td><td className="px-4 py-2">{r.data.customer_name}</td><td className="px-4 py-2">{r.data.phone}</td><td className="px-4 py-2">{r.data.email}</td>
                  <td className="px-4 py-2">{r.errors.length ? <StatusBadge tone="red">{r.errors.join(", ")}</StatusBadge> : r.duplicate ? <StatusBadge tone="orange">Duplicate</StatusBadge> : <StatusBadge tone="green">OK</StatusBadge>}</td></tr>
              ))}
            </DataTable>
            {prepared.length > 20 && <p className="text-xs text-muted-foreground">Showing first 20 of {prepared.length} rows.</p>}
            <p className="text-xs text-muted-foreground">Imported leads arrive unassigned; duplicates (same phone or email) are skipped.</p>
            <div className="flex justify-end gap-2"><ToolbarButton onClick={reset}>Choose another file</ToolbarButton><ToolbarButton primary onClick={run}>{busy ? "Importing…" : `Import ${valid.length} leads`}</ToolbarButton></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
