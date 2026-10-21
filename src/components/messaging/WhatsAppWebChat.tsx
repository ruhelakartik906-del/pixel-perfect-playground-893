import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Ban, Camera, Check, CheckCheck, FileText, IdCard, Image as ImageIcon,
  MessageCirclePlus, Mic, MoreVertical, Paperclip, Phone, Plus, Search, Send, ShieldAlert, Smile, UserPlus, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type WaConversation = {
  id: string;
  name: string;
  phone: string;
  preview?: string | undefined;
  at?: string | null | undefined;
  unread?: number | undefined;
  kind?: 'business' | 'contact' | 'group' | undefined;
  favorite?: boolean | undefined;
  leadTo?: string | undefined;
  leadLabel?: string | undefined;
};

export type WaChatMessage = {
  id: string;
  direction: 'inbound' | 'outbound' | 'system';
  body: string;
  at: string;
  status?: string;
};

type Props = {
  me: { name: string; role: string };
  conversations: WaConversation[];
  connected: boolean;
  loading?: boolean;
  error?: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
  messages: WaChatMessage[];
  messagesLoading?: boolean;
  messagesError?: string | null;
  emptyNote?: string;
  className?: string;
};

const AVATAR_COLORS = ['bg-admin-blue', 'bg-admin-green', 'bg-admin-purple', 'bg-admin-orange', 'bg-admin-pink'] as const;
const avatarColor = (seed: string) => AVATAR_COLORS[Math.abs([...seed].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

const fmtDay = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (yesterday) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '👍', '👎', '🙏', '👏', '💪', '🎉', '🔥', '❤️', '💯', '✅', '⭐', '📅', '📞', '📎', '💼'];

const now = () => new Date().toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const DEMO_CONVERSATIONS: WaConversation[] = [
  { id: 'demo-wa-business', name: 'WhatsApp Business', phone: '+1 (646) 589-4168', preview: 'You received a one-time passcode…', at: minsAgo(40), unread: 0, kind: 'business', favorite: true },
  { id: 'demo-priya', name: 'Priya Sharma', phone: '+91 98110 22334', preview: 'Please send the updated quote', at: minsAgo(95), unread: 2, kind: 'contact', favorite: true },
  { id: 'demo-rahul', name: 'Rahul Verma', phone: '+91 99871 45502', preview: 'Voice call', at: minsAgo(60 * 26), unread: 0, kind: 'contact' },
  { id: 'demo-acme', name: 'Acme Traders · Orders', phone: '+91 11 4155 8890', preview: 'Amit: Order confirmed for Friday', at: minsAgo(60 * 27), unread: 5, kind: 'group' },
  { id: 'demo-neha', name: 'Neha Kapoor', phone: '+91 98300 11223', preview: 'Ok, thank you!', at: minsAgo(60 * 30), unread: 0, kind: 'contact' },
  { id: 'demo-elite', name: 'Elite Interiors · Website', phone: '+91 22 4890 7711', preview: 'Nitin: Ok', at: minsAgo(60 * 31), unread: 13, kind: 'group' },
];

const DEMO_MESSAGES: Record<string, WaChatMessage[]> = {
  'demo-wa-business': [
    { id: 'd1', direction: 'system', body: 'This business uses a secure service from Meta to manage this chat. Click to learn more.', at: minsAgo(45) },
    { id: 'd2', direction: 'inbound', body: 'You received a one-time passcode. For added security, you can only see it on your primary device for WhatsApp.', at: minsAgo(44) },
    { id: 'd3', direction: 'system', body: 'This business is now using a secure service from Meta to manage this chat.', at: minsAgo(40) },
  ],
  'demo-priya': [
    { id: 'd1', direction: 'inbound', body: 'Hi! Did you get a chance to review the proposal?', at: minsAgo(120) },
    { id: 'd2', direction: 'outbound', body: 'Yes, reviewing it today and will revert by evening.', at: minsAgo(110), status: 'read' },
    { id: 'd3', direction: 'inbound', body: 'Please send the updated quote', at: minsAgo(95) },
  ],
  'demo-rahul': [
    { id: 'd1', direction: 'system', body: 'Voice call · 4 min', at: minsAgo(60 * 26) },
  ],
  'demo-acme': [
    { id: 'd1', direction: 'inbound', body: 'Amit: Order confirmed for Friday', at: minsAgo(60 * 27) },
    { id: 'd2', direction: 'outbound', body: 'Great, dispatching on Thursday.', at: minsAgo(60 * 27) , status: 'delivered' },
  ],
  'demo-neha': [
    { id: 'd1', direction: 'outbound', body: 'Sharing the brochure shortly.', at: minsAgo(60 * 31), status: 'read' },
    { id: 'd2', direction: 'inbound', body: 'Ok, thank you!', at: minsAgo(60 * 30) },
  ],
  'demo-elite': [
    { id: 'd1', direction: 'inbound', body: 'Nitin: Ok', at: minsAgo(60 * 31) },
  ],
};

const DEMO_NEW_CONTACTS: WaConversation[] = [
  { id: 'demo-new-arjun', name: 'Arjun Mehta', phone: '+91 98220 33445', kind: 'contact' },
  { id: 'demo-new-sana', name: 'Sana Sheikh', phone: '+91 90040 55667', kind: 'contact' },
  { id: 'demo-new-builders', name: 'City Builders · Site Team', phone: '+91 80 4123 9090', kind: 'group' },
];

function Tick({ status }: { status?: string | undefined }) {
  if (status === 'demo') return <span className="ml-1 text-[10px] italic text-muted-foreground">demo · not sent</span>;
  if (status === 'read') return <CheckCheck className="size-3.5 text-wa-tick" />;
  if (status === 'delivered') return <CheckCheck className="size-3.5 text-muted-foreground" />;
  return <Check className="size-3.5 text-muted-foreground" />;
}

export function WhatsAppWebChat(p: Props) {
  const demoMode = !p.connected;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [demoConvs, setDemoConvs] = useState<WaConversation[]>(DEMO_CONVERSATIONS);
  const [demoMsgs, setDemoMsgs] = useState<Record<string, WaChatMessage[]>>(DEMO_MESSAGES);
  const [demoSel, setDemoSel] = useState('');
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatQ, setNewChatQ] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedIsDemo = demoMode && !!demoSel && !p.selectedId;
  const real = useMemo(() => p.conversations.filter((c) => (!q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || (filter === 'unread' ? (c.unread ?? 0) > 0 : filter === 'favorites' ? c.favorite : c.kind === 'group'))), [p.conversations, q, filter]);
  const demos = useMemo(() => demoConvs.filter((c) => (!q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || (filter === 'unread' ? (c.unread ?? 0) > 0 : filter === 'favorites' ? c.favorite : c.kind === 'group'))), [demoConvs, q, filter]);

  const selectedReal = p.conversations.find((c) => c.id === p.selectedId) ?? null;
  const selectedDemo = demoConvs.find((c) => c.id === demoSel) ?? null;
  const active = selectedReal ?? selectedDemo;
  const anySelected = !!active;

  const activeMessages: WaChatMessage[] = selectedReal ? p.messages : (demoMsgs[demoSel] ?? []);
  const activeLoading = selectedReal ? p.messagesLoading : false;
  const activeError = selectedReal ? p.messagesError : null;

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [activeMessages.length, p.selectedId, demoSel]);
  useEffect(() => { setDetailsOpen(false); setMenuOpen(false); setDraft(''); }, [p.selectedId, demoSel]);

  const select = (c: WaConversation, isDemo: boolean) => {
    setMenuOpen(false);
    if (isDemo) {
      p.onSelect('');
      setDemoSel(c.id);
      setDemoConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
    } else {
      setDemoSel('');
      p.onSelect(c.id);
    }
  };

  const sendDemo = () => {
    const body = draft.trim();
    if (!body || !selectedDemo) return;
    setDemoMsgs((m) => ({ ...m, [demoSel]: [...(m[demoSel] ?? []), { id: `local-${Date.now()}`, direction: 'outbound', body, at: now(), status: 'demo' }] }));
    setDemoConvs((cs) => cs.map((x) => (x.id === demoSel ? { ...x, preview: body, at: now() } : x)));
    setDraft('');
  };

  const startNewChat = (c: WaConversation) => {
    setDemoConvs((cs) => (cs.some((x) => x.id === c.id) ? cs : [{ ...c, preview: '', at: now(), unread: 0 }, ...cs]));
    setDemoMsgs((m) => (m[c.id] ? m : { ...m, [c.id]: [{ id: `sys-${c.id}`, direction: 'system', body: 'Demo conversation started locally. No message is sent to WhatsApp.', at: now() }] }));
    setNewChatOpen(false);
    select(c, true);
  };

  const attachPick = (label: string) => {
    setAttachOpen(false);
    toast.info(`${label}: preview only. No file is uploaded or sent until WhatsApp Business is connected.`);
  };

  const menuAction = (label: string) => {
    setMenuOpen(false);
    toast.info(`${label}: preview only.`);
  };

  const row = (c: WaConversation, isDemo: boolean) => (
    <button
      key={c.id}
      onClick={() => select(c, isDemo)}
      className={cn('flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60', (isDemo ? demoSel === c.id : p.selectedId === c.id) && 'bg-muted')}
    >
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground', avatarColor(c.name))}>{initials(c.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{c.name}</span>
          <span className={cn('shrink-0 text-xs', (c.unread ?? 0) > 0 ? 'font-semibold text-wa-green-deep' : 'text-muted-foreground')}>{fmtDay(c.at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{c.preview || c.phone}</span>
          {isDemo && <span className="shrink-0 rounded-full border border-warning/40 bg-warning-soft px-1.5 py-px text-[10px] font-semibold text-warning">Demo</span>}
          {(c.unread ?? 0) > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-wa-unread text-[11px] font-bold text-primary-foreground">{c.unread}</span>}
        </span>
      </span>
    </button>
  );

  return (
    <div className={cn('flex overflow-hidden rounded-xl border bg-card shadow-card', p.className)}>
      {/* ===== Chat list ===== */}
      <aside className={cn('flex w-full shrink-0 flex-col border-r bg-card md:w-[340px] lg:w-[380px]', anySelected && 'hidden md:flex')}>
        <header className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-xl font-extrabold tracking-tight">WhatsApp</h2>
          <div className="flex items-center gap-1">
            <button aria-label="New chat" title="New chat" onClick={() => { setNewChatOpen(true); setNewChatQ(''); }} className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted"><MessageCirclePlus className="size-5" /></button>
            <button aria-label="More options" title="More options" onClick={() => toast.info('Preview only.')} className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted"><MoreVertical className="size-5" /></button>
          </div>
        </header>
        <div className="px-4 pb-2">
          <label className="flex h-10 items-center gap-2 rounded-full bg-muted px-4">
            <Search className="size-4 shrink-0 text-wa-icon" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or start a new chat" aria-label="Search chats" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {q && <button aria-label="Clear search" onClick={() => setQ('')} className="text-wa-icon"><X className="size-4" /></button>}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-1">
          {([['all', 'All'], ['unread', `Unread${demos.reduce((a, c) => a + (c.unread ?? 0), 0) + real.reduce((a, c) => a + (c.unread ?? 0), 0) ? ` ${demos.reduce((a, c) => a + (c.unread ?? 0), 0) + real.reduce((a, c) => a + (c.unread ?? 0), 0)}` : ''}`], ['favorites', 'Favorites'], ['groups', 'Groups']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn('rounded-full border px-3 py-1 text-[13px] font-medium', filter === k ? 'border-wa-green-deep/30 bg-wa-bubble font-semibold text-wa-green-deep' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
          ))}
          <button aria-label="New chat" title="New chat" onClick={() => { setNewChatOpen(true); setNewChatQ(''); }} className="grid size-7 place-items-center rounded-full border text-muted-foreground hover:bg-muted"><Plus className="size-4" /></button>
        </div>
        {demoMode && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p><b>Demo data.</b> WhatsApp Business is not connected — no real messages are sent or received. Connect it to see live chats here.</p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {p.loading ? <p className="p-6 text-center text-sm text-muted-foreground">Loading chats…</p>
            : p.error ? <p role="alert" className="p-6 text-center text-sm text-destructive">{p.error}</p>
            : (<>
                {demos.map((c) => row(c, true))}
                {real.map((c) => row(c, false))}
                {!demos.length && !real.length && <p className="p-8 text-center text-sm text-muted-foreground">{p.emptyNote ?? 'No chats found'}</p>}
              </>)}
        </div>
      </aside>

      {/* ===== Conversation ===== */}
      <main className={cn('relative flex min-w-0 flex-1 flex-col', !anySelected && 'hidden md:flex')}>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-wa-panel p-10 text-center">
            <span className="grid size-24 place-items-center rounded-full bg-wa-bubble"><MessageCirclePlus className="size-12 text-wa-green-deep" strokeWidth={1.4} /></span>
            <h2 className="text-3xl font-light text-foreground">Routiva WhatsApp Chats</h2>
            <p className="max-w-md text-sm text-muted-foreground">Send and receive WhatsApp messages with your leads and customers without leaving the CRM.{demoMode && ' Showing demo chats until WhatsApp Business is connected.'}</p>
            <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5 text-wa-green-deep" />End-to-end encrypted</p>
          </div>
        ) : (<>
          <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-wa-panel px-3">
            <button aria-label="Back to chats" className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted md:hidden" onClick={() => { setDemoSel(''); p.onSelect(''); }}><ArrowLeft className="size-5" /></button>
            <button onClick={() => setDetailsOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-muted/60">
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground', avatarColor(active.name))}>{initials(active.name)}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2"><b className="truncate">{active.name}</b>{selectedIsDemo && <span className="shrink-0 rounded-full border border-warning/40 bg-warning-soft px-1.5 py-px text-[10px] font-semibold text-warning">Demo</span>}</span>
                <span className="block truncate text-xs text-muted-foreground">{active.kind === 'group' ? 'Group · tap for info' : active.phone}</span>
              </span>
            </button>
            <button aria-label="Voice call" title="Voice call" onClick={() => toast.info('Calling requires the WhatsApp Business connection.')} className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted"><Phone className="size-[18px]" /></button>
            <button aria-label="Search in chat" title="Search in chat" onClick={() => toast.info('In-chat search: preview only.')} className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted"><Search className="size-[18px]" /></button>
            <div className="relative">
              <button aria-label="Conversation menu" title="Conversation menu" onClick={() => setMenuOpen((v) => !v)} className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted"><MoreVertical className="size-[18px]" /></button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-lg border bg-popover py-1 shadow-float">
                  {[['Contact info', () => { setMenuOpen(false); setDetailsOpen(true); }], ['Select messages', () => menuAction('Select messages')], ['Mute notifications', () => menuAction('Mute notifications')], ['Clear chat', () => menuAction('Clear chat')]].map(([l, fn]) => (
                    <button key={l as string} onClick={fn as () => void} className="block w-full px-4 py-2 text-left text-sm hover:bg-muted">{l as string}</button>
                  ))}
                </div>
              )}
            </div>
          </header>

          {selectedReal?.leadTo && selectedReal.leadLabel && (
            <div className="border-b bg-wa-panel px-4 py-1.5 text-xs"><Link to={selectedReal.leadTo as '/my-leads'} className="font-semibold text-admin-blue hover:underline">{selectedReal.leadLabel} · CRM Lead</Link></div>
          )}

          <div ref={scrollRef} className="bg-wa-chat-pattern flex-1 space-y-2 overflow-y-auto px-4 py-4 md:px-10">
            <p className="mx-auto w-fit rounded-lg bg-wa-panel px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">Today</p>
            {activeError ? <p role="alert" className="text-center text-sm text-destructive">{activeError}</p>
              : activeLoading ? <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
              : activeMessages.map((m) => m.direction === 'system' ? (
                <p key={m.id} className="mx-auto max-w-md rounded-lg bg-wa-bubble/80 px-4 py-2 text-center text-xs text-muted-foreground shadow-card">{m.body}</p>
              ) : (
                <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-lg px-3 py-1.5 shadow-card md:max-w-[65%]', m.direction === 'outbound' ? 'rounded-tr-none bg-wa-bubble' : 'rounded-tl-none bg-card')}>
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">{fmtTime(m.at)}{m.direction === 'outbound' && <Tick status={m.status} />}</p>
                  </div>
                </div>
              ))}
            {!activeLoading && !activeMessages.length && <p className="pt-10 text-center text-sm text-muted-foreground">No messages yet</p>}
          </div>

          <footer className="relative flex shrink-0 items-center gap-1.5 bg-wa-panel px-3 py-2">
            <div className="relative">
              <button aria-label="Attach" title="Attach" onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }} className="grid size-10 place-items-center rounded-full text-wa-icon hover:bg-muted"><Paperclip className="size-5" /></button>
              {attachOpen && (
                <div className="absolute bottom-12 left-0 z-20 w-56 overflow-hidden rounded-xl border bg-popover py-1 shadow-float">
                  <button onClick={() => attachPick('Photos & videos')} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted"><ImageIcon className="size-5 text-admin-purple" />Photos & videos</button>
                  <button onClick={() => attachPick('Camera')} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted"><Camera className="size-5 text-admin-pink" />Camera</button>
                  <button onClick={() => attachPick('Document')} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted"><FileText className="size-5 text-admin-blue" />Document</button>
                </div>
              )}
            </div>
            <div className="relative">
              <button aria-label="Emoji" title="Emoji" onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }} className="grid size-10 place-items-center rounded-full text-wa-icon hover:bg-muted"><Smile className="size-5" /></button>
              {emojiOpen && (
                <div className="absolute bottom-12 left-0 z-20 grid w-64 grid-cols-8 gap-1 rounded-xl border bg-popover p-2 shadow-float">
                  {EMOJIS.map((e) => <button key={e} onClick={() => setDraft((d) => d + e)} className="rounded p-1 text-lg hover:bg-muted">{e}</button>)}
                </div>
              )}
            </div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDemo(); } }}
              placeholder={selectedIsDemo ? 'Type a demo message' : 'Type a message'}
              aria-label="Message"
              disabled={!selectedIsDemo}
              className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30 disabled:opacity-70"
            />
            {selectedIsDemo && draft.trim() ? (
              <button aria-label="Send demo message" title="Send demo message" onClick={sendDemo} className="grid size-11 shrink-0 place-items-center rounded-full bg-wa-green-deep text-primary-foreground hover:opacity-90"><Send className="size-5" /></button>
            ) : (
              <button aria-label="Voice message" title="Voice message" onClick={() => toast.info(selectedIsDemo ? 'Voice messages: preview only.' : 'Sending requires a verified WhatsApp Business connection.')} className="grid size-11 shrink-0 place-items-center rounded-full text-wa-icon hover:bg-muted"><Mic className="size-5" /></button>
            )}
          </footer>
          {!selectedIsDemo && (
            <p className="bg-wa-panel px-4 pb-2 text-center text-xs text-muted-foreground">Sending requires a verified WhatsApp Business connection — messages typed here are not sent.</p>
          )}

          {/* Contact details panel */}
          {detailsOpen && (
            <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l bg-card shadow-float">
              <header className="flex h-16 items-center gap-4 border-b bg-wa-panel px-4">
                <button aria-label="Close contact info" onClick={() => setDetailsOpen(false)} className="text-wa-icon"><X className="size-5" /></button>
                <h3 className="font-semibold">{active.kind === 'group' ? 'Group info' : 'Contact info'}</h3>
              </header>
              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className={cn('grid size-28 place-items-center rounded-full text-3xl font-bold text-primary-foreground', avatarColor(active.name))}>{initials(active.name)}</span>
                  <div>
                    <p className="text-xl font-semibold">{active.name}</p>
                    <p className="text-sm text-muted-foreground">{active.phone}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{active.kind === 'business' ? 'Business account' : active.kind === 'group' ? 'Group chat' : 'Contact'}{selectedIsDemo && ' · Demo contact'}</p>
                  </div>
                </div>
                {selectedIsDemo && <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-center text-xs text-warning">Demo contact — shown for layout preview only.</p>}
                <div className="space-y-2">
                  <button onClick={() => toast.info('Add to contacts: preview only.')} className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-wa-green-deep hover:bg-muted"><UserPlus className="size-4" />Add to contacts</button>
                  <button onClick={() => toast.info('Profile: preview only.')} className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-wa-green-deep hover:bg-muted"><IdCard className="size-4" />Profile</button>
                  <button onClick={() => toast.info('Block: preview only.')} className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-destructive hover:bg-muted"><Ban className="size-4" />Block {active.name}</button>
                </div>
              </div>
            </div>
          )}
        </>)}
      </main>

      {/* New chat dialog */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New chat</DialogTitle></DialogHeader>
          <label className="flex h-10 items-center gap-2 rounded-full bg-muted px-4">
            <Search className="size-4 text-wa-icon" />
            <input value={newChatQ} onChange={(e) => setNewChatQ(e.target.value)} placeholder="Search name or number" aria-label="Search contacts" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="max-h-72 overflow-y-auto">
            {DEMO_NEW_CONTACTS.filter((c) => !demoConvs.some((x) => x.id === c.id) && (!newChatQ || `${c.name} ${c.phone}`.toLowerCase().includes(newChatQ.toLowerCase()))).map((c) => (
              <button key={c.id} onClick={() => startNewChat(c)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground', avatarColor(c.name))}>{initials(c.name)}</span>
                <span className="min-w-0"><b className="block truncate text-sm">{c.name}</b><span className="block truncate text-xs text-muted-foreground">{c.phone} · Demo contact</span></span>
              </button>
            ))}
            <p className="px-2 py-3 text-xs text-muted-foreground">Demo contacts start a local preview chat only. Real WhatsApp conversations begin once WhatsApp Business is connected.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
