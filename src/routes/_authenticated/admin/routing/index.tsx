import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, GitBranch, Inbox, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb, Card, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, ToolbarButton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { adRoutingQuery, personLabel, RoutingSelect } from "@/components/admin/AdRouting";
import { createRoutingLead } from "@/lib/ad-routing.functions";
import { ManualRoutingLeads } from "@/components/admin/ManualRoutingLeads";

export const Route = createFileRoute("/_authenticated/admin/routing/")({
  head: () => ({ meta: [
    { title: "Ad Lead Routing — Routiva CRM" },
    { name: "description", content: "Configure per-ad lead distribution rules with exact quotas and overflow users." },
    { property: "og:title", content: "Ad Lead Routing — Routiva CRM" },
    { property: "og:description", content: "Configure per-ad lead distribution rules with exact quotas and overflow users." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(adRoutingQuery),
  component: RoutingOverview,
});

const columns = ["Company", "Facebook Page", "Campaign Name", "Ad Name", "Primary User", "Lead Quota", "Overflow User", "Assigned Count", "Status", "Actions"];

const blank = { customer_name: "", country_code: "+91", mobile: "", email: "", business_name: "", business_category: "",
   address: "", city: "", state: "", service: "Meta Ads", notes: "", source: "Manual", priority: "medium", company_id: "", assign_user: "", request_id: "" };

function RoutingOverview() {
  const { data } = useSuspenseQuery(adRoutingQuery);
  const create = useServerFn(createRoutingLead);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<typeof blank | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof blank, value: string) => setForm((prev) => prev ? { ...prev, [key]: value } : null);
  const companyUsers = form ? data.manualRecipients.filter((m) => m.company_id === (form.company_id || null)
    && personLabel(data, m.user_id).toLowerCase().includes(userSearch.toLowerCase())) : [];
  async function submit() {
    if (!form || busy) return;
    if (!form.customer_name.trim()) { toast.error("Client name is required"); return; }
    if (!/^\d{6,14}$/.test(form.mobile.trim())) { toast.error("Enter a valid mobile number"); return; }
    setBusy(true);
    try {
      const result = await create({ data: { ...form, company_id: form.company_id || null, email: form.email.trim(), assign_user: form.assign_user || null } });
      await qc.invalidateQueries({ queryKey: ["ad-routing"] });
      toast.success(result.assigned ? "Routing lead created and assigned" : "Routing lead created");
      setForm(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-5">
      <Breadcrumb label="Routing Overview" />
      <PageHeader title="Ad Lead Routing" subtitle="Send leads from each Meta ad to the right team members with exact quotas">
        <SearchInput placeholder="Search rules..." value={q} onChange={setQ} className="w-72" />
        <ToolbarButton primary onClick={() => { setForm({ ...blank, request_id: crypto.randomUUID() }); setUserSearch(""); }}><Plus className="size-4" />Create Routing Leads</ToolbarButton>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard tone="blue" icon={Inbox} label="Incoming Leads" value={0} note="All time" />
        <KpiCard tone="green" icon={CheckCircle2} label="Auto Assigned" value={0} note="Matched a rule" />
        <KpiCard tone="purple" icon={GitBranch} label="Active Rules" value={0} note="Currently routing" />
        <KpiCard tone="orange" icon={Zap} label="Unassigned" value={0} note="Waiting for review" />
        <KpiCard tone="red" icon={AlertTriangle} label="Failed Deliveries" value={0} note="Webhook errors" />
      </div>
      <Card className="p-5">
        <h3 className="mb-4 text-xl font-bold">Routing Rules</h3>
        <DataTable columns={columns} />
        <EmptyState title="No routing rules yet" hint="Create a rule for each ad — e.g. first 5 leads to one user, everything after to another." />
      </Card>
      <ManualRoutingLeads />
      <Dialog open={form !== null} onOpenChange={(v) => { if (!v && !busy) setForm(null); }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
          <DialogTitle>Create Routing Lead</DialogTitle>
          <DialogDescription>Save a manual lead into the shared leads database and optionally assign it to a user.</DialogDescription>
          {form && <><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">Client Name *<Input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} maxLength={200} /></label>
            <div className="grid gap-1.5 text-sm">Mobile Number *<div className="flex gap-2"><Input aria-label="Country code" className="w-24" value={form.country_code} onChange={(e) => update("country_code", e.target.value)} /><Input aria-label="Mobile number" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} /></div></div>
            <label className="grid gap-1.5 text-sm">Email<Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={255} /></label>
            <label className="grid gap-1.5 text-sm">Business Name<Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} maxLength={200} /></label>
            <label className="grid gap-1.5 text-sm">Business Category<Input value={form.business_category} onChange={(e) => update("business_category", e.target.value)} maxLength={120} /></label>
            <label className="grid gap-1.5 text-sm">Required Service<RoutingSelect label="Required Service" value={form.service} onChange={(v) => update("service", v)}>{["Meta Ads", "Google Ads", "Website", "SEO", "Social Media Marketing", "Other"].map((s) => <option key={s}>{s}</option>)}</RoutingSelect></label>
            <label className="grid gap-1.5 text-sm">City<Input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={120} /></label>
            <label className="grid gap-1.5 text-sm">State<Input value={form.state} onChange={(e) => update("state", e.target.value)} maxLength={120} /></label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">Full Address<Input value={form.address} onChange={(e) => update("address", e.target.value)} maxLength={2000} /></label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">Project Requirements / Notes<Input value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={2000} /></label>
            <label className="grid gap-1.5 text-sm">Lead Source<Input value={form.source} onChange={(e) => update("source", e.target.value)} maxLength={120} /></label>
            <label className="grid gap-1.5 text-sm">Priority<RoutingSelect label="Priority" value={form.priority} onChange={(v) => update("priority", v)}>{["low", "medium", "high"].map((p) => <option key={p}>{p}</option>)}</RoutingSelect></label>
            <label className="grid gap-1.5 text-sm">Company / Workspace<RoutingSelect label="Company / Workspace" value={form.company_id} onChange={(v) => { update("company_id", v); update("assign_user", ""); }}><option value="">Private user workspace</option>{data.companies.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</RoutingSelect></label>
            <div className="grid gap-1.5 text-sm">Assign To User
              <Input aria-label="Search users" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              <RoutingSelect label="Assign To User" value={form.assign_user} onChange={(v) => update("assign_user", v)}><option value="">Unassigned</option>{companyUsers.map((m) => <option key={m.user_id} value={m.user_id}>{personLabel(data, m.user_id)}</option>)}</RoutingSelect>
              {!data.manualRecipients.some((m) => m.company_id === (form.company_id || null)) && <p className="text-xs text-destructive">No active eligible users for this workspace.</p>}
            </div>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? "Saving..." : "Save Lead"}</Button></div></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
