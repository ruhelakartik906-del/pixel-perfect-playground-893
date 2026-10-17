import { useState } from "react";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, ArrowRight, CheckCircle2, Copy, Eye, GitBranch, Pause, Pencil, Play, Plus, RotateCcw, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb, Card, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loadAdRouting, saveAdRouting, changeAdRouting, type AdRoutingData } from "@/lib/ad-routing.functions";
import { validateAllocations, type Allocation } from "@/lib/routing";

export const adRoutingQuery = queryOptions({ queryKey: ["ad-routing"], queryFn: () => loadAdRouting() });
export const personName = (data: AdRoutingData, id: string) => data.people.find((p) => p.id === id)?.full_name || data.people.find((p) => p.id === id)?.email || "Unknown user";
export const companyName = (data: AdRoutingData, id: string) => data.companies.find((c) => c.id === id)?.name || "No company";
export function RoutingSelect({ value, onChange, children, label, disabled = false }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label: string; disabled?: boolean }) {
  return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-10 max-w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{children}</select>;
}
export function RoutingPagination({ page, total, setPage }: { page: number; total: number; setPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return <div className="flex items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground"><span>{total} records · Page {page} of {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>;
}
export function RoutingAction({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <Button variant="ghost" size="icon" title={title} aria-label={title} onClick={onClick} disabled={disabled}>{children}</Button>;
}

type RuleForm = {
  id?: string; company_id: string; name: string; account_id: string; page_id: string; campaign_id: string;
  campaign_name: string; adset_id: string; ad_id: string; creative_id: string; creative_name: string; status: "draft" | "active" | "paused"; steps: Allocation[];
};
const blank: RuleForm = { company_id: "", name: "", account_id: "", page_id: "", campaign_id: "", campaign_name: "", adset_id: "", ad_id: "", creative_id: "", creative_name: "", status: "draft", steps: [{ user_id: "", quota: 5 }] };

export function AdRoutingSetup() {
  const { data } = useSuspenseQuery(adRoutingQuery);
  const queryClient = useQueryClient();
  const save = useServerFn(saveAdRouting), change = useServerFn(changeAdRouting);
  const [q, setQ] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const [form, setForm] = useState<RuleForm | null>(null), [readOnly, setReadOnly] = useState(false), [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; action: "reset" | "deleted"; name: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ad-routing"] });
  async function act(id: string, action: "reset" | "deleted" | "duplicate" | "active" | "paused") {
    setBusy(true);
    try { await change({ data: { id, action } }); await refresh(); setConfirm(null); toast.success(action === "reset" ? "Counters reset; audit recorded" : "Routing rule updated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setBusy(false); }
  }
  function open(r: any, view = false) {
    setReadOnly(view);
    setForm({ ...r, steps: data.steps.filter((s) => s.rule_id === r.id).sort((a, b) => a.position - b.position).map((s) => ({ id: s.id, user_id: s.user_id, quota: s.quota, assigned_count: s.assigned_count })) });
  }
  async function submit(nextStatus: RuleForm["status"]) {
    if (!form) return;
    const invalid = validateAllocations(form.steps);
    if (invalid) { toast.error(invalid); return; }
    if (!form.company_id || !form.name.trim() || !form.account_id.trim()) { toast.error("Company, rule name and real ad account ID are required"); return; }
    setBusy(true);
    try { await save({ data: { ...form, status: nextStatus } }); await refresh(); setForm(null); toast.success(nextStatus === "active" ? "Rule activated" : "Rule saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  const filtered = data.rules.filter((r) => (!status || r.status === status) && [r.name, r.account_id, r.campaign_id, r.campaign_name, r.ad_id, r.creative_name].join(" ").toLowerCase().includes(q.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  const update = (key: keyof RuleForm, value: string) => setForm((prev) => prev ? { ...prev, [key]: value } : null);
  const stepUpdate = (index: number, patch: Partial<Allocation>) => setForm((prev) => prev ? { ...prev, steps: prev.steps.map((s, i) => i === index ? { ...s, ...patch } : s) } : null);
  function move(index: number, delta: number) {
    if (!form) return;
    const steps = [...form.steps], other = steps[index + delta], item = steps[index];
    if (!other || !item) return;
    steps[index] = other; steps[index + delta] = item; setForm({ ...form, steps });
  }
  const sourceLeads = data.leads.filter((l) => form && l.company_id === form.company_id && l.meta_account_id);
  return <div className="space-y-5">
    <Breadcrumb label="Ad Routing Setup" trail={["Ad Lead Routing"]} />
    <PageHeader title="Ad Routing Setup"><Button onClick={() => { setReadOnly(false); setForm({ ...blank, steps: [{ user_id: "", quota: 5 }] }); }}><Plus className="size-4" />Create Routing Rule</Button></PageHeader>
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard tone="blue" icon={GitBranch} label="Total Routing Rules" value={data.rules.length} note="All saved rules" />
      <KpiCard tone="green" icon={CheckCircle2} label="Active Rules" value={data.rules.filter((r) => r.status === "active").length} note="Available for matching leads" />
      <KpiCard tone="orange" icon={Pause} label="Paused Rules" value={data.rules.filter((r) => r.status === "paused").length} note="Not assigning leads" />
      <KpiCard tone="purple" icon={Users} label="Total Routed Leads" value={data.events.filter((e) => e.assignment_type === "automatic").length} note="Recorded automatic assignments" />
    </div>
    <Card><div className="flex flex-wrap gap-3 p-4"><SearchInput placeholder="Search routing rules..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="min-w-0 flex-1" /><RoutingSelect label="Rule status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}><option value="">All statuses</option>{["draft", "active", "paused"].map((s) => <option key={s}>{s}</option>)}</RoutingSelect></div>
      <DataTable columns={["Rule Name", "Ad Account", "Campaign / Ad", "Assigned Users", "Total Leads", "Status", "Actions"]} minWidth={1000}>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map((r) => <tr key={r.id}>
        <td className="px-4 py-4 font-semibold">{r.name}<p className="text-xs font-normal text-muted-foreground">{companyName(data, r.company_id)}</p></td>
        <td className="px-4 py-4">{r.account_id}</td><td className="px-4 py-4">{r.creative_name || r.ad_id || r.campaign_name || r.campaign_id || "All account leads"}</td>
        <td className="max-w-64 px-4 py-4 text-sm">{data.steps.filter((s) => s.rule_id === r.id).sort((a, b) => a.position - b.position).map((s) => personName(data, s.user_id)).join(" → ")}</td><td className="px-4 py-4">{r.total_leads}</td>
        <td className="px-4 py-4"><StatusBadge tone={r.status === "active" ? "green" : r.status === "paused" ? "orange" : "gray"}>{r.status}</StatusBadge></td>
        <td className="whitespace-nowrap px-4 py-4"><RoutingAction title="View rule" onClick={() => open(r, true)}><Eye className="size-4" /></RoutingAction><RoutingAction title="Edit rule" onClick={() => open(r)}><Pencil className="size-4" /></RoutingAction><RoutingAction title="Duplicate rule" onClick={() => void act(r.id, "duplicate")} disabled={busy}><Copy className="size-4" /></RoutingAction><RoutingAction title={r.status === "active" ? "Pause rule" : "Activate rule"} onClick={() => void act(r.id, r.status === "active" ? "paused" : "active")} disabled={busy}>{r.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}</RoutingAction><RoutingAction title="Reset quota counters" onClick={() => setConfirm({ id: r.id, action: "reset", name: r.name })}><RotateCcw className="size-4" /></RoutingAction><RoutingAction title="Delete rule" onClick={() => setConfirm({ id: r.id, action: "deleted", name: r.name })}><Trash2 className="size-4" /></RoutingAction></td>
      </tr>)}</DataTable>{!filtered.length && <EmptyState title="No routing rules found" />}<RoutingPagination page={currentPage} total={filtered.length} setPage={setPage} />
    </Card>
    <Dialog open={form !== null} onOpenChange={(v) => { if (!v && !busy) setForm(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto"><DialogTitle>{readOnly ? "Routing Rule" : form?.id ? "Edit Routing Rule" : "Create Routing Rule"}</DialogTitle><DialogDescription>{form?.name || "Meta Ads"}</DialogDescription>
      {form && <><fieldset disabled={readOnly || busy} className="min-w-0 space-y-6">
        <div><h3 className="mb-3 border-b pb-2 font-semibold">Ad Source Selection</h3><div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">Company / Client<RoutingSelect label="Company / Client" value={form.company_id} onChange={(v) => update("company_id", v)} disabled={readOnly || busy}><option value="">Select company</option>{data.companies.filter((c) => c.is_active || c.id === form.company_id).map((c) => <option key={c.id} value={c.id}>{c.name}{!c.is_active && " (inactive)"}</option>)}</RoutingSelect></label>
          <label className="grid gap-1.5 text-sm">Platform<Input value="Meta Ads" readOnly /></label>
          {([ ["name", "Rule Name"], ["account_id", "Ad Account ID"], ["page_id", "Facebook / Instagram Page ID"], ["campaign_id", "Campaign ID"], ["campaign_name", "Campaign Name"], ["adset_id", "Ad Set ID (optional)"], ["ad_id", "Specific Ad ID"], ["creative_id", "Creative / Video ID"], ["creative_name", "Creative / Video Name"] ] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm">{label}<Input list={`routing-${key}`} value={form[key]} onChange={(e) => update(key, e.target.value)} /><datalist id={`routing-${key}`}>{[...new Set(sourceLeads.map((l) => l[`meta_${key === "creative_name" ? "ad_name" : key}`]).filter(Boolean).concat(data.rules.filter((r) => r.company_id === form.company_id).map((r) => r[key]).filter(Boolean)))].map((v) => <option key={String(v)} value={String(v)} />)}</datalist></label>)}
        </div></div>
        <div><h3 className="mb-3 border-b pb-2 font-semibold">Lead Distribution</h3><div className="space-y-3">{form.steps.map((step, i) => {
          const options = data.eligible.filter((m) => m.company_id === form.company_id);
          const valid = options.some((m) => m.user_id === step.user_id);
          return <div key={step.id || i}><div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3"><span className="mb-2 font-semibold text-muted-foreground">{i + 1}</span><label className="grid min-w-0 flex-1 gap-1 text-xs">User<RoutingSelect label={`Step ${i + 1} user`} value={step.user_id} onChange={(v) => stepUpdate(i, { user_id: v, id: undefined, assigned_count: 0 })} disabled={readOnly || busy}><option value="">Select user</option>{step.user_id && !valid && <option value={step.user_id}>{personName(data, step.user_id)} (ineligible)</option>}{options.map((m) => <option key={m.user_id} value={m.user_id}>{personName(data, m.user_id)}</option>)}</RoutingSelect></label>
            <label className="grid gap-1 text-xs">Quota<RoutingSelect label={`Step ${i + 1} quota mode`} value={step.quota === null ? "unlimited" : "fixed"} onChange={(v) => stepUpdate(i, { quota: v === "unlimited" ? null : 5 })} disabled={readOnly || busy}><option value="fixed">Fixed limit</option><option value="unlimited">Unlimited</option></RoutingSelect></label>{step.quota !== null && <label className="grid w-24 gap-1 text-xs">Limit<Input aria-label={`Step ${i + 1} limit`} type="number" min={1} value={step.quota} onChange={(e) => stepUpdate(i, { quota: Number(e.target.value) })} /></label>}
            <span className="pb-3 text-xs text-muted-foreground">Assigned: {step.assigned_count || 0}</span><div><RoutingAction title={`Move step ${i + 1} up`} onClick={() => move(i, -1)} disabled={i === 0 || readOnly}><ArrowUp className="size-4" /></RoutingAction><RoutingAction title={`Move step ${i + 1} down`} onClick={() => move(i, 1)} disabled={i === form.steps.length - 1 || readOnly}><ArrowDown className="size-4" /></RoutingAction><RoutingAction title={`Remove step ${i + 1}`} onClick={() => setForm({ ...form, steps: form.steps.filter((_, n) => n !== i) })} disabled={readOnly}><X className="size-4" /></RoutingAction></div>
          </div>{step.user_id && !valid && <p className="mt-1 text-xs text-destructive">User is blocked, inactive or not authorized for this company.</p>}{i < form.steps.length - 1 && <ArrowDown className="mx-auto mt-2 size-4 text-muted-foreground" />}</div>;
        })}</div><Button variant="outline" className="mt-3" onClick={() => setForm({ ...form, steps: [...form.steps, { user_id: "", quota: 5 }] })}><Plus className="size-4" />Add Next User</Button>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{form.steps.map((s, i) => <span key={i} className="inline-flex items-center gap-2">{i > 0 && <ArrowRight className="size-4" />}{s.user_id ? personName(data, s.user_id) : "Select user"} · {s.quota ?? "Unlimited"}</span>)}</div></div>
      </fieldset>
      {readOnly && <div className="border-t pt-3"><h3 className="font-semibold">Audit History</h3>{data.audits.filter((a) => a.rule_id === form.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10).map((a) => <p key={a.id} className="mt-2 text-sm text-muted-foreground">{a.action} · {new Date(a.created_at).toLocaleString()} · {personName(data, a.actor_id)}</p>)}</div>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={busy} onClick={() => setForm(null)}>{readOnly ? "Close" : "Cancel"}</Button>{!readOnly && <><Button variant="outline" disabled={busy} onClick={() => void submit("draft")}>Save Draft</Button><Button disabled={busy} onClick={() => void submit("active")}>{busy ? "Saving..." : "Save & Activate"}</Button></>}</div></>}
    </DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={(v) => { if (!v && !busy) setConfirm(null); }}><DialogContent><DialogTitle>{confirm?.action === "reset" ? "Reset quota counters?" : "Delete routing rule?"}</DialogTitle><DialogDescription>{confirm?.name}. {confirm?.action === "reset" ? "All allocation counters return to zero. Existing assignments and history are unchanged; the reset is audited." : "The rule will stop matching future leads. Assignment history remains intact."}</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={() => confirm && void act(confirm.id, confirm.action)}>Confirm</Button></div></DialogContent></Dialog>
  </div>;
}