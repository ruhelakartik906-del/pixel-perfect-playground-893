import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleMore, Search, Send, Star, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminHead, initials } from "@/lib/admin-head";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TeamChat } from "@/components/messaging/TeamChat";

export const Route = createFileRoute("/_authenticated/admin/communication/chat")({
  head: () => adminHead("Chat", "Message your team members, employees and clients."),
  component: ChatPage,
});

const db = supabase as unknown as { from: (t: string) => any };
type P = { id: string; full_name: string; email: string; avatar_url: string | null; account_status: string };
type M = { id: string; sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string };

function ChatPage() {
  const qc = useQueryClient();
  const [sharedView,setSharedView] = useState(false);
  const me = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "" }).data ?? "";
  const people = useQuery({ queryKey: ["chat-people"], queryFn: async () => { const r = await supabase.rpc("chat_people"); if (r.error) throw r.error; return (r.data ?? []).map(p => ({...p, account_status: "eligible"})) as P[]; } });
  const msgs = useQuery({ queryKey: ["chat-msgs"], queryFn: async () => { const r = await db.from("chat_messages").select("*").is("group_id", null).order("created_at").limit(5000); if (r.error) throw r.error; return r.data as M[]; } });
  const stars = useQuery({ queryKey: ["chat-stars"], queryFn: async () => { const r = await db.from("chat_stars").select("peer_id"); if (r.error) throw r.error; return new Set((r.data as any[]).map((x) => x.peer_id as string)); } });
  const [tab, setTab] = useState<"all" | "online" | "starred">("all");
  const [q, setQ] = useState("");
  const [peer, setPeer] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [picker, setPicker] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) return () => {};
    const ch = supabase.channel("chat-live", { config: { presence: { key: me } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => qc.invalidateQueries({ queryKey: ["chat-msgs"] }))
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe((s) => { if (s === "SUBSCRIBED") ch.track({ at: Date.now() }); });
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  const self = people.data?.find((p) => p.id === me);
  const others = (people.data ?? []).filter((p) => p.id !== me && p.account_status !== "blocked");
  const lastWith = (id: string) => [...(msgs.data ?? [])].reverse().find((m) => (m.sender_id === id && m.recipient_id === me) || (m.recipient_id === id && m.sender_id === me));
  const unread = (id: string) => (msgs.data ?? []).filter((m) => m.sender_id === id && m.recipient_id === me && !m.read_at).length;
  const contacts = useMemo(() => others
    .filter((p) => tab === "all" || (tab === "online" ? online.has(p.id) : stars.data?.has(p.id)))
    .filter((p) => !q || `${p.full_name} ${p.id}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (lastWith(b.id)?.created_at ?? "").localeCompare(lastWith(a.id)?.created_at ?? "")), [others, tab, q, online, stars.data, msgs.data]);
  const thread = (msgs.data ?? []).filter((m) => peer && ((m.sender_id === peer && m.recipient_id === me) || (m.recipient_id === peer && m.sender_id === me)));
  const peerP = others.find((p) => p.id === peer);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [thread.length, peer]);
  useEffect(() => {
    if (!peer || !me || !unread(peer)) return;
    db.from("chat_messages").update({ read_at: new Date().toISOString() }).eq("sender_id", peer).eq("recipient_id", me).is("read_at", null).then(() => qc.invalidateQueries({ queryKey: ["chat-msgs"] }));
  }, [peer, msgs.data]);

  const send = async () => {
    const body = text.trim();
    if (!peer || !body) return;
    if (body.length > 4000) { toast.error("Message is too long"); return; }
    const { error } = await db.from("chat_messages").insert({ recipient_id: peer, body });
    if (error) { toast.error(error.message.includes("row-level") ? "You are not allowed to message this user" : error.message); return; }
    setText(""); qc.invalidateQueries({ queryKey: ["chat-msgs"] });
  };
  const toggleStar = async (id: string) => {
    const has = stars.data?.has(id);
    const { error } = has ? await db.from("chat_stars").delete().eq("peer_id", id) : await db.from("chat_stars").insert({ peer_id: id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["chat-stars"] });
  };
  const Av = ({ p, size = "size-14" }: { p: P; size?: string }) => p.avatar_url ? <img src={p.avatar_url} alt="" className={cn(size, "rounded-lg object-cover")} />
    : <span className={cn(size, "grid shrink-0 place-items-center rounded-lg bg-admin-blue text-xl font-bold text-primary-foreground")}>{initials(p.full_name || p.email)}</span>;

  if(sharedView)return <><Button variant="outline" className="mb-4" onClick={()=>setSharedView(false)}>Back to existing chat</Button><TeamChat admin/></>;
  return (
    <><Button variant="outline" className="mb-4" onClick={()=>setSharedView(true)}><Users/>Groups & Files</Button><Card className="flex h-[calc(100vh-170px)] min-h-[560px] overflow-hidden">
      <aside className="flex w-[420px] shrink-0 flex-col border-r">
        <div className="space-y-4 border-b p-6">
          <div className="flex items-center gap-4 rounded-xl bg-muted/60 p-4">
            {self && <Av p={self} size="size-12" />}
            <div className="flex-1"><p className="font-bold">{self?.full_name || "Me"}</p><p className="text-sm text-success">Online</p></div>
            <span className="rounded bg-admin-blue px-2 py-0.5 text-xs font-bold text-primary-foreground">ME</span>
          </div>
          <label className="flex h-12 items-center gap-3 rounded-full bg-muted/60 px-4">
            <Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations..." className="w-full bg-transparent outline-none" />
            <button aria-label="Start new chat" onClick={() => setPicker(true)}><UserPlus className="size-4 text-admin-blue" /></button>
          </label>
        </div>
        <div className="flex gap-8 border-b px-10">
          {(["all", "online", "starred"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 py-4 capitalize", tab === t ? "border-admin-blue font-semibold text-admin-blue" : "border-transparent text-muted-foreground")}>{t}</button>)}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-6">
          {contacts.length === 0 && <p className="py-10 text-center text-muted-foreground">No conversations</p>}
          {contacts.map((p) => { const l = lastWith(p.id); const u = unread(p.id);
            return <button key={p.id} onClick={() => setPeer(p.id)} className={cn("flex w-full items-center gap-4 rounded-xl border p-5 text-left transition-colors", peer === p.id ? "border-admin-blue bg-admin-blue/5" : "hover:bg-muted/50")}>
              <span className="relative"><Av p={p} />{online.has(p.id) && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-admin-green" />}</span>
              <span className="min-w-0 flex-1"><span className="font-semibold">{p.full_name || p.email}</span>
                <span className="block truncate text-muted-foreground">{l ? l.body : "Click to start chat"}</span></span>
              {u > 0 && <span className="rounded-full bg-admin-blue px-2 text-xs font-bold text-primary-foreground">{u}</span>}
            </button>; })}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {!peerP ? (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <span className="grid size-20 place-items-center rounded-2xl bg-admin-blue/10"><MessageCircleMore className="size-9 text-admin-blue" /></span>
            <h2 className="mt-8 text-3xl font-bold">Welcome to Messages</h2>
            <p className="mt-3 max-w-md text-lg text-muted-foreground">Connect with your team members, employees, and clients. Select a conversation from the left to start messaging.</p>
            <div className="mt-8 flex gap-4"><span className="flex items-center gap-2 rounded-lg bg-muted/60 px-5 py-3"><Users className="size-4 text-admin-blue" />{others.length} Contacts</span>
              <span className="flex items-center gap-2 rounded-lg bg-muted/60 px-5 py-3"><span className="size-2 rounded-full bg-admin-green" />{online.size > 1 ? `${online.size - 1} Online` : "Online"}</span></div>
            <p className="mt-auto pt-10 text-sm text-muted-foreground">Messages are private to the two participants</p>
          </div>
        ) : (<>
          <div className="flex items-center gap-3 border-b p-4"><Av p={peerP} size="size-10" /><div className="flex-1"><p className="font-semibold">{peerP.full_name || peerP.email}</p><p className="text-xs text-muted-foreground">{online.has(peerP.id) ? "Online" : "Offline"}</p></div>
            <button aria-label="Star conversation" onClick={() => toggleStar(peerP.id)}><Star className={cn("size-5", stars.data?.has(peerP.id) ? "fill-admin-orange text-admin-orange" : "text-muted-foreground")} /></button></div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-6">
            {thread.length === 0 && <p className="py-10 text-center text-muted-foreground">Say hello 👋</p>}
            {thread.map((m) => <div key={m.id} className={cn("flex", m.sender_id === me ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[70%] rounded-2xl px-4 py-2", m.sender_id === me ? "bg-admin-blue text-primary-foreground" : "bg-card shadow-card")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p><p className="mt-1 text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{m.sender_id === me && m.read_at ? " · Read" : ""}</p></div></div>)}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t p-4">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Type a message..." className="inp h-12" />
            <button type="submit" aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-md bg-admin-blue text-primary-foreground"><Send className="size-5" /></button>
          </form>
        </>)}
      </main>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent><DialogHeader><DialogTitle>Start new chat</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-1 overflow-y-auto">{others.map((p) => <button key={p.id} onClick={() => { setPeer(p.id); setPicker(false); setTab("all"); }} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"><Av p={p} size="size-9" /><span><b>{p.full_name || p.email}</b><span className="block text-xs text-muted-foreground">@{p.id}</span></span></button>)}
            {others.length === 0 && <p className="text-sm text-muted-foreground">No other active users yet.</p>}</div>
        </DialogContent>
      </Dialog>
    </Card></>
  );
}
