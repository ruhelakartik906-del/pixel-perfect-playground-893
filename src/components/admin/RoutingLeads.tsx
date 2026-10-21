import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, History, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { adRoutingQuery, companyName, personName, RoutingAction, RoutingPagination, RoutingSelect } from "@/components/admin/AdRouting";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { assignRoutingLeads } from "@/lib/ad-routing.functions";
import { exportCsv } from "@/lib/crm-data";
import { unassignedLeads } from "@/lib/routing-records";

export function RoutingLeads({ history = false }: { history?: boolean }) {
  const { data } = useSuspenseQuery(adRoutingQuery);
  const queryClient = useQueryClient(), assign = useServerFn(assignRoutingLeads);
  const [q, setQ] = useState(""), [company, setCompany] = useState(""), [user, setUser] = useState(""), [campaign, setCampaign] = useState(""), [from, setFrom] = useState(""), [to, setTo] = useState(""), [reason, setReason] = useState(""), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]), [detail, setDetail] = useState<any>(null), [assignmentIds, setAssignmentIds] = useState<string[]>([]), [assignUser, setAssignUser] = useState(""), [busy, setBusy] = useState(false);
  const rows: any[] = history ? data.events.map((event) => ({ ...event, lead: event.snapshot.lead, company_name: event.snapshot.company_name, user_name: event.snapshot.user_name, rule_name: event.snapshot.rule_name }))
    : unassignedLeads(data.leads).map((lead) => ({ id: lead.id, lead, company_id: lead.company_id, created_at: lead.created_at, reason: data.queue.find((r) => r.lead_id === lead.id)?.reason || (lead.intake_source === "manual" ? "Manual lead awaiting assignment" : !lead.company_id ? "Missing company" : "Awaiting routing review") }));
  const filtered = rows.filter((r) => {
    const l = r.lead || {};
    return (!company || r.company_id === company) && (!user || r.user_id === user) && (!campaign || l.meta_campaign_id === campaign)
      && (!reason || r.reason === reason) && (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to)
      && [l.customer_name, l.phone, l.email, l.meta_account_id, l.meta_campaign_name, l.meta_ad_name, r.rule_name, r.user_name, r.company_name, r.reason].join(" ").toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const activeSelected = selected.filter((id) => filtered.some((r) => r.id === id));
  const selectedCompanies = [...new Set(assignmentIds.map((id) => data.leads.find((l) => l.id === id)?.company_id))];
  const assignmentCompany = selectedCompanies.length === 1 ? selectedCompanies[0] : null;
  const manualSelection = assignmentIds.every(id => data.leads.find(l => l.id === id)?.intake_source === "manual");
  const eligible = selectedCompanies.length === 1 ? (manualSelection ? data.manualRecipients : data.eligible).filter((m) => m.company_id === assignmentCompany) : [];
  const title = history ? "Lead Assignment History" : "Unassigned Leads";
  const headers = history ? ["Lead Name", "Phone", "Email", "Company", "Ad Account", "Campaign / Video", "Assigned User", "Routing Rule", "Assignment Date", "Assignment Type", "Status"] : ["Select", "Lead Name", "Phone", "Email", "Source / Campaign", "Company", "Created Date", "Unassigned Reason", "Actions"];
  function requestAssign(ids: string[]) { setAssignmentIds(ids); setAssignUser(""); }
  async function perform(ids: string[], target: string | null) {
    setBusy(true);
    try {
      const results = await assign({ data: { lead_ids: ids, user_id: target } });
      const assigned = results.filter((r) => (r.result as any)?.status === "assigned").length;
      const failed = results.find((r) => r.error);
      await queryClient.invalidateQueries({ queryKey: ["ad-routing"] });
      setAssignmentIds([]); setSelected([]);
      if (failed) toast.error(failed.error || "Assignment failed");
      else toast.info(`${assigned} assigned · ${results.length - assigned} unchanged or still unassigned`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Assignment failed"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><Breadcrumb label={title} trail={["Ad Lead Routing"]} /><PageHeader title={title}>{history ? <Button variant="outline" onClick={() => exportCsv(headers, filtered.map((r) => [r.lead.customer_name, r.lead.phone, r.lead.email, r.company_name || companyName(data, r.company_id), r.lead.meta_account_id || "", r.lead.meta_ad_name || r.lead.meta_campaign_name || r.lead.meta_campaign_id || "", r.user_name || personName(data, r.user_id), r.rule_name || "Manual", r.created_at, r.assignment_type, r.status]), "lead-assignment-history")}><Download className="size-4" />Export CSV</Button> : <><Button variant="outline" disabled={busy || !activeSelected.length} onClick={() => void perform(activeSelected, null)}><RotateCcw className="size-4" />Retry Selected</Button><Button disabled={busy || !activeSelected.length} onClick={() => requestAssign(activeSelected)}><UserPlus className="size-4" />Bulk Assign ({activeSelected.length})</Button></>}</PageHeader>
    <Card><div className="flex flex-wrap gap-3 p-4"><SearchInput placeholder="Search leads..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="min-w-0 flex-1" /><RoutingSelect label="Company filter" value={company} onChange={(v) => { setCompany(v); setPage(1); }}><option value="">All companies</option>{data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</RoutingSelect><RoutingSelect label="Campaign filter" value={campaign} onChange={(v) => { setCampaign(v); setPage(1); }}><option value="">All campaigns</option>{[...new Set(rows.map((r) => r.lead?.meta_campaign_id).filter(Boolean))].map((id) => <option key={String(id)} value={String(id)}>{rows.find((r) => r.lead.meta_campaign_id === id)?.lead.meta_campaign_name || id}</option>)}</RoutingSelect>
      {history ? <RoutingSelect label="User filter" value={user} onChange={(v) => { setUser(v); setPage(1); }}><option value="">All users</option>{data.people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</RoutingSelect> : <RoutingSelect label="Unassigned reason filter" value={reason} onChange={(v) => { setReason(v); setPage(1); }}><option value="">All reasons</option>{[...new Set(rows.map((r) => r.reason))].map((v) => <option key={v}>{v}</option>)}</RoutingSelect>}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">From<Input aria-label="From date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label><label className="flex items-center gap-2 text-sm text-muted-foreground">To<Input aria-label="To date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
    </div><DataTable columns={headers} minWidth={history ? 1650 : 1350}>{visible.map((r) => <tr key={r.id}>
      {!history && <td className="px-4 py-4"><Checkbox aria-label={`Select ${r.lead.customer_name}`} checked={selected.includes(r.id)} disabled={busy} onCheckedChange={(v) => setSelected((prev) => v ? [...prev, r.id].slice(0, 100) : prev.filter((id) => id !== r.id))} /></td>}
      <td className="px-4 py-4"><div className="flex items-center gap-2"><span className="font-semibold">{r.lead?.customer_name || "Unnamed lead"}</span><RoutingAction title="View lead details" onClick={() => setDetail(r)}><Eye className="size-4" /></RoutingAction></div></td><td className="px-4 py-4">{r.lead?.phone || "—"}</td><td className="px-4 py-4">{r.lead?.email || "—"}</td>
      {history ? <><td className="px-4 py-4">{r.company_name || companyName(data, r.company_id)}</td><td className="px-4 py-4">{r.lead?.meta_account_id || "—"}</td><td className="px-4 py-4">{r.lead?.meta_ad_name || r.lead?.meta_campaign_name || r.lead?.meta_campaign_id || "—"}</td><td className="px-4 py-4">{r.user_name || personName(data, r.user_id)}</td><td className="px-4 py-4">{r.rule_name || "Manual assignment"}</td><td className="px-4 py-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td><td className="px-4 py-4 capitalize">{r.assignment_type}</td><td className="px-4 py-4"><StatusBadge tone="green">{r.status}</StatusBadge></td></> : <><td className="px-4 py-4">{r.lead.meta_account_id ? "Meta Ads" : "CRM"}<p className="text-xs text-muted-foreground">{r.lead.meta_campaign_name || r.lead.meta_campaign_id || "—"}</p></td><td className="px-4 py-4">{companyName(data, r.company_id)}</td><td className="px-4 py-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td><td className="px-4 py-4 text-sm text-muted-foreground">{r.reason}</td><td className="px-4 py-4 whitespace-nowrap"><RoutingAction title="Assign to user" onClick={() => requestAssign([r.id])} disabled={busy}><UserPlus className="size-4" /></RoutingAction><RoutingAction title="Retry automatic assignment" onClick={() => void perform([r.id], null)} disabled={busy}><RotateCcw className="size-4" /></RoutingAction><RoutingAction title="Assignment history" onClick={() => setDetail({ ...r, showHistory: true })}><History className="size-4" /></RoutingAction></td></>}
    </tr>)}</DataTable>{!filtered.length && <EmptyState title={history ? "No assignment events found" : "No unassigned leads found"} />}<RoutingPagination page={currentPage} total={filtered.length} setPage={setPage} /></Card>
    <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>{detail?.showHistory ? "Assignment History" : "Lead Details"}</DialogTitle><DialogDescription>{detail?.lead?.customer_name}</DialogDescription>{detail && <><dl className="grid grid-cols-2 gap-3 text-sm">{[["Phone", detail.lead.phone], ["Email", detail.lead.email], ["Company", detail.company_name || companyName(data, detail.company_id)], ["Account", detail.lead.meta_account_id], ["Campaign", detail.lead.meta_campaign_name || detail.lead.meta_campaign_id], ["Ad", detail.lead.meta_ad_name || detail.lead.meta_ad_id], ["Creative ID", detail.lead.meta_creative_id], ["Requirements", detail.lead.requirements], ["Status", detail.lead.status], ["Reason", detail.reason]].map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-muted-foreground">{key}</dt><dd className="break-words">{value || "—"}</dd></div>)}</dl><div className="border-t pt-3"><h3 className="font-semibold">Assignment Events</h3>{data.events.filter((e) => e.lead_id === (detail.lead_id || detail.lead.id)).map((e) => <p key={e.id} className="mt-3 text-sm">{e.assignment_type} · {e.snapshot.user_name} · {new Date(e.created_at).toLocaleString()}</p>)}{!data.events.some((e) => e.lead_id === (detail.lead_id || detail.lead.id)) && <p className="mt-3 text-sm text-muted-foreground">No recorded assignment events.</p>}</div></>}</DialogContent></Dialog>
    <Dialog open={assignmentIds.length > 0} onOpenChange={(v) => { if (!v && !busy) setAssignmentIds([]); }}><DialogContent><DialogTitle>Assign {assignmentIds.length} Lead{assignmentIds.length > 1 ? "s" : ""}</DialogTitle><DialogDescription>{assignmentCompany ? companyName(data, assignmentCompany) : "Select leads from one company with an active eligible user."}</DialogDescription><RoutingSelect label="Assignment user" value={assignUser} onChange={setAssignUser} disabled={busy}><option value="">Select authorized user</option>{eligible.map((m) => <option key={m.user_id} value={m.user_id}>{personName(data, m.user_id)}</option>)}</RoutingSelect>{!eligible.length && <p className="text-sm text-destructive">No active authorized users available for this selection.</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAssignmentIds([])}>Cancel</Button><Button disabled={busy || !assignUser} onClick={() => void perform(assignmentIds, assignUser)}>{busy ? "Assigning..." : "Confirm Assignment"}</Button></div></DialogContent></Dialog>
  </div>;
}