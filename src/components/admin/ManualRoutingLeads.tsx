import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { adRoutingQuery, companyName, personName, RoutingAction, RoutingPagination, RoutingSelect } from "@/components/admin/AdRouting";
import { Card, DataTable, EmptyState, SearchInput, StatusBadge } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { leadAnswer, manualLeads, savedLeadAnswers } from "@/lib/routing-records";

export function ManualRoutingLeads() {
  const { data } = useSuspenseQuery(adRoutingQuery);
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const [detail, setDetail] = useState<(typeof data.leads)[number] | null>(null);
  const rows = manualLeads(data.leads).filter(lead => {
    const answers = savedLeadAnswers(lead.form_answers);
    return (!status || (status === "assigned" ? !!lead.assigned_to : !lead.assigned_to)) &&
      [lead.customer_name, lead.phone, lead.email, lead.business_name, answers["Required Service"], answers["Lead Source"], lead.assigned_to ? personName(data, lead.assigned_to) : "Unassigned"].join(" ").toLowerCase().includes(search.toLowerCase());
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)));
  const answers = savedLeadAnswers(detail?.form_answers);
  return <Card>
    <div className="flex flex-wrap items-center gap-3 p-5">
      <h3 className="mr-auto text-xl font-bold">Manual Leads</h3>
      <SearchInput placeholder="Search manual leads..." value={search} onChange={value => { setSearch(value); setPage(1); }} className="min-w-0 flex-1 sm:max-w-80" />
      <RoutingSelect label="Manual lead assignment status" value={status} onChange={value => { setStatus(value); setPage(1); }}><option value="">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></RoutingSelect>
    </div>
    <DataTable columns={["Client Name", "Phone", "Email", "Business Name", "Required Service", "Source", "Assigned User", "Assignment Status", "Created Date", "View Details"]} minWidth={1500}>
      {rows.slice((currentPage - 1) * 20, currentPage * 20).map(lead => {
        const saved = savedLeadAnswers(lead.form_answers);
        return <tr key={lead.id}>
          <td className="px-4 py-4 font-semibold">{lead.customer_name || "Unnamed lead"}</td>
          <td className="px-4 py-4">{lead.phone || "—"}</td><td className="px-4 py-4">{lead.email || "—"}</td><td className="px-4 py-4">{lead.business_name || "—"}</td>
          <td className="px-4 py-4">{leadAnswer(saved["Required Service"])}</td><td className="px-4 py-4">{leadAnswer(saved["Lead Source"])}</td>
          <td className="px-4 py-4">{lead.assigned_to ? personName(data, lead.assigned_to) : "—"}</td>
          <td className="px-4 py-4"><StatusBadge tone={lead.assigned_to ? "green" : "orange"}>{lead.assigned_to ? "Assigned" : "Unassigned"}</StatusBadge></td>
          <td className="whitespace-nowrap px-4 py-4">{new Date(lead.created_at).toLocaleString()}</td>
          <td className="px-4 py-4"><RoutingAction title={`View details for ${lead.customer_name || "Unnamed lead"}`} onClick={() => setDetail(lead)}><Eye className="size-4" /></RoutingAction></td>
        </tr>;
      })}
    </DataTable>
    {!rows.length && <EmptyState title="No manual leads found" />}
    <RoutingPagination page={currentPage} total={rows.length} setPage={setPage} />
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>Manual Lead Details</DialogTitle><DialogDescription>{detail?.customer_name}</DialogDescription>
        {detail && <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Client Name", detail.customer_name], ["Phone", detail.phone], ["Email", detail.email], ["Business Name", detail.business_name],
            ["Business Category", detail.business_category], ["Company / Workspace", detail.company_id ? companyName(data, detail.company_id) : "Private user workspace"],
            ["Assigned User", detail.assigned_to ? personName(data, detail.assigned_to) : "Unassigned"], ["Assignment Status", detail.assigned_to ? "Assigned" : "Unassigned"],
            ["Lead Status", detail.status], ["Created Date", new Date(detail.created_at).toLocaleString()], ["Updated Date", new Date(detail.updated_at).toLocaleString()],
            ["Created By", personName(data, detail.created_by)], ["Region", detail.region], ["Priority", detail.interest_level], ["Notes", detail.requirements],
            ...Object.entries(answers),
          ].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-muted-foreground">{String(label)}</dt><dd className="whitespace-pre-wrap break-words">{leadAnswer(value)}</dd></div>)}
        </dl>}
      </DialogContent>
    </Dialog>
  </Card>;
}