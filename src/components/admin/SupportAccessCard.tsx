import { useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, LifeBuoy, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, StatusBadge } from "./ui";
import { endSupportSession, listSupportSessions, startSupportSession, type SupportSessionRow } from "@/lib/support-access.functions";
import { sessionState } from "@/lib/support-access";

export const supportHistoryQuery = (companyId: string) => queryOptions({
  queryKey: ["support-sessions", companyId],
  queryFn: () => listSupportSessions({ data: { company_id: companyId } }),
  staleTime: 5_000,
});

const stateTone = { live: "green", expired: "gray", exited: "gray", revoked: "red" } as const;

export function SupportHistory({ companyId, canRevoke }: { companyId: string; canRevoke: boolean }) {
  const { data, isLoading } = useQuery(supportHistoryQuery(companyId));
  const qc = useQueryClient();
  const end = useServerFn(endSupportSession);
  const revoke = async (s: SupportSessionRow) => {
    try {
      await end({ data: { session_id: s.id, reason: "Revoked from customer page" } });
      toast.success("Support access revoked");
      await qc.invalidateQueries({ queryKey: ["support-sessions", companyId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not revoke access"); }
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading access history…</p>;
  const sessions = data?.sessions ?? [];
  return (
    <div className="grid gap-4">
      <ul className="divide-y rounded-lg border">
        {sessions.map((s) => {
          const st = sessionState(s);
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <div className="font-semibold">{s.mode === "support" ? "Full Support" : "View Only"} · {new Date(s.started_at).toLocaleString("en-IN")}</div>
                <div className="text-xs text-muted-foreground">{s.reason}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={stateTone[st]}>{st}</StatusBadge>
                {canRevoke && st === "live" && <Button size="sm" variant="outline" onClick={() => void revoke(s)}><ShieldOff /> Revoke</Button>}
              </div>
            </li>
          );
        })}
        {sessions.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No support access yet.</li>}
      </ul>
      <details className="rounded-lg border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Audit log ({data?.audit.length ?? 0})</summary>
        <ul className="mt-2 grid gap-1 font-mono text-xs">
          {(data?.audit ?? []).map((a) => (
            <li key={a.id}>{new Date(a.created_at).toLocaleString("en-IN")} · {a.action}{a.target ? ` · ${a.target}` : ""}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function SupportAccessCard({ companyId }: { companyId: string }) {
  const start = useServerFn(startSupportSession);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"view" | "support">("view");
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const { id } = await start({ data: { company_id: companyId, mode, reason, minutes } });
      void navigate({ to: "/admin/support-access/$sessionId", params: { sessionId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Access could not be started");
      setBusy(false);
    }
  };
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold">Workspace Access</h2>
      <p className="mt-1 text-sm text-muted-foreground">Open this customer's workspace for a limited time. Every action is recorded and the customer admin can revoke access.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr_auto_auto] md:items-end">
        <div className="flex gap-2">
          <Button type="button" variant={mode === "view" ? "default" : "outline"} onClick={() => setMode("view")}><Eye /> View Only</Button>
          <Button type="button" variant={mode === "support" ? "default" : "outline"} onClick={() => setMode("support")}><LifeBuoy /> Full Support</Button>
        </div>
        <div>
          <label htmlFor="support-reason" className="text-sm font-semibold">Reason</label>
          <Input id="support-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ticket #123 — lead status issue" className="mt-1.5 h-11" />
        </div>
        <div>
          <label htmlFor="support-minutes" className="text-sm font-semibold">Minutes</label>
          <select id="support-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-1.5 h-11 rounded-md border bg-card px-3 text-sm">
            {[5, 15, 30, 60].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <Button variant="hero" className="h-11" disabled={busy || reason.trim().length < 5} onClick={() => void go()}>Start access</Button>
      </div>
      <div className="mt-5"><SupportHistory companyId={companyId} canRevoke /></div>
    </Card>
  );
}
