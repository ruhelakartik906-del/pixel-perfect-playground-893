import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, LifeBuoy, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "./ui";
import { endSupportSession, readSupportData, supportUpdateLead, type SupportResource } from "@/lib/support-access.functions";
import { remaining } from "@/lib/support-access";

type Overview = { company: { id: string; name: string; email: string; phone: string; contact_person: string }; session: { id: string; mode: "view" | "support"; expires_at: string; reason: string }; counts: { members: number; leads: number } };
type Lead = { id: string; customer_name: string; phone: string; email: string; status: string; requirements: string; assigned_to: string | null; created_at: string };
type Employee = { id: string; full_name: string; email: string; status: string; roles: string[] };

export function SupportWorkspace({ sessionId }: { sessionId: string }) {
  const read = useServerFn(readSupportData);
  const end = useServerFn(endSupportSession);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Exclude<SupportResource, "overview">>("leads");
  const [now, setNow] = useState(() => Date.now());
  const q = (resource: SupportResource) => ({ queryKey: ["support-ws", sessionId, resource], queryFn: () => read({ data: { session_id: sessionId, resource } }), retry: false, staleTime: 0 });
  const overview = useQuery({ ...q("overview") }) as unknown as { data?: Overview; error: Error | null; isLoading: boolean };
  const list = useQuery({ ...q(tab), enabled: Boolean(overview.data) }) as unknown as { data?: unknown[]; error: Error | null; isLoading: boolean };

  const exit = async (silent = false) => {
    try { await end({ data: { session_id: sessionId, reason: "Exited by Master Admin" } }); } catch { /* already ended */ }
    qc.removeQueries({ queryKey: ["support-ws", sessionId] });
    if (!silent) toast.success("Support access ended");
    void navigate({ to: "/admin/all-users", replace: true });
  };

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const expiresAt = overview.data?.session.expires_at;
  const left = expiresAt ? remaining(expiresAt, now) : null;
  useEffect(() => {
    if (left && left.ms === 0) {
      qc.removeQueries({ queryKey: ["support-ws", sessionId] });
      toast.info("Support access expired");
      void navigate({ to: "/admin/all-users", replace: true });
    }
  }, [left?.ms === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const error = overview.error ?? list.error;
  if (overview.isLoading) return <p className="p-6 text-muted-foreground">Opening customer workspace…</p>;
  if (!overview.data) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-bold">Support access unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error?.message ?? "This session has ended."}</p>
        <Button asChild className="mt-4"><Link to="/admin/all-users">Back to customers</Link></Button>
      </Card>
    );
  }
  const o = overview.data;
  const full = o.session.mode === "support";
  return (
    <div className="grid gap-5">
      <div role="status" aria-label="Support access banner" className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-warning bg-warning/15 px-5 py-3">
        <div className="flex items-center gap-3">
          {full ? <LifeBuoy className="size-5" /> : <Eye className="size-5" />}
          <div>
            <div className="font-bold">Support access: {o.company.name}</div>
            <div className="text-xs text-muted-foreground">{full ? "Full Support — changes are allowed and recorded" : "View Only — no changes allowed"} · {o.session.reason}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold" aria-label="Time remaining">{left?.label}</span>
          <Button variant="outline" onClick={() => void exit()}><LogOut /> Exit access</Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Contact</div><div className="font-semibold">{o.company.contact_person || o.company.email || "—"}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Members</div><div className="text-2xl font-bold">{o.counts.members}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Leads</div><div className="text-2xl font-bold">{o.counts.leads}</div></Card>
      </div>
      <div className="flex gap-2">
        <Button variant={tab === "leads" ? "default" : "outline"} onClick={() => setTab("leads")}>Leads</Button>
        <Button variant={tab === "employees" ? "default" : "outline"} onClick={() => setTab("employees")}>Employees</Button>
      </div>
      <Card className="p-0">
        {list.isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading…</p> : tab === "leads"
          ? <LeadsTable rows={(list.data ?? []) as Lead[]} full={full} sessionId={sessionId} />
          : <ul className="divide-y">{((list.data ?? []) as Employee[]).map((e) => <li key={e.id} className="flex justify-between px-5 py-3 text-sm"><span><b>{e.full_name || "—"}</b> · {e.email}</span><span className="text-muted-foreground">{e.roles.join(", ")} · {e.status}</span></li>)}</ul>}
      </Card>
    </div>
  );
}

function LeadsTable({ rows, full, sessionId }: { rows: Lead[]; full: boolean; sessionId: string }) {
  if (rows.length === 0) return <p className="p-5 text-sm text-muted-foreground">No leads in this organization.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Contact</th><th className="px-4 py-2">Assigned</th><th className="px-4 py-2">Status</th></tr></thead>
        <tbody className="divide-y">{rows.map((l) => <LeadRow key={l.id} lead={l} full={full} sessionId={sessionId} />)}</tbody>
      </table>
    </div>
  );
}

function LeadRow({ lead, full, sessionId }: { lead: Lead; full: boolean; sessionId: string }) {
  const update = useServerFn(supportUpdateLead);
  const qc = useQueryClient();
  const [status, setStatus] = useState(lead.status ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await update({ data: { session_id: sessionId, lead_id: lead.id, status } });
      toast.success("Lead updated");
      await qc.invalidateQueries({ queryKey: ["support-ws", sessionId, "leads"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); } finally { setBusy(false); }
  };
  return (
    <tr>
      <td className="px-4 py-2 font-semibold">{lead.customer_name || "—"}</td>
      <td className="px-4 py-2 text-muted-foreground">{lead.phone || lead.email || "—"}</td>
      <td className="px-4 py-2">{lead.assigned_to ?? "Unassigned"}</td>
      <td className="px-4 py-2">
        {full ? (
          <div className="flex gap-2"><Input aria-label={`Status for ${lead.customer_name}`} value={status} maxLength={60} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40" /><Button size="sm" disabled={busy || status === (lead.status ?? "")} onClick={() => void save()}><Save /> Save</Button></div>
        ) : (lead.status || "—")}
      </td>
    </tr>
  );
}
