import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb, Card, PageHeader, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminHead } from "@/lib/admin-head";
import { checkWhatsAppHealth, masterRevokeWhatsApp, masterWhatsAppConnections, type WaConnection } from "@/lib/org-whatsapp.functions";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/org-connections")({
  head: () => adminHead("WhatsApp Org Connections", "Monitor every organization's WhatsApp Business connection status."),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["master-wa"], queryFn: () => masterWhatsAppConnections(), staleTime: 15_000 });
  const [revoke, setRevoke] = useState<WaConnection | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await qc.invalidateQueries({ queryKey: ["master-wa"] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const rows = q.data?.connections ?? [];
  return (
    <div className="space-y-5">
      <Breadcrumb label="WhatsApp Org Connections" />
      <PageHeader title="WhatsApp Org Connections" subtitle="Status of each organization's own WhatsApp Business number. Access tokens are never shown." />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>{["Organization", "Number", "WABA ID", "Status", "Checks", "Last checked", "Error", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((c) => <tr key={c.id} className="border-t">
              <td className="px-4 py-3 font-medium">{c.company_name}</td>
              <td className="px-4 py-3">{c.display_phone_number ?? "—"}<div className="text-xs text-muted-foreground">{c.verified_name}</div></td>
              <td className="px-4 py-3 font-mono text-xs">{c.waba_id}</td>
              <td className="px-4 py-3 capitalize">{c.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 text-xs">{c.token_ok ? "Auth ✓" : "Auth ✗"} · {c.number_registered ? "Reg ✓" : "Reg ✗"} · {c.webhook_subscribed ? "Hook ✓" : "Hook ✗"}</td>
              <td className="px-4 py-3 text-xs">{c.last_health_at ? new Date(c.last_health_at).toLocaleString() : "—"}</td>
              <td className="max-w-56 truncate px-4 py-3 text-xs text-destructive" title={c.last_error ?? ""}>{c.last_error}</td>
              <td className="px-4 py-3">{!["disconnected", "revoked"].includes(c.status) && <div className="flex gap-2">
                <ToolbarButton disabled={busy} onClick={() => run(() => checkWhatsAppHealth({ data: { connection_id: c.id } }), "Health check complete")}><RefreshCw className="size-4" /></ToolbarButton>
                <ToolbarButton disabled={busy} onClick={() => { setReason(""); setRevoke(c); }}><ShieldOff className="size-4" />Revoke</ToolbarButton></div>}</td>
            </tr>)}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{q.isPending ? "Loading…" : "No organization has connected WhatsApp yet."}</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card className="p-6"><h3 className="mb-3 font-semibold">Recent connection activity</h3>
        <ul className="space-y-1.5 text-sm">{(q.data?.audit ?? []).map((a) => <li key={a.id} className="flex justify-between gap-4"><span><b>{a.company_name}</b> · {a.action.replace(/_/g, " ")}</span><span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></li>)}
          {(q.data?.audit.length ?? 0) === 0 && <li className="text-muted-foreground">No activity yet.</li>}</ul></Card>
      <Dialog open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Revoke {revoke?.company_name}'s WhatsApp access?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deletes the stored Meta authorization and unsubscribes webhooks. The customer can reconnect later. This is recorded in the audit log.</p>
          <label className="grid gap-1 text-sm font-medium">Reason<input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></label>
          <div className="flex justify-end gap-2"><ToolbarButton onClick={() => setRevoke(null)}>Cancel</ToolbarButton><ToolbarButton primary disabled={busy || reason.trim().length < 3} onClick={() => { const c = revoke; setRevoke(null); if (c) void run(() => masterRevokeWhatsApp({ data: { connection_id: c.id, reason } }), "Access revoked"); }}>Revoke</ToolbarButton></div>
        </DialogContent></Dialog>
    </div>
  );
}
