import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Save, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, TabBar, ToolbarButton } from "@/components/admin/ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { leadColumnCatalog } from "@/lib/crm-config";
import { AddLeadDialog } from "@/components/pipeline/AddLeadDialog";
import type { BoardStage } from "@/lib/leads-board";
import { readAllPages } from "@/lib/backend-read";
import { LeadImportDialog } from "@/components/admin/LeadImportDialog";

export const Route = createFileRoute("/_authenticated/admin/crm/leads")({
  head: () => ({ meta: [
    { title: "Leads — Routiva CRM Admin" },
    { name: "description", content: "Manage every incoming lead across companies and campaigns." },
    { property: "og:title", content: "Leads — Routiva CRM Admin" },
    { property: "og:description", content: "Manage every incoming lead across companies and campaigns." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LeadsPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["admin-leads"];
type Lead = any;
type Named = { id: string; name: string; color?: string; is_active?: boolean };
type Tab = "today" | "yesterday" | "week" | "month" | "all";

async function load() {
  const r = await Promise.all([
    readAllPages((o,e)=>db.from("leads").select("*").order("id").range(o,e)),
    db.from("crm_stages").select("*").eq("kind", "lead").order("position"),
    db.from("crm_options").select("id,name,is_active").eq("category", "source").order("position"),
    db.from("crm_pipelines").select("id,is_default"),
    db.from("crm_list_views").select("columns").eq("module", "leads").maybeSingle(),
    db.from("profiles").select("id,full_name,email,account_status"),
    db.from("companies").select("id,name"),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
  const people = (r[5].data as { id: string; full_name: string; email: string; account_status: string }[]);
  return {
    leads: r[0] as Lead[], stages: r[1].data as import("@/lib/leads-board").BoardStage[], sources: r[2].data as Named[],
    defaultPipeline: (r[3].data as { id: string; is_default: boolean }[]).find((p) => p.is_default)?.id ?? null,
    columns: (r[4].data?.columns as string[] | undefined) ?? leadColumnCatalog.map((c) => c.id),
    people: people.map((p) => ({ id: p.id, name: p.full_name || p.email, active: p.account_status === "active" })),
    companies: r[6].data as Named[],
  };
}

function inTab(d: string, tab: Tab) {
  if (tab === "all") return true;
  const t = new Date(d), now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (tab === "today") return t >= day;
  if (tab === "yesterday") return t >= new Date(day.getTime() - 864e5) && t < day;
  if (tab === "week") return t >= new Date(day.getTime() - day.getDay() * 864e5);
  return t >= new Date(now.getFullYear(), now.getMonth(), 1);
}


export function LeadsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(true);
  const [addStage, setAddStage] = useState<BoardStage | null>(null);
  const [open, setOpen] = useState<Lead | null>(null);
  const [importing, setImporting] = useState(false);

  const name = (list: Named[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.name ?? "—";
  const filtered = useMemo(() => (data?.leads ?? []).filter((l) => inTab(l.created_at, tab) &&
    (!q || [l.customer_name, l.phone, l.email, l.business_name].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase())))), [data, tab, q]);
  const tabs = (["today", "yesterday", "week", "month", "all"] as Tab[]).map((id) => ({
    id, label: { today: "Today", yesterday: "Yesterday", week: "This Week", month: "This Month", all: "All" }[id],
    count: (data?.leads ?? []).filter((l) => inTab(l.created_at, id)).length,
  }));
  const cols = (data?.columns ?? []).map((id) => leadColumnCatalog.find((c) => c.id === id)).filter(Boolean) as { id: string; label: string }[];

  const cell = (l: Lead, id: string) => {
    switch (id) {
      case "stage": { const s = data?.stages.find((x) => x.id === l.stage_id); return s ? <span className="rounded px-2 py-1 text-xs font-semibold" style={{ background: `${s.color}22`, color: s.color }}>{s.name}</span> : "—"; }
      case "source": return name(data?.sources, l.source_id);
      case "assignee": return l.assigned_to ? name(data?.people, l.assigned_to) : <StatusBadge tone="orange">Unassigned</StatusBadge>;
      case "company": return name(data?.companies, l.company_id);
      case "campaign": return l.meta_campaign_name || l.meta_ad_name || "—";
      case "created_at": return new Date(l.created_at).toLocaleString();
      case "status": return <StatusBadge tone={l.status === "open" ? "blue" : l.status === "won" ? "green" : "gray"}>{l.status}</StatusBadge>;
      default: return l[id] || "—";
    }
  };

  const exportCsv = () => {
    if (!filtered.length) { toast.info("No leads to export"); return; }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = (l: Lead, id: string) => { const v = cell(l, id); return typeof v === "string" ? v : id === "stage" ? name(data?.stages, l.stage_id) : id === "assignee" ? name(data?.people, l.assigned_to) : l[id]; };
    const csv = [cols.map((c) => esc(c.label)).join(","), ...filtered.map((l) => cols.map((c) => esc(text(l, c.id))).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "leads.csv"; a.click();
  };

  const label = tabs.find((t) => t.id === tab)?.label || 'All';
  return (
    <div className="space-y-5">
      <Breadcrumb label="Leads" />
      <PageHeader title="Leads" />
      <div className="flex flex-wrap items-center gap-3"><SearchInput value={q} onChange={setQ} placeholder="Search leads"/><div className="ml-auto flex gap-2"><ToolbarButton onClick={exportCsv}><Download className="size-4"/>Export</ToolbarButton><ToolbarButton onClick={()=>setImporting(true)}><Upload className="size-4"/>Import</ToolbarButton><ToolbarButton primary onClick={()=>setAddStage(data?.stages.find(s=>s.board_initial&&s.pipeline_id===data.defaultPipeline)||data?.stages.find(s=>s.is_active)||null)}><Plus className="size-4"/>Add Lead</ToolbarButton></div></div>
      <TabBar tabs={tabs} value={tab} onChange={v=>setTab(v as Tab)}/>
      {isLoading?<p className="py-20 text-center text-muted-foreground">Loading leads…</p>:error?<EmptyState title="Could not load leads" hint={(error as Error).message}/>:<div className="overflow-x-auto rounded-md border bg-card"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-muted"><tr><th className="p-3">Name</th>{cols.map(c=><th className="p-3" key={c.id}>{c.label}</th>)}</tr></thead><tbody>{filtered.map(l=><tr key={l.id} className="cursor-pointer border-b hover:bg-muted" onClick={()=>setOpen(l)}><td className="p-3 font-semibold">{l.customer_name}</td>{cols.map(c=><td key={c.id} className="p-3">{cell(l,c.id)}</td>)}</tr>)}</tbody></table>{!filtered.length&&<EmptyState title="No leads"/>}</div>}

      {addStage && data && <AddLeadDialog stage={addStage} stages={data.stages} sources={data.sources} companies={data.companies} close={()=>setAddStage(null)}/> }

      {data && <LeadImportDialog open={importing} onClose={() => setImporting(false)} sources={data.sources} companies={data.companies} stageId={data.stages.find((s) => s.is_active)?.id ?? null} pipelineId={data.defaultPipeline} existing={data.leads.map((l: Lead) => ({ phone: l.phone ?? "", email: l.email ?? "" }))} />}
      <LeadDrawer lead={data?.leads.find(l=>l.id===open?.id)||open} onClose={() => setOpen(null)} data={data} />
    </div>
  );
}

function LeadDrawer({ lead, onClose, data }: { lead: Lead | null; onClose: () => void; data: Awaited<ReturnType<typeof load>> | undefined }) {
  const qc = useQueryClient();
  const acts = useQuery({ queryKey: ["lead-acts", lead?.id], enabled: !!lead, queryFn: async () => {
    const { data, error } = await db.from("lead_activities").select("*").eq("lead_id", lead?.id).order("created_at", { ascending: false });
    if (error) throw error; return data as { id: string; type: string; detail: string; created_at: string }[];
  } });
  const update = async (patch: Record<string, unknown>) => {
    const { error } = await db.from("leads").update(patch).eq("id", lead?.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead updated"); qc.invalidateQueries({ queryKey: QK }); qc.invalidateQueries({ queryKey: ["lead-acts", lead?.id] });
  };
  const answers = Object.entries((lead?.form_answers ?? {}) as Record<string, unknown>);
  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{lead?.customer_name || "Lead"}</SheetTitle></SheetHeader>
        {lead && data && (
          <div className="mt-5 space-y-6 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              {[["Phone", lead.phone], ["Email", lead.email], ["Business", lead.business_name], ["Category", lead.business_category],
                ["Requirement", lead.requirements], ["Interest", lead.interest_level], ["Campaign", lead.meta_campaign_name], ["Ad", lead.meta_ad_name || lead.meta_ad_id]]
                .map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v || "—"}</dd></div>)}
            </dl>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold">Stage
                <select value={lead.stage_id ?? ""} onChange={(e) => update({ stage_id: e.target.value || null })} className="mt-1 h-10 w-full rounded-md border bg-card px-2 font-normal">
                  <option value="">—</option>{data.stages.filter(s=>s.pipeline_id===lead.pipeline_id&&s.is_active&&!s.board_closed).map((s) => <option key={s.id} value={s.id}>{s.board_label || s.name}</option>)}
                </select>
              </label>
              <label className="font-semibold">Assignee
                <select value={lead.assigned_to ?? ""} onChange={(e) => update({ assigned_to: e.target.value || null })} className="mt-1 h-10 w-full rounded-md border bg-card px-2 font-normal">
                  <option value="">Unassigned</option>{data.people.filter((p) => p.active || p.id === lead.assigned_to).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            </div>
            <section>
              <h3 className="mb-2 font-bold">Form answers</h3>
              {answers.length ? answers.map(([k, v]) => <p key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</p>)
                : <p className="text-muted-foreground">No form answers (manually created lead).</p>}
            </section>
            <section>
              <h3 className="mb-2 font-bold">Activity</h3>
              <ul className="space-y-2">
                {(acts.data ?? []).map((a) => <li key={a.id} className="rounded border p-2"><span className="font-semibold capitalize">{a.type.replace("_", " ")}</span> — {a.type === "reassigned" ? (data.people.find((p) => p.id === a.detail)?.name ?? a.detail) : a.detail}
                  <span className="block text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></li>)}
              </ul>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
