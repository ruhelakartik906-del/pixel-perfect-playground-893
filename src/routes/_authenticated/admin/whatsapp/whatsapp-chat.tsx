import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Inbox, MessageCircleMore, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/admin/ui";
import { adminHead, initials } from "@/lib/admin-head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/whatsapp-chat")({
  head: () => adminHead("WhatsApp Chat", "Send and receive WhatsApp messages with your leads and customers."),
  component: WaChat,
});

const db = supabase as unknown as { from: (t: string) => any };
type C = { id: string; wa_phone: string; contact_name: string; unread_count: number; last_message_at: string | null; last_inbound_at: string | null };
type Msg = { id: string; direction: string; body: string; status: string; created_at: string };

function WaChat() {
  const me = useQuery({ queryKey: ["me-profile"], queryFn: async () => { const id = (await supabase.auth.getUser()).data.user?.id; const r = await db.from("profiles").select("full_name,email,avatar_url").eq("id", id).maybeSingle(); return r.data as { full_name: string; email: string; avatar_url: string | null } | null; } });
  const convs = useQuery({ queryKey: ["wa-convs"], queryFn: async () => { const r = await db.from("whatsapp_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }); if (r.error) throw r.error; return r.data as C[]; } });
  const [f, setF] = useState<"all" | "unread" | "open">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<C | null>(null);
  const msgs = useQuery({ queryKey: ["wa-msgs", sel?.id], enabled: !!sel, queryFn: async () => { const r = await db.from("whatsapp_messages").select("*").eq("conversation_id", sel!.id).order("created_at"); if (r.error) throw r.error; return r.data as Msg[]; } });
  const day = 24 * 3600 * 1000;
  const list = useMemo(() => (convs.data ?? []).filter((c) => f === "all" || (f === "unread" ? c.unread_count > 0 : c.last_inbound_at && Date.now() - new Date(c.last_inbound_at).getTime() < day))
    .filter((c) => !q || `${c.contact_name} ${c.wa_phone}`.toLowerCase().includes(q.toLowerCase())), [convs.data, f, q]);

  return (
    <Card className="flex h-[calc(100vh-170px)] min-h-[560px] overflow-hidden">
      <aside className="flex w-[400px] shrink-0 flex-col border-r">
        <div className="space-y-4 border-b p-6">
          <div className="flex items-center gap-4 rounded-xl bg-muted/60 p-4">
            <span className="relative grid size-12 place-items-center rounded-full bg-admin-blue font-bold text-primary-foreground">{initials(me.data?.full_name || me.data?.email || "")}<span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-admin-green" /></span>
            <div className="flex-1"><p className="font-bold">{me.data?.full_name || "Me"}</p><p className="text-sm text-muted-foreground">Administrator</p></div>
            <span className="rounded bg-admin-blue px-2 py-0.5 text-xs font-bold text-primary-foreground">ME</span>
          </div>
          <label className="flex h-12 items-center gap-3 rounded-full bg-muted/60 px-4">
            <Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or start new chat" className="w-full bg-transparent outline-none" />
            <button aria-label="New WhatsApp chat" onClick={() => toast.info("Connect WhatsApp Business to start new chats. The integration is not active yet.")}><Plus className="size-5 text-admin-blue" /></button>
          </label>
          <div className="flex gap-2">{([["all", "All"], ["unread", "Unread"], ["open", "24h Open"]] as const).map(([k, l]) =>
            <button key={k} onClick={() => setF(k)} className={cn("rounded-full px-4 py-1.5 text-sm", f === k ? "bg-admin-green/15 font-semibold text-success" : "bg-muted text-muted-foreground")}>{l}</button>)}</div>
        </div>
        <div className="flex-1 overflow-y-auto bg-muted/30">
          {list.length === 0 ? <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><Inbox className="size-20 text-border" strokeWidth={1} /><p>No chats found</p></div>
            : list.map((c) => <button key={c.id} onClick={() => setSel(c)} className={cn("flex w-full items-center gap-3 border-b px-5 py-4 text-left", sel?.id === c.id ? "bg-admin-blue/5" : "hover:bg-muted")}>
              <span className="grid size-11 place-items-center rounded-full bg-admin-green/20 font-bold text-success">{initials(c.contact_name || c.wa_phone)}</span>
              <span className="flex-1"><b>{c.contact_name || c.wa_phone}</b><span className="block text-xs text-muted-foreground">{c.wa_phone}</span></span>
              {c.unread_count > 0 && <span className="rounded-full bg-admin-green px-2 text-xs font-bold text-primary-foreground">{c.unread_count}</span>}</button>)}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {!sel ? (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <MessageCircleMore className="size-28 text-admin-blue" strokeWidth={1.4} />
            <h2 className="mt-6 text-4xl font-bold">Routiva WhatsApp Chat</h2>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">Send and receive WhatsApp messages directly from CRM.<br />Use Routiva WhatsApp Chat to stay connected with your leads and customers.</p>
            <p className="mt-10 flex items-center gap-1 text-sm text-muted-foreground"><Check className="size-4" />End-to-end encrypted</p>
          </div>
        ) : (<>
          <div className="border-b p-4"><p className="font-semibold">{sel.contact_name || sel.wa_phone}</p><p className="text-xs text-muted-foreground">{sel.wa_phone}</p></div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-6">
            {(msgs.data ?? []).map((m) => <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}><div className={cn("max-w-[70%] rounded-xl px-4 py-2", m.direction === "outbound" ? "bg-admin-green/20" : "bg-card shadow-card")}><p className="whitespace-pre-wrap">{m.body}</p><p className="text-right text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()} · {m.status}</p></div></div>)}
          </div>
          <p className="border-t p-4 text-center text-sm text-muted-foreground">Replying requires the WhatsApp Business connection, which is not active yet.</p>
        </>)}
      </main>
    </Card>
  );
}
