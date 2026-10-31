import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Ban, Camera, Check, CheckCheck, Clock, CircleAlert, FileText, IdCard, Image as ImageIcon,
  MessageCirclePlus, Mic, MoreVertical, Paperclip, Phone, Plus, Search, Send, ShieldCheck, Smile, UserPlus, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { waContactInput } from '@/lib/messaging';
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

export type WaContactForm = { name: string; countryCode: string; phone: string };

type Props = {
  me: { name: string; role: string };
  conversations: WaConversation[];
  connected: boolean;
  connectedPhone?: string | null | undefined;
  loading?: boolean;
  error?: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
  messages: WaChatMessage[];
  messagesLoading?: boolean;
  messagesError?: string | null;
  emptyNote?: string;
  className?: string;
  openSignal?: number;
  onCheckConnection: () => Promise<boolean>;
  checkingConnection?: boolean;
  onAddContact: (input: WaContactForm) => Promise<void>;
  onSend?: ((body:string)=>Promise<void>) | undefined;
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

const COUNTRY_CODES = ['+91', '+1', '+44', '+971', '+65', '+61', '+880', '+92', '+94', '+966'];

function Tick({ status }: { status?: string | undefined }) {
  if (status === 'read') return <CheckCheck className="size-3.5 text-wa-tick" />;
  if (status === 'delivered') return <CheckCheck className="size-3.5 text-muted-foreground" />;
  if(status==='sent')return <Check aria-label="Sent" className="size-3.5 text-muted-foreground" />;
  if(status==='failed'||status==='unknown')return <CircleAlert aria-label={status==='failed'?'Failed':'Outcome unknown'} className="size-3.5 text-destructive"/>;
  return <Clock aria-label="Delivery pending" className="size-3.5 text-muted-foreground" />;
}

export function WhatsAppWebChat(p: Props) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<'phone' | 'verify'>('phone');
  const [connectForm, setConnectForm] = useState<WaContactForm>({ name: '', countryCode: '+91', phone: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<WaContactForm>({ name: '', countryCode: '+91', phone: '' });
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversations = p.conversations.filter((c) => (!q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || (filter === 'unread' ? (c.unread ?? 0) > 0 : filter === 'favorites' ? c.favorite : c.kind === 'group')));
  const active = p.conversations.find((c) => c.id === p.selectedId) ?? null;
  const anySelected = !!active;
  const canSend = p.connected && !!active && Boolean(p.onSend);
  const send = async()=>{if(!p.onSend||!draft.trim()||saving)return;setSaving(true);try{await p.onSend(draft.trim());setDraft('');}catch(e){toast.error(e instanceof Error?e.message:'Message was not sent');}finally{setSaving(false);}};

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [p.messages.length, p.selectedId]);
  useEffect(() => { setDetailsOpen(false); setMenuOpen(false); setDraft(''); }, [p.selectedId]);
  useEffect(() => {
    if (!p.openSignal) return;
    if (p.connected) openAddNumber();
    else { setConnectStep('phone'); setConnectForm({ name: '', countryCode: '+91', phone: '' }); setConnectOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.openSignal]);

  const select = (c: WaConversation) => { setMenuOpen(false); p.onSelect(c.id); };

  const openAddNumber = () => { setAddForm({ name: '', countryCode: '+91', phone: '' }); setAddOpen(true); };

  const saveContact = async () => {
    const parsed = waContactInput.safeParse(addForm);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Check the contact details'); return; }
    setSaving(true);
    try {
      await p.onAddContact(addForm);
      toast.success(`${addForm.name.trim()} added to WhatsApp chats`);
      setAddOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Contact could not be saved');
    } finally { setSaving(false); }
  };

  const continueConnect = () => {
    const parsed = waContactInput.safeParse({ name: 'Business', countryCode: connectForm.countryCode, phone: connectForm.phone });
    if (!parsed.success) { toast.error('Enter a valid country code and WhatsApp Business number'); return; }
    setConnectStep('verify');
  };

  const checkConnection = async () => {
    const ok = await p.onCheckConnection();
    if (ok) { toast.success('WhatsApp Business is connected'); setConnectOpen(false); setConnectStep('phone'); }
    else toast.info('Not connected yet. Complete Meta’s verification in the official WhatsApp Business onboarding, then check again.');
  };

  const attachPick = (label: string) => {
    setAttachOpen(false);
    toast.info(`${label}: preview only. No file is uploaded or sent until WhatsApp Business sending is enabled.`);
  };

  const menuAction = (label: string) => {
    setMenuOpen(false);
    toast.info(`${label}: preview only.`);
  };

  const row = (c: WaConversation) => (
    <button
      key={c.id}
      onClick={() => select(c)}
      className={cn('flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60', p.selectedId === c.id && 'bg-muted')}
    >
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground', avatarColor(c.name))}>{initials(c.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{c.name}</span>
          <span className={cn('shrink-0 text-xs', (c.unread ?? 0) > 0 ? 'font-semibold text-wa-green-deep' : 'text-muted-foreground')}>{fmtDay(c.at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{c.preview || c.phone}</span>
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
            <button aria-label="New chat" title="New chat" onClick={openAddNumber} className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted"><MessageCirclePlus className="size-5" /></button>
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
          {([['all', 'All'], ['unread', `Unread${p.conversations.reduce((a, c) => a + (c.unread ?? 0), 0) ? ` ${p.conversations.reduce((a, c) => a + (c.unread ?? 0), 0)}` : ''}`], ['favorites', 'Favorites'], ['groups', 'Groups']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn('rounded-full border px-3 py-1 text-[13px] font-medium', filter === k ? 'border-wa-green-deep/30 bg-wa-bubble font-semibold text-wa-green-deep' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
          ))}
          <button aria-label="New chat" title="New chat" onClick={openAddNumber} className="grid size-7 place-items-center rounded-full border text-muted-foreground hover:bg-muted"><Plus className="size-4" /></button>
        </div>
        {!p.connected && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p><b>Not connected.</b> Add client numbers and preview chats now — real messages only flow after WhatsApp Business is connected and verified.</p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {p.loading ? <p className="p-6 text-center text-sm text-muted-foreground">Loading chats…</p>
            : p.error ? <p role="alert" className="p-6 text-center text-sm text-destructive">{p.error}</p>
            : (<>
                {conversations.map((c) => row(c))}
                {!conversations.length && <p className="p-8 text-center text-sm text-muted-foreground">{p.emptyNote ?? 'No chats yet. Add a client number to start.'}</p>}
              </>)}
        </div>
      </aside>

      {/* ===== Conversation ===== */}
      <main className={cn('relative flex min-w-0 flex-1 flex-col', !anySelected && 'hidden md:flex')}>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-wa-panel p-10 text-center">
            <span className="grid size-24 place-items-center rounded-full bg-wa-bubble"><MessageCirclePlus className="size-12 text-wa-green-deep" strokeWidth={1.4} /></span>
            <h2 className="text-3xl font-light text-foreground">Routiva WhatsApp Chats</h2>
            <p className="max-w-md text-sm text-muted-foreground">Send and receive WhatsApp messages with your leads and customers without leaving the CRM.{p.connected ? ` Connected as ${p.connectedPhone ?? 'your business number'}.` : ' Connect WhatsApp Business to enable live messaging.'}</p>
          </div>
        ) : (<>
          <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-wa-panel px-3">
            <button aria-label="Back to chats" className="grid size-9 place-items-center rounded-full text-wa-icon hover:bg-muted md:hidden" onClick={() => p.onSelect('')}><ArrowLeft className="size-5" /></button>
            <button onClick={() => setDetailsOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-muted/60">
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground', avatarColor(active.name))}>{initials(active.name)}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2"><b className="truncate">{active.name}</b></span>
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

          {active.leadTo && active.leadLabel && (
            <div className="border-b bg-wa-panel px-4 py-1.5 text-xs"><Link to={active.leadTo as '/my-leads'} className="font-semibold text-admin-blue hover:underline">{active.leadLabel} · CRM Lead</Link></div>
          )}

          <div ref={scrollRef} className="bg-wa-chat-pattern flex-1 space-y-2 overflow-y-auto px-4 py-4 md:px-10">
            <p className="mx-auto w-fit rounded-lg bg-wa-panel px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">Today</p>
            {p.messagesError ? <p role="alert" className="text-center text-sm text-destructive">{p.messagesError}</p>
              : p.messagesLoading ? <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
              : p.messages.map((m) => m.direction === 'system' ? (
                <p key={m.id} className="mx-auto max-w-md rounded-lg bg-wa-bubble/80 px-4 py-2 text-center text-xs text-muted-foreground shadow-card">{m.body}</p>
              ) : (
                <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-lg px-3 py-1.5 shadow-card md:max-w-[65%]', m.direction === 'outbound' ? 'rounded-tr-none bg-wa-bubble' : 'rounded-tl-none bg-card')}>
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">{fmtTime(m.at)}{m.direction === 'outbound' && <Tick status={m.status} />}</p>
                  </div>
                </div>
              ))}
            {!p.messagesLoading && !p.messages.length && <p className="pt-10 text-center text-sm text-muted-foreground">No messages yet</p>}
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
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault();void send(); } }}
              placeholder="Type a message"
              aria-label="Message"
              disabled={!canSend}
              className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30 disabled:opacity-70"
            />
            {canSend && draft.trim() ? (
              <Button size="icon" aria-label="Send message" title="Send message" disabled={saving} onClick={send} className="size-11 shrink-0 rounded-full bg-wa-green-deep text-primary-foreground hover:opacity-90"><Send className="size-5" /></Button>
            ) : (
              <button aria-label="Voice message" title="Voice message" onClick={() => toast.info('Sending requires a verified WhatsApp Business connection.')} className="grid size-11 shrink-0 place-items-center rounded-full text-wa-icon hover:bg-muted"><Mic className="size-5" /></button>
            )}
          </footer>
          {!canSend && (
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
                    <p className="mt-1 text-xs text-muted-foreground">{active.kind === 'business' ? 'Business account' : active.kind === 'group' ? 'Group chat' : 'Contact'}</p>
                  </div>
                </div>
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

      {/* Connect WhatsApp Business dialog */}
      <Dialog open={connectOpen} onOpenChange={(v) => { setConnectOpen(v); if (!v) setConnectStep('phone'); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connect WhatsApp Business</DialogTitle></DialogHeader>
          {connectStep === 'phone' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the phone number you use for WhatsApp Business. Meta verifies this number with a one-time code during the official onboarding.</p>
              <div className="flex gap-2">
                <div className="w-32 shrink-0">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="wa-cc">Country code</label>
                  <input id="wa-cc" list="wa-cc-list" value={connectForm.countryCode} onChange={(e) => setConnectForm((f) => ({ ...f, countryCode: e.target.value }))} className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
                  <datalist id="wa-cc-list">{COUNTRY_CODES.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="wa-phone">WhatsApp Business number</label>
                  <input id="wa-phone" inputMode="numeric" placeholder="98110 22334" value={connectForm.phone} onChange={(e) => setConnectForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d ]/g, '') }))} className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConnectOpen(false)}>Cancel</Button>
                <Button onClick={continueConnect} className="bg-wa-green-deep text-primary-foreground hover:opacity-90">Continue</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm"><b>{connectForm.countryCode} {connectForm.phone}</b></p>
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <p>WhatsApp sends the one-time verification code to this number directly — by SMS or voice call — during <b>Meta’s official WhatsApp Business onboarding</b> (Lovable → Connectors → WhatsApp Business). The code is never entered in this app, and this app cannot mark the number connected on its own.</p>
                <p>After you finish Meta’s verification and the number is linked to this app, check the status below.</p>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setConnectStep('phone')}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setConnectOpen(false); setConnectStep('phone'); }}>Cancel</Button>
                  <Button onClick={checkConnection} disabled={p.checkingConnection} className="bg-wa-green-deep text-primary-foreground hover:opacity-90">{p.checkingConnection ? 'Checking…' : 'Check connection status'}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Number dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Number</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="wa-add-name">Client Name</label>
              <input id="wa-add-name" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} maxLength={100} className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="flex gap-2">
              <div className="w-32 shrink-0">
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="wa-add-cc">Country Code</label>
                <input id="wa-add-cc" list="wa-cc-list" value={addForm.countryCode} onChange={(e) => setAddForm((f) => ({ ...f, countryCode: e.target.value }))} className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="wa-add-phone">WhatsApp Number</label>
                <input id="wa-add-phone" inputMode="numeric" placeholder="98110 22334" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d ]/g, '') }))} className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The contact is saved to your WhatsApp chat list only — no message is sent and no personal contacts are imported.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={saveContact} disabled={saving} className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90">{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
