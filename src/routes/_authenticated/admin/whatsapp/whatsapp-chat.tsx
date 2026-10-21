import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/admin/ui";
import { adminHead } from "@/lib/admin-head";
import { WhatsAppWebChat, type WaConversation, type WaChatMessage } from "@/components/messaging/WhatsAppWebChat";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/whatsapp-chat")({
  head: () => adminHead("WhatsApp Chat", "Send and receive WhatsApp messages with your leads and customers."),
  component: WaChat,
});

const db = supabase as unknown as { from: (t: string) => any };
type C = { id: string; wa_phone: string; contact_name: string; unread_count: number; last_message_at: string | null };
type Msg = { id: string; direction: string; body: string; status: string; created_at: string };

function WaChat() {
  const me = useQuery({ queryKey: ["me-profile"], queryFn: async () => { const id = (await supabase.auth.getUser()).data.user?.id; const r = await db.from("profiles").select("full_name,email").eq("id", id).maybeSingle(); return r.data as { full_name: string; email: string } | null; } });
  const convs = useQuery({ queryKey: ["wa-convs"], queryFn: async () => { const r = await db.from("whatsapp_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }); if (r.error) throw r.error; return r.data as C[]; } });
  const [sel, setSel] = useState("");
  const msgs = useQuery({ queryKey: ["wa-msgs", sel], enabled: !!sel, queryFn: async () => { const r = await db.from("whatsapp_messages").select("*").eq("conversation_id", sel).order("created_at"); if (r.error) throw r.error; return r.data as Msg[]; } });

  const conversations: WaConversation[] = (convs.data ?? []).map((c) => ({ id: c.id, name: c.contact_name || c.wa_phone, phone: c.wa_phone, at: c.last_message_at, unread: c.unread_count, kind: "contact" }));
  const messages: WaChatMessage[] = (msgs.data ?? []).map((m) => ({ id: m.id, direction: m.direction === "outbound" ? "outbound" : "inbound", body: m.body, at: m.created_at, status: m.status }));

  return (
    <Card className="overflow-hidden border-0 bg-transparent p-0 shadow-none">
      <WhatsAppWebChat
        me={{ name: me.data?.full_name || me.data?.email || "Admin", role: "Super Admin" }}
        conversations={conversations}
        connected={false}
        loading={convs.isPending}
        error={convs.error ? "Conversations could not be loaded" : null}
        selectedId={sel}
        onSelect={setSel}
        messages={messages}
        messagesLoading={msgs.isPending}
        messagesError={msgs.error ? "History could not be loaded" : null}
        className="h-[calc(100vh-170px)] min-h-[560px]"
      />
    </Card>
  );
}
