import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Inbox, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminHead } from "@/lib/admin-head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/message-log")({
  head: () => adminHead("WhatsApp Message Log", "View inbound and outbound WhatsApp messages from your connected business account."),
  component: MessageLog,
});

const db = supabase as unknown as { from: (t: string) => any };
type Row = { id: string; direction: string; body: string; status: string; wa_message_id: string | null; template_name: string | null; sent_at: string | null; delivered_at: string | null; read_at: string | null; failure_reason: string | null; created_at: string;
  whatsapp_conversations: { id: string; wa_phone: string; contact_name: string; lead_id: string | null } | null };

function MessageLog() {
  const msgs = useQuery({ queryKey: ["wa-log"], queryFn: async () => { const r = await db.from("whatsapp_messages").select("*, whatsapp_conversations(id,wa_phone,contact_name,lead_id)").order("created_at", { ascending: false }).limit(2000); if (r.error) throw r.error; return r.data as Row[]; } });
  const leads = useQuery({ queryKey: ["wa-log-leads"], queryFn: async () => { const r = await db.from("leads").select("id,customer_name,business_name").order("created_at", { ascending: false }).limit(5000); return (r.data ?? []) as { id: string; customer_name: string; business_name: string }[]; } }).data ?? [];
  const [leadId, setLeadId] = useState("");
  const [leadTitle, setLeadTitle] = useState("");
  const [dir, setDir] = useState("all");
  const [st, setSt] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [view, setView] = useState<Row | null>(null);
  const titleId = leads.find((l) => `${l.customer_name}${l.business_name ? ` — ${l.business_name}` : ""}` === leadTitle)?.id;
  const leadName = (id: string | null | undefined) => leads.find((l) => l.id === id)?.customer_name;
  const list = useMemo(() => (msgs.data ?? []).filter((m) => {
    const lid = m.whatsapp_conversations?.lead_id ?? "";
    if (leadId.trim() && lid !== leadId.trim()) return false;
    if (leadTitle && titleId && lid !== titleId) return false;
    if (dir !== "all" && m.direction !== dir) return false;
    if (st !== "all" && m.status !== st) return false;
    if (from && m.created_at < from) return false;
    if (to && m.created_at.slice(0, 10) > to) return false;
    return true;
  }), [msgs.data, leadId, leadTitle, titleId, dir, st, from, to]);
  const t = (v: string | null) => v ? new Date(v).toLocaleString() : "—";

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["WhatsApp"]} label="Message Log" />
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold">WhatsApp Message Log</h1><p className="text-muted-foreground">View inbound and outbound WhatsApp messages from your connected business account.</p></div>
        <ToolbarButton onClick={() => msgs.refetch()}><RefreshCw className={cn("size-4", msgs.isFetching && "animate-spin")} />Refresh</ToolbarButton>
      </div>
      <Card className="p-7">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 font-semibold">Filter by lead ID<input className="inp h-12 font-normal" placeholder="Paste lead ID (optional)" value={leadId} onChange={(e) => setLeadId(e.target.value)} /></label>
          <label className="grid gap-2 font-semibold">Filter by lead title<input list="lead-titles" className="inp h-12 font-normal" placeholder="Search and select lead title (optional)" value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} />
            <datalist id="lead-titles">{leads.map((l) => <option key={l.id} value={`${l.customer_name}${l.business_name ? ` — ${l.business_name}` : ""}`} />)}</datalist></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <select aria-label="Direction" className="inp w-40" value={dir} onChange={(e) => setDir(e.target.value)}><option value="all">All directions</option><option value="inbound">Incoming</option><option value="outbound">Outgoing</option></select>
          <select aria-label="Status" className="inp w-40" value={st} onChange={(e) => setSt(e.target.value)}><option value="all">All statuses</option>{["pending", "accepted", "sent", "delivered", "read", "failed", "received"].map((s) => <option key={s}>{s}</option>)}</select>
          <input aria-label="From date" type="date" className="inp w-44" value={from} onChange={(e) => setFrom(e.target.value)} /><input aria-label="To date" type="date" className="inp w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>
      <Card className="p-5">
        {list.length === 0 ? <div className="flex flex-col items-center gap-4 py-10 text-center"><Inbox className="size-28 text-border" strokeWidth={1} /><p className="text-lg text-muted-foreground">{msgs.data?.length ? "No messages match these filters." : "No messages yet. When customers message your WhatsApp number, they will appear here."}</p></div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-sm">
            <thead><tr className="bg-muted/60">{["Lead", "Phone", "Direction", "Message", "Template", "Sent", "Delivered", "Read", "Status", "Failure", "Message ID", ""].map((c) => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead>
            <tbody className="divide-y">{list.map((m) => <tr key={m.id} className="hover:bg-muted/40">
              <td className="px-3 py-3">{leadName(m.whatsapp_conversations?.lead_id) ?? m.whatsapp_conversations?.contact_name ?? "—"}</td>
              <td className="px-3 py-3">+{m.whatsapp_conversations?.wa_phone}</td>
              <td className="px-3 py-3"><StatusBadge tone={m.direction === "inbound" ? "purple" : "blue"}>{m.direction === "inbound" ? "IN" : "OUT"}</StatusBadge></td>
              <td className="max-w-xs truncate px-3 py-3">{m.body}</td><td className="px-3 py-3">{m.template_name ?? "—"}</td>
              <td className="px-3 py-3">{t(m.sent_at)}</td><td className="px-3 py-3">{t(m.delivered_at)}</td><td className="px-3 py-3">{t(m.read_at)}</td>
              <td className="px-3 py-3"><StatusBadge tone={m.status === "failed" ? "red" : m.status === "read" || m.status === "delivered" ? "green" : "gray"}>{m.status.toUpperCase()}</StatusBadge></td>
              <td className="px-3 py-3 text-admin-red">{m.failure_reason ?? ""}</td><td className="max-w-[140px] truncate px-3 py-3 font-mono text-xs">{m.wa_message_id ?? "—"}</td>
              <td className="px-3 py-3"><button aria-label="View details" onClick={() => setView(m)}><Eye className="size-4 text-admin-blue" /></button></td>
            </tr>)}</tbody></table></div>}
      </Card>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Message details</DialogTitle></DialogHeader>
          {view && <div className="space-y-3 text-sm"><p className="whitespace-pre-wrap rounded bg-muted p-3">{view.body}</p>
            <p>Status: <b>{view.status}</b> · Created {t(view.created_at)}</p>{view.failure_reason && <p className="text-admin-red">{view.failure_reason}</p>}
            <div className="flex gap-2">{view.whatsapp_conversations?.lead_id && <Link to="/admin/crm/leads" className="text-admin-blue underline">Open related lead</Link>}
              <Link to="/admin/whatsapp/whatsapp-chat" className="flex items-center gap-1 text-admin-blue underline"><MessageCircle className="size-4" />Open conversation</Link></div></div>}
        </DialogContent></Dialog>
    </div>
  );
}
