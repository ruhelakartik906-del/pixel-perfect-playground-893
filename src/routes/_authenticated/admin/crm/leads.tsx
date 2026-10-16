import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Save, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, TabBar, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { leadColumnCatalog } from "@/lib/crm-config";

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
type Lead = Record<string, any> & { id: string; created_at: string };
type Named = { id: string; name: string; color?: string; is_active?: boolean };
type Tab = "today" | "yesterday" | "week" | "month" | "all";

async function load() {
  const r = await Promise.all([
    db.from("leads").select("*").order("created_at", { ascending: false }).limit(2000),
    db.from("crm_stages").select("id,name,color,is_active,pipeline_id").eq("kind", "lead").order("position"),
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
    leads: r[0].data as Lead[], stages: r[1].data as (Named & { pipeline_id: string })[], sources: r[2].data as Named[],
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

const blank = { customer_name: "", phone: "", email: "", business_name: "", business_category: "", requirements: "", interest_level: "", stage_id: "", source_id: "", assigned_to: "", company_id: "" };

function LeadsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(true);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [open, setOpen] = useState<Lead | null>(null);

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
      case "stage": { const s = data!.stages.find((x) => x.id === l.stage_id); return s ? <span className="rounded px-2 py-1 text-xs font-semibold" style={{ background: `${s.color}22`, color: s.color }}>{s.name}</span> : "—"; }
      case "source": return name(data!.sources, l.source_id);
      case "assignee": return l.assigned_to ? name(data!.people, l.assigned_to) : <StatusBadge tone="orange">Unassigned</StatusBadge>;
      case "company": return name(data!.companies, l.company_id);
      case "campaign": return l.meta_campaign_name || l.meta_ad_name || "—";
      case "created_at": return new Date(l.created_at).toLocaleString();
      case "status": return <StatusBadge tone={l.status === "open" ? "blue" : l.status === "won" ? "green" : "gray"}>{l.status}</StatusBadge>;
      default: return l[id] || "—";
    }
  };

  const save = async () => {
    if (!form) return;
    if (!form.customer_name.trim() || !form.phone.trim()) return toast.error("Customer name and contact number are required");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("Enter a valid email");
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, k.endsWith("_id") || k === "assigned_to" ? (v || null) : v.trim()]));
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("leads").insert({ ...payload, pipeline_id: data?.defaultPipeline, created_by: u.user?.id, form_answers: {} });
    if (error) return toast.error(error.message);
    toast.success("Lead created"); setForm(null); qc.invalidateQueries({ queryKey: QK });
  };

  const exportCsv = () => {
    if (!filtered.length) return toast.info("No leads to export");
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = (l: Lead, id: string) => { const v = cell(l, id); return typeof v === "string" ? v : id === "stage" ? name(data!.stages, l.stage_id) : id === "assignee" ? name(data!.people, l.assigned_to) : l[id]; };
    const csv = [cols.map((c) => esc(c.label)).join(","), ...filtered.map((l) => cols.map((c) => esc(text(l, c.id))).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "leads.csv"; a.click();
  };

  const label = tabs.find((t) => t.id === tab)!.label;
  return (
    <div className="space-y-5">
      <Breadcrumb label={`All Leads (${data?.leads.length ?? 0})`} />
      <PageHeader title={`${label === "All" ? "All" : label + "'s"} Leads (${filtered.length})`} subtitle="Manage all leads in the system">
        <SearchInput placeholder="Search leads..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton onClick={() => toast.info("CSV import is not available yet.")}><Upload className="size-4" />Import</ToolbarButton>
        <ToolbarButton onClick={exportCsv}><Download className="size-4" />Export</ToolbarButton>
        <label className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-[15px] font-semibold">
          <Zap className="size-4 text-admin-orange" />Quick Mode<Switch checked={quick} onCheckedChange={setQuick} />
        </label>
        <ToolbarButton primary onClick={() => setForm({ ...blank, stage_id: data?.stages.find((s) => s.is_active)?.id ?? "" })}><Plus className="size-4" />Create Lead</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        <div className="mb-5"><TabBar tabs={tabs} value={tab} onChange={setTab} /></div>
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading leads…</p>
          : error ? <EmptyState title="Could not load leads" hint={(error as Error).message} />
          : <>
            <DataTable columns={["No.", ...cols.map((c) => c.label)]} minWidth={Math.max(900, cols.length * 160)}>
              {filtered.map((l, i) => (
                <tr key={l.id} onClick={() => setOpen(l)} className="cursor-pointer hover:bg-muted/40">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  {cols.map((c) => <td key={c.id} className="whitespace-nowrap px-4 py-3">{cell(l, c.id)}</td>)}
                </tr>
              ))}
            </DataTable>
            {filtered.length === 0 && <EmptyState title="No leads" hint="Leads appear here when created manually or received from connected ad forms." />}
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create Lead</DialogTitle></DialogHeader>
          {form && data && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([["customer_name", "Customer Name *"], ["phone", "Contact Number *"], ["email", "Email"], ["business_name", "Business Name"],
                ["business_category", "Business Category"], ["requirements", "Required Service"], ["interest_level", "Interest Level"]] as const).map(([k, lbl]) => (
                <label key={k} className="text-sm font-semibold">{lbl}
                  <input maxLength={200} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3 font-normal" />
                </label>
              ))}
              {([["stage_id", "Stage", data.stages.filter((s) => s.is_active)], ["source_id", "Source", data.sources.filter((s) => s.is_active)],
                ["assigned_to", "Assignee", data.people.filter((p) => p.active)], ["company_id", "Company", data.companies]] as const).map(([k, lbl, list]) => (
                <label key={k} className="text-sm font-semibold">{lbl}
                  <select value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-card px-3 font-normal">
                    <option value="">— None —</option>
                    {(list as Named[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
              ))}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <ToolbarButton onClick={() => setForm(null)}>Cancel</ToolbarButton>
                <ToolbarButton primary onClick={save}><Save className="size-4" />Save Lead</ToolbarButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LeadDrawer lead={open} onClose={() => setOpen(null)} data={data} />
    </div>
  );
}

function LeadDrawer({ lead, onClose, data }: { lead: Lead | null; onClose: () => void; data: Awaited<ReturnType<typeof load>> | undefined }) {
  const qc = useQueryClient();
  const acts = useQuery({ queryKey: ["lead-acts", lead?.id], enabled: !!lead, queryFn: async () => {
    const { data, error } = await db.from("lead_activities").select("*").eq("lead_id", lead!.id).order("created_at", { ascending: false });
    if (error) throw error; return data as { id: string; type: string; detail: string; created_at: string }[];
  } });
  const update = async (patch: Record<string, unknown>) => {
    const { error } = await db.from("leads").update(patch).eq("id", lead!.id);
    if (error) return toast.error(error.message);
    toast.success("Lead updated"); qc.invalidateQueries({ queryKey: QK }); qc.invalidateQueries({ queryKey: ["lead-acts", lead!.id] });
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
                  <option value="">—</option>{data.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
