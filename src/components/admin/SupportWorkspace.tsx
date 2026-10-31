import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, LifeBuoy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "./ui";
import { endSupportSession, readSupportData, loadSupportWorkspace } from "@/lib/support-access.functions";
import { UserDashboard } from "@/components/workspace/UserDashboard";
import { AllAssigned } from "@/components/workspace/AllAssigned";
import { SupportContext } from "@/components/workspace/SupportContext";
import { remaining } from "@/lib/support-access";

type Overview = { company: { id: string; name: string; email: string; phone: string; contact_person: string }; session: { id: string; mode: "view" | "support"; expires_at: string; started_at: string; reason: string }; counts: { members: number; leads: number } };

export function SupportWorkspace({ sessionId }: { sessionId: string }) {
  const read = useServerFn(readSupportData);
  const load = useServerFn(loadSupportWorkspace);
  const [page, setPage] = useState<"dashboard" | "all-assigned">("dashboard");
  const workspace = useQuery({ queryKey: ["support-ws", sessionId, "context"], queryFn: () => load({ data: { session_id: sessionId } }), retry: false, staleTime: 0, refetchInterval: 10_000 });
  const end = useServerFn(endSupportSession);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const q = (resource: "overview") => ({ queryKey: ["support-ws", sessionId, resource], queryFn: () => read({ data: { session_id: sessionId, resource } }), retry: false, staleTime: 0 });
  const overview = useQuery({ ...q("overview") }) as unknown as { data?: Overview; error: Error | null; isLoading: boolean };

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

  useEffect(() => { if (!workspace.error) return; qc.removeQueries({ queryKey: ["support-ws", sessionId, "crm"] }); }, [workspace.error, qc, sessionId]);
  const error = workspace.error ?? overview.error;
  if (overview.isLoading) return <p className="p-6 text-muted-foreground">Opening customer workspace…</p>;
  if (!overview.data || workspace.error) {
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
            <div className="font-bold">Master Admin — {full ? "Full Support Access" : "View Only Access"}</div><div className="text-sm font-semibold">{o.company.name}</div>
            <div className="text-xs text-muted-foreground">{full ? "Full Support — changes are allowed and recorded" : "View Only — no changes allowed"} · {o.session.reason}<span className="block">Started {new Date(o.session.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Expires {new Date(o.session.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold" aria-label="Time remaining">{left?.label}</span>
          <Button variant="outline" onClick={() => void exit()}><LogOut /> Exit access</Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {workspace.data && <SupportContext value={{ sessionId, mode: full ? "support" : "view", page, onNavigate: setPage, features: workspace.data.features, companyName: workspace.data.companyName }}>
        {page === "dashboard" ? <UserDashboard /> : <AllAssigned />}
      </SupportContext>}
    </div>
  );
}
