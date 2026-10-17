import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Clock, FileText, Inbox, Mail, PenSquare, RotateCcw, Send, Settings, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, SearchInput, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminHead } from "@/lib/admin-head";
import { disconnectMailbox, saveMailbox } from "@/lib/admin-users.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/communication/mail")({
  head: () => adminHead("Mail", "Connect your mailbox to compose, reply and track emails from the CRM."),
  component: MailPage,
});

const db = supabase as unknown as { from: (t: string) => any };
type Folder = "inbox" | "starred" | "important" | "draft" | "sent" | "scheduled" | "trash" | "settings";
type Msg = { id: string; folder: string; previous_folder: string | null; from_email: string; to_emails: string; cc: string; subject: string; body: string; starred: boolean; important: boolean; scheduled_at: string | null; delivery_status: string; updated_at: string };
type Box = { from_name: string; from_email: string; smtp_host: string; smtp_port: number; smtp_secure: boolean; imap_host: string; imap_port: number; username: string; has_password: boolean };

const nav: { id: Folder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox }, { id: "starred", label: "Starred", icon: Star }, { id: "important", label: "Important", icon: Bookmark },
  { id: "draft", label: "Drafts", icon: FileText }, { id: "sent", label: "Sent", icon: Send }, { id: "scheduled", label: "Scheduled", icon: Clock }, { id: "trash", label: "Trash", icon: Trash2 },
];
const blankBox: Box & { password: string } = { from_name: "", from_email: "", smtp_host: "", smtp_port: 587, smtp_secure: true, imap_host: "", imap_port: 993, username: "", has_password: false, password: "" };

function MailPage() {
  const qc = useQueryClient();
  const save = useServerFn(saveMailbox);
  const disconnect = useServerFn(disconnectMailbox);
  const box = useQuery({ queryKey: ["mailbox"], queryFn: async () => { const r = await db.from("mailbox_settings").select("*").maybeSingle(); if (r.error) throw r.error; return r.data as Box | null; } });
  const msgs = useQuery({ queryKey: ["mail"], queryFn: async () => { const r = await db.from("mail_messages").select("*").order("updated_at", { ascending: false }).limit(1000); if (r.error) throw r.error; return r.data as Msg[]; } });
  const [folder, setFolder] = useState<Folder>("inbox");
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState<{ id?: string; to_emails: string; cc: string; subject: string; body: string; scheduled_at: string } | null>(null);
  const [open, setOpen] = useState<Msg | null>(null);
  const [cfg, setCfg] = useState<typeof blankBox | null>(null);
  const connected = !!box.data?.has_password;
  const refresh = () => qc.invalidateQueries({ queryKey: ["mail"] });

  const list = useMemo(() => (msgs.data ?? []).filter((m) =>
    (folder === "starred" ? m.starred && m.folder !== "trash" : folder === "important" ? m.important && m.folder !== "trash" : m.folder === folder)
    && (!q || [m.subject, m.to_emails, m.from_email, m.body].some((v) => v.toLowerCase().includes(q.toLowerCase())))), [msgs.data, folder, q]);

  const openSettings = () => { setFolder("settings"); setCfg({ ...blankBox, ...(box.data ?? {}), password: "" }); };

  const saveCfg = async () => {
    if (!cfg) return;
    try {
      await save({ data: { from_name: cfg.from_name, from_email: cfg.from_email, smtp_host: cfg.smtp_host, smtp_port: Number(cfg.smtp_port), smtp_secure: cfg.smtp_secure, imap_host: cfg.imap_host, imap_port: Number(cfg.imap_port), username: cfg.username, ...(cfg.password ? { password: cfg.password } : {}) } });
      toast.success("Mailbox settings saved"); setCfg({ ...cfg, password: "", has_password: true }); qc.invalidateQueries({ queryKey: ["mailbox"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const saveMsg = async (mode: "draft" | "scheduled") => {
    if (!compose) return;
    const emails = compose.to_emails.split(",").map((s) => s.trim()).filter(Boolean);
    if (mode === "scheduled") {
      if (!connected) { toast.error("Connect a mailbox before scheduling emails"); return; }
      if (!emails.length || emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) { toast.error("Enter valid recipient emails"); return; }
      if (!compose.scheduled_at || new Date(compose.scheduled_at) <= new Date()) { toast.error("Pick a future send time"); return; }
    }
    const payload = { folder: mode, to_emails: compose.to_emails.trim(), cc: compose.cc.trim(), subject: compose.subject.trim().slice(0, 300), body: compose.body.slice(0, 50000),
      from_email: box.data?.from_email ?? "", scheduled_at: mode === "scheduled" ? new Date(compose.scheduled_at).toISOString() : null, delivery_status: mode === "scheduled" ? "awaiting_delivery_integration" : "not_sent" };
    const { error } = compose.id ? await db.from("mail_messages").update(payload).eq("id", compose.id) : await db.from("mail_messages").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(mode === "draft" ? "Draft saved" : "Scheduled — will be delivered once mail sending is activated");
    setCompose(null); setFolder(mode); refresh();
  };

  const patch = async (m: Msg, p: Partial<Msg>, msg: string) => {
    const { error } = await db.from("mail_messages").update(p).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg); setOpen(null); refresh();
  };
  const purge = async (m: Msg) => { const { error } = await db.from("mail_messages").delete().eq("id", m.id); if (error) { toast.error(error.message); return; } toast.success("Deleted forever"); setOpen(null); refresh(); };

  return (
    <Card className="flex min-h-[calc(100vh-180px)] overflow-hidden">
      <aside className="w-72 shrink-0 border-r p-7">
        <button onClick={() => setCompose({ to_emails: "", cc: "", subject: "", body: "", scheduled_at: "" })} className="flex h-16 w-full items-center justify-center gap-2 rounded-lg bg-admin-blue text-xl font-semibold text-primary-foreground shadow-cta"><PenSquare className="size-5" />Compose</button>
        <nav className="mt-10 space-y-1">
          {nav.map((n) => { const c = (msgs.data ?? []).filter((m) => n.id === "starred" ? m.starred && m.folder !== "trash" : n.id === "important" ? m.important && m.folder !== "trash" : m.folder === n.id).length;
            return <button key={n.id} onClick={() => setFolder(n.id)} className={cn("flex w-full items-center gap-5 rounded-lg px-5 py-4 text-[17px]", folder === n.id ? "bg-admin-blue/10 font-semibold text-admin-blue" : "hover:bg-muted")}>
              <n.icon className="size-4" /><span className="flex-1 text-left">{n.label}</span>{c > 0 && <span className="text-xs text-muted-foreground">{c}</span>}</button>; })}
          <div className="my-2 border-t" />
          <button onClick={openSettings} className={cn("flex w-full items-center gap-5 rounded-lg px-5 py-4 text-[17px]", folder === "settings" ? "bg-admin-blue/10 font-semibold text-admin-blue" : "hover:bg-muted")}><Settings className="size-4" />Email Settings</button>
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {folder === "settings" && cfg ? (
          <div className="max-w-2xl space-y-4 p-8">
            <h1 className="text-2xl font-bold">Email Settings</h1>
            <p className="text-sm text-muted-foreground">Status: {connected ? <span className="font-semibold text-success">Credentials saved</span> : "Not connected"}. Your password is stored on the server and never shown again.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["From name", "from_name"], ["From email", "from_email"], ["SMTP host", "smtp_host"], ["SMTP port", "smtp_port"], ["IMAP host", "imap_host"], ["IMAP port", "imap_port"], ["Username", "username"]] as const).map(([l, k]) =>
                <label key={k} className="grid gap-1 text-sm font-medium">{l}<input className="inp" value={String(cfg[k])} onChange={(e) => setCfg({ ...cfg, [k]: k.endsWith("port") ? e.target.value.replace(/\D/g, "") : e.target.value })} /></label>)}
              <label className="grid gap-1 text-sm font-medium">Password / app password<input className="inp" type="password" autoComplete="new-password" placeholder={cfg.has_password ? "•••••••• (leave blank to keep)" : ""} value={cfg.password} onChange={(e) => setCfg({ ...cfg, password: e.target.value })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-admin-blue" checked={cfg.smtp_secure} onChange={(e) => setCfg({ ...cfg, smtp_secure: e.target.checked })} />Use TLS/SSL</label>
            </div>
            <div className="flex gap-2"><ToolbarButton primary onClick={saveCfg}>Save settings</ToolbarButton>
              {connected && <ToolbarButton onClick={async () => { await disconnect(); toast.success("Mailbox disconnected"); qc.invalidateQueries({ queryKey: ["mailbox"] }); setCfg({ ...blankBox }); }}>Disconnect</ToolbarButton>}</div>
            <p className="rounded-md bg-admin-orange/10 p-3 text-sm text-warning">Live sending and inbox syncing are not active yet. Saved drafts and scheduled emails wait here until mail delivery is switched on — nothing is sent in the meantime.</p>
          </div>
        ) : !connected && (folder === "inbox" || list.length === 0) ? (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <span className="grid size-24 place-items-center rounded-full shadow-card"><Mail className="size-10 text-admin-blue" /></span>
            <h2 className="mt-8 text-3xl font-bold">Connect Your Mailbox</h2>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">Configure SMTP and IMAP connections for Gmail, Outlook, Yahoo, or your custom mail servers to compose, reply, and track emails.</p>
            <ToolbarButton primary onClick={openSettings} className="mt-8 h-14 px-10 text-lg">Configure Mailbox Now</ToolbarButton>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b p-4"><h1 className="flex-1 text-xl font-bold capitalize">{nav.find((n) => n.id === folder)?.label}</h1><SearchInput placeholder="Search mail..." value={q} onChange={setQ} className="w-72" /></div>
            {list.length === 0 ? <p className="py-24 text-center text-muted-foreground">{folder === "inbox" ? "Your inbox will fill in once mail syncing is activated." : "Nothing here yet."}</p>
              : <ul className="divide-y">{list.map((m) => (
                <li key={m.id} className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-muted/50" onClick={() => m.folder === "draft" ? setCompose({ id: m.id, to_emails: m.to_emails, cc: m.cc, subject: m.subject, body: m.body, scheduled_at: "" }) : setOpen(m)}>
                  <button aria-label="Star" onClick={(e) => { e.stopPropagation(); patch(m, { starred: !m.starred }, m.starred ? "Unstarred" : "Starred"); }}><Star className={cn("size-4", m.starred ? "fill-admin-orange text-admin-orange" : "text-muted-foreground")} /></button>
                  <span className="w-56 truncate font-medium">{m.folder === "inbox" ? m.from_email : m.to_emails || "(no recipient)"}</span>
                  <span className="min-w-0 flex-1 truncate"><b>{m.subject || "(no subject)"}</b> <span className="text-muted-foreground">— {m.body.slice(0, 120)}</span></span>
                  <span className="text-xs text-muted-foreground">{m.scheduled_at ? `Scheduled ${new Date(m.scheduled_at).toLocaleString()}` : new Date(m.updated_at).toLocaleDateString()}</span>
                </li>))}</ul>}
          </>
        )}
      </main>

      <Dialog open={!!compose} onOpenChange={(o) => !o && setCompose(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{compose?.id ? "Edit draft" : "New message"}</DialogTitle></DialogHeader>
          {compose && <div className="grid gap-3">
            <input className="inp" placeholder="To (comma separated)" value={compose.to_emails} onChange={(e) => setCompose({ ...compose, to_emails: e.target.value })} />
            <input className="inp" placeholder="Cc" value={compose.cc} onChange={(e) => setCompose({ ...compose, cc: e.target.value })} />
            <input className="inp" placeholder="Subject" value={compose.subject} maxLength={300} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
            <textarea className="inp h-48 py-2" placeholder="Message" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
            <label className="grid gap-1 text-sm">Schedule send (optional)<input className="inp" type="datetime-local" value={compose.scheduled_at} onChange={(e) => setCompose({ ...compose, scheduled_at: e.target.value })} /></label>
            {!connected && <p className="text-xs text-muted-foreground">No mailbox connected — you can save drafts now; sending needs a connected mailbox.</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {compose.id && <ToolbarButton onClick={async () => { await db.from("mail_messages").update({ folder: "trash", previous_folder: "draft" }).eq("id", compose.id); setCompose(null); refresh(); toast.success("Draft moved to trash"); }}><Trash2 className="size-4" />Discard</ToolbarButton>}
              <ToolbarButton onClick={() => saveMsg("draft")}>Save draft</ToolbarButton>
              <ToolbarButton primary onClick={() => saveMsg("scheduled")}><Clock className="size-4" />Schedule</ToolbarButton>
              <span title="Live sending is not active yet"><ToolbarButton className="cursor-not-allowed opacity-50"><Send className="size-4" />Send now</ToolbarButton></span>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.subject || "(no subject)"}</DialogTitle></DialogHeader>
          {open && <div className="space-y-3">
            <p className="text-sm text-muted-foreground">To: {open.to_emails || "—"} {open.cc && `· Cc: ${open.cc}`}</p>
            {open.delivery_status === "awaiting_delivery_integration" && <p className="rounded bg-admin-orange/10 p-2 text-xs text-warning">Not sent — waiting for mail delivery to be activated.</p>}
            <p className="whitespace-pre-wrap">{open.body}</p>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <ToolbarButton onClick={() => patch(open, { important: !open.important }, "Updated")}><Bookmark className="size-4" />{open.important ? "Not important" : "Mark important"}</ToolbarButton>
              {open.folder === "scheduled" && <ToolbarButton onClick={() => patch(open, { folder: "draft", scheduled_at: null, delivery_status: "not_sent" }, "Moved to drafts")}>Cancel schedule</ToolbarButton>}
              {open.folder !== "trash" ? <ToolbarButton onClick={() => patch(open, { folder: "trash", previous_folder: open.folder }, "Moved to trash")}><Trash2 className="size-4" />Trash</ToolbarButton>
                : <><ToolbarButton onClick={() => patch(open, { folder: open.previous_folder ?? "draft" }, "Restored")}><RotateCcw className="size-4" />Restore</ToolbarButton>
                  <ToolbarButton onClick={() => purge(open)} className="text-admin-red">Delete forever</ToolbarButton></>}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
