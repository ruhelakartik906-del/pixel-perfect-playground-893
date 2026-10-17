import { useEffect, useState, type FormEvent } from 'react';
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, Filter, Headphones, Loader2, LockKeyhole, MessageSquare, Paperclip, Plus, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DataTable, EmptyState, SearchInput, StatusBadge } from '@/components/admin/ui';
import { supabase } from '@/integrations/supabase/client';
import { canReopen, supportCategories, supportPriorities, supportStatuses, validateSupportFile } from '@/lib/support-model';
import { changeSupportTicket, createSupportTicket, downloadSupportAttachment, getSupportTicket, getSupportWorkspace, replySupportTicket, uploadSupportAttachment } from '@/lib/support.functions';

export const supportQuery = (admin: boolean) => queryOptions({ queryKey: ['support-list', admin, '', '', '', '', '', 0, false], queryFn: () => getSupportWorkspace({ data: { admin } }) });
const inputClass = 'w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30';
const date = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const number = (value: number) => `RT-${String(value).padStart(6, '0')}`;
const failure = (error: unknown) => toast.error(error instanceof Error ? error.message : 'Please try again.');
function Options({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return <label className="grid gap-1 text-sm font-semibold"><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>{options.map(o => <option key={o} value={o}>{o || `All ${label.toLowerCase()}`}</option>)}</select></label>;
}
async function attachmentData(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer()); validateSupportFile(bytes, file.type);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return { filename: file.name, mime: file.type, base64: btoa(binary) };
}
export function SupportPage({ admin = false }: { admin?: boolean }) {
  const client = useQueryClient(); useSuspenseQuery(supportQuery(admin));
  const fetch = useServerFn(getSupportWorkspace);
  const [search, setSearch] = useState(''); const [term, setTerm] = useState('');
  const [status, setStatus] = useState(''); const [priority, setPriority] = useState(''); const [category, setCategory] = useState(''); const [company, setCompany] = useState(''); const [page, setPage] = useState(0); const [oldest, setOldest] = useState(false); const [filters, setFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null); const [creating, setCreating] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setTerm(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['support-list', admin, term, status, priority, category, company, page, oldest], queryFn: () => fetch({ data: { admin, search: term, status, priority, category, company, page, oldest } }) });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['support-list'] }); void client.invalidateQueries({ queryKey: ['support-detail'] }); };
  useEffect(() => {
    const channel = supabase.channel(`support-${admin ? 'admin' : 'user'}`).on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, refresh).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [admin, client]);
  const data = query.data;
  const count = data?.count ?? 0;
  const changeFilter = (setter: (v: string) => void) => (value: string) => { setter(value); setPage(0); };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Headphones className="size-4" />Support</div><h1 className="text-2xl font-bold">{admin ? 'Support Ticket Management' : 'My Support Tickets'}</h1></div>
      <div className="flex flex-wrap gap-2"><SearchInput placeholder={admin ? 'Search ID, user or subject' : 'Search my tickets'} value={search} onChange={setSearch} /><Button variant="outline" onClick={() => setFilters(!filters)}><Filter />Filter</Button><Button variant="outline" size="icon" title="Refresh tickets" aria-label="Refresh tickets" onClick={refresh}><RefreshCw className={query.isFetching ? 'animate-spin' : ''} /></Button>{!admin && <Button onClick={() => setCreating(true)}><Plus />Create New Ticket</Button>}</div>
    </div>
    {admin && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{['Total', 'Open', 'In Progress', 'Resolved', 'Closed'].map((s, index) => <div key={s} className="rounded-lg border bg-card p-4 shadow-card"><div className="flex justify-between text-sm text-muted-foreground"><span>{s === 'Total' ? 'Total Tickets' : s === 'Open' ? 'Open Tickets' : s}</span>{index === 3 ? <CheckCircle2 className="size-4 text-success" /> : <MessageSquare className="size-4 text-admin-blue" />}</div><p className="mt-3 text-3xl font-bold">{data?.counts[s] ?? '—'}</p></div>)}</div>}
    {filters && <div className="grid gap-3 border-y py-4 sm:grid-cols-2 xl:grid-cols-5"><Options label="Status" value={status} options={['', ...supportStatuses]} onChange={changeFilter(setStatus)} /><Options label="Priority" value={priority} options={['', ...supportPriorities]} onChange={changeFilter(setPriority)} /><Options label="Category" value={category} options={['', ...supportCategories]} onChange={changeFilter(setCategory)} />{admin && <label className="grid gap-1 text-sm font-semibold">Company<select aria-label="Company" className={inputClass} value={company} onChange={e => changeFilter(setCompany)(e.target.value)}><option value="">All companies</option>{data?.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<Options label="Sort" value={oldest ? 'Oldest first' : 'Newest first'} options={['Newest first', 'Oldest first']} onChange={v => { setOldest(v === 'Oldest first'); setPage(0); }} /></div>}
    <div className="overflow-hidden rounded-lg border bg-card shadow-card">
      {query.isError ? <div role="alert" className="p-8 text-destructive">Tickets could not be loaded. <Button variant="outline" onClick={refresh}>Try again</Button></div> : query.isPending ? <div className="grid place-items-center p-12"><Loader2 className="animate-spin" /></div> : <><DataTable columns={admin ? ['Ticket ID', 'Subject', 'User Name', 'Email', 'Company', 'Category', 'Priority', 'Status', 'Created Date', 'Last Updated', 'Actions'] : ['Ticket ID', 'Subject', 'Category', 'Priority', 'Status', 'Last Updated', 'Actions']} minWidth={admin ? 1550 : 900}>
        {data?.tickets.map(t => {
          const unread = admin ? !t.admin_read_at || t.last_user_message_at > t.admin_read_at : Boolean(t.last_admin_message_at && t.last_admin_message_at > t.user_read_at);
          return <tr key={t.id} className="hover:bg-muted/40"><td className="whitespace-nowrap px-4 py-4 font-semibold text-admin-blue">{number(t.number)}</td><td className="px-4 py-4"><div className="max-w-64 break-words font-semibold">{t.subject}</div>{unread && <span className="text-xs font-semibold text-admin-blue">{admin ? 'Unread activity' : 'Unread admin reply'}</span>}</td>{admin && <><td className="px-4">{t.user_name}</td><td className="px-4">{t.user_email}</td><td className="px-4">{data.companies.find(c => c.id === t.company_id)?.name ?? 'No company'}</td></>}<td className="px-4">{t.category}</td><td className="px-4"><StatusBadge tone={t.priority === 'Urgent' || t.priority === 'High' ? 'red' : 'gray'}>{t.priority}</StatusBadge></td><td className="whitespace-nowrap px-4"><StatusBadge tone={t.status === 'Resolved' ? 'green' : 'blue'}>{t.status}</StatusBadge></td>{admin && <td className="whitespace-nowrap px-4 text-sm">{date(t.created_at)}</td>}<td className="whitespace-nowrap px-4 text-sm">{date(t.updated_at)}</td><td className="px-4"><Button variant="ghost" size="icon" aria-label={`View ${number(t.number)}`} title="View ticket" onClick={() => setSelected(t.id)}><Eye className="size-4" /></Button></td></tr>;
        })}
      </DataTable>{data?.tickets.length === 0 && <EmptyState title={term || status || priority || category || company ? 'No matching tickets' : 'No support tickets yet'} />}</>}
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground"><span>{count ? `${page * 20 + 1}–${Math.min(count, (page + 1) * 20)} of ${count}` : '0 tickets'}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous page" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>Page {page + 1}</span><Button variant="outline" size="icon" aria-label="Next page" disabled={(page + 1) * 20 >= count} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div>
    </div>
    <NewTicket open={creating} onOpenChange={setCreating} companies={data?.companies ?? []} onCreated={id => { setCreating(false); setSelected(id); refresh(); }} />
    {selected && <TicketDetail id={selected} admin={admin} companyName={data?.companies.find(c => c.id === data.tickets.find(t => t.id === selected)?.company_id)?.name} onClose={() => { setSelected(null); refresh(); }} />}
  </div>;
}
function NewTicket({ open, onOpenChange, companies, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; companies: { id: string; name: string }[]; onCreated: (id: string) => void }) {
  const create = useServerFn(createSupportTicket); const upload = useServerFn(uploadSupportAttachment);
  const [busy, setBusy] = useState(false); const [file, setFile] = useState<File | null>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const values = new FormData(form); setBusy(true);
    try {
      const attachment = file ? await attachmentData(file) : null;
      const id = await create({ data: { subject: String(values.get('subject')), description: String(values.get('description')), category: String(values.get('category')) as typeof supportCategories[number], priority: String(values.get('priority')) as typeof supportPriorities[number], company_id: String(values.get('company') ?? '') || null } });
      if (attachment) { try { await upload({ data: { id, ...attachment } }); } catch (error) { toast.error('Ticket saved, but the attachment failed. Add it from the conversation.'); } }
      toast.success('Support ticket submitted.'); form.reset(); setFile(null); onCreated(id);
    } catch (error) { failure(error); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={v => { if (!busy) { onOpenChange(v); setFile(null); } }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Create New Ticket</DialogTitle><DialogDescription>Routiva Support</DialogDescription><form onSubmit={submit} className="space-y-4"><label className="grid gap-1 text-sm font-semibold">Subject<input name="subject" required maxLength={200} className={inputClass} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Category<select name="category" className={inputClass}>{supportCategories.map(c => <option key={c}>{c}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Priority<select name="priority" defaultValue="Medium" className={inputClass}>{supportPriorities.map(p => <option key={p}>{p}</option>)}</select></label></div>{companies.length > 0 && <label className="grid gap-1 text-sm font-semibold">Company<select name="company" required className={inputClass}>{companies.length > 1 && <option value="">Choose company</option>}{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<label className="grid gap-1 text-sm font-semibold">Detailed problem description<textarea name="description" required maxLength={10000} rows={6} className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Screenshot / attachment<input type="file" accept="image/png,image/jpeg,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm font-normal" /></label><Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />}Submit Ticket</Button></form></DialogContent></Dialog>;
}
function TicketDetail({ id, admin, companyName, onClose }: { id: string; admin: boolean; companyName?: string; onClose: () => void }) {
  const client = useQueryClient(); const fetch = useServerFn(getSupportTicket); const change = useServerFn(changeSupportTicket); const reply = useServerFn(replySupportTicket); const upload = useServerFn(uploadSupportAttachment); const download = useServerFn(downloadSupportAttachment);
  const query = useQuery({ queryKey: ['support-detail', id], queryFn: () => fetch({ data: { id } }) });
  const [body, setBody] = useState(''); const [privateNote, setPrivateNote] = useState(false); const [busy, setBusy] = useState(false); const [file, setFile] = useState<File | null>(null); const [fileKey, setFileKey] = useState(0);
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['support-detail', id] }); await client.invalidateQueries({ queryKey: ['support-list'] }); };
  const activity = query.data?.ticket;
  const latest = admin ? activity?.last_user_message_at : activity?.last_admin_message_at;
  useEffect(() => { if (!activity) return; void change({ data: { id, action: 'read', admin } }).then(() => client.invalidateQueries({ queryKey: ['support-list'] })).catch(failure); }, [id, admin, latest, Boolean(activity), change, client]);
  const update = async (action: 'status' | 'priority' | 'reopen', value?: string) => {
    setBusy(true); try {
      if (action === 'reopen') await change({ data: { id, action } });
      else if (action === 'status') await change({ data: { id, action, value: value as typeof supportStatuses[number] } });
      else await change({ data: { id, action, value: value as typeof supportPriorities[number] } });
      await refresh(); toast.success(action === 'reopen' ? 'Ticket reopened.' : 'Ticket updated.');
    } catch (error) { failure(error); } finally { setBusy(false); }
  };
  const send = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); try {
      const attachment = file ? await attachmentData(file) : null;
      const messageId = await reply({ data: { id, body, private: admin && privateNote } });
      setBody('');
      if (attachment) { try { await upload({ data: { id, message_id: messageId, ...attachment } }); setFile(null); setFileKey(k => k + 1); } catch (error) { toast.error('Reply saved; attachment failed.'); } }
      await refresh(); toast.success(privateNote ? 'Private note saved.' : 'Reply sent.');
    } catch (error) { failure(error); } finally { setBusy(false); }
  };
  const files = (messageId: string | null) => query.data?.attachments.filter(a => a.message_id === messageId).map(a => <Button key={a.id} variant="outline" className="max-w-full" title={a.filename} onClick={async () => { try { const result = await download({ data: { id: a.id } }); const anchor = document.createElement('a'); anchor.href = result.url; anchor.rel = 'noopener'; anchor.click(); } catch (error) { failure(error); } }}><Download className="size-4 shrink-0" /><span className="truncate">{a.filename}</span><span className="shrink-0 text-xs text-muted-foreground">{Math.ceil(a.size / 1024)} KB</span></Button>);
  const ticket = query.data?.ticket;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto p-5 sm:p-6"><DialogTitle>{ticket ? number(ticket.number) : 'Support Ticket'}</DialogTitle><DialogDescription>{ticket?.subject ?? 'Conversation'}</DialogDescription>{query.isPending ? <Loader2 className="animate-spin" /> : query.isError ? <p role="alert" className="text-destructive">Ticket not found or access denied.</p> : ticket && <>
    <div className="grid gap-5 border-y py-4 md:grid-cols-[1fr_240px]"><div className="min-w-0"><h2 className="break-words text-xl font-bold">{ticket.subject}</h2><p className="mt-2 text-sm text-muted-foreground">{ticket.user_name} · {ticket.user_email}</p><p className="text-sm text-muted-foreground">{companyName ?? 'No company'} · {ticket.category} · {date(ticket.created_at)} IST</p><p className="mt-4 whitespace-pre-wrap break-words">{ticket.description}</p><div className="mt-3 flex flex-wrap gap-2">{files(null)}</div></div><div className="space-y-3">{admin ? <fieldset disabled={busy} className="space-y-3"><Options label="Status" value={ticket.status} options={supportStatuses} onChange={v => void update('status', v)} /><Options label="Priority" value={ticket.priority} options={supportPriorities} onChange={v => void update('priority', v)} /></fieldset> : <><StatusBadge tone="blue">{ticket.status}</StatusBadge><p className="text-sm">Priority: {ticket.priority}</p>{canReopen(ticket.status) && <Button disabled={busy} variant="outline" onClick={() => void update('reopen')}><RotateCcw />Reopen Ticket</Button>}</>}</div></div>
    <h3 className="font-bold">Conversation</h3><div className="space-y-4">{query.data.messages.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}{query.data.messages.map(m => <div key={m.id} className={`border-l-2 py-2 pl-4 ${m.is_private ? 'border-warning bg-warning/5' : m.sender_role === 'admin' ? 'border-admin-blue bg-admin-blue/5' : 'border-border'}`}><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-semibold">{m.sender_name || (m.sender_role === 'admin' ? 'Support Admin' : 'User')}<StatusBadge tone={m.is_private ? 'orange' : 'gray'}>{m.is_private ? 'Private admin note' : m.sender_role === 'admin' ? 'Admin' : 'User'}</StatusBadge></span><time className="text-xs text-muted-foreground">{date(m.created_at)} IST</time></div><p className="mt-2 whitespace-pre-wrap break-words">{m.body}</p><div className="mt-2 flex flex-wrap gap-2">{files(m.id)}</div></div>)}</div>
    {admin || !canReopen(ticket.status) ? <form onSubmit={send} className="space-y-3 border-t pt-4"><label className="grid gap-2 text-sm font-semibold">{privateNote ? 'Private Admin Note' : 'Reply'}<textarea aria-label="Reply message" value={body} onChange={e => setBody(e.target.value)} rows={4} required maxLength={10000} className={inputClass} /></label><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-w-0 items-center gap-2 text-sm"><Paperclip className="size-4 shrink-0" /><input key={fileKey} type="file" aria-label="Reply attachment" accept="image/png,image/jpeg,application/pdf" className="min-w-0 max-w-64 text-xs" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>{admin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={privateNote} onChange={e => setPrivateNote(e.target.checked)} /><LockKeyhole className="size-4" />Private note</label>}<Button type="submit" disabled={busy || !body.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Send />}{privateNote ? 'Save Note' : 'Send Reply'}</Button></div></form> : null}
    <details className="border-t pt-3 text-sm"><summary className="cursor-pointer font-semibold">Ticket activity</summary><div className="mt-2 space-y-2 text-muted-foreground">{query.data.events.filter(e => e.action !== 'attachment').map(e => { const detail = e.detail as { before?: string; after?: string }; return <p key={e.id}>{e.action === 'status' || e.action === 'priority' ? `${e.action}: ${detail.before} → ${detail.after}` : e.action === 'create' ? 'Ticket opened' : e.action === 'reopen' ? 'Ticket reopened' : 'Reply sent'} · {date(e.created_at)} IST</p>; })}</div></details>
  </>}</DialogContent></Dialog>;
}
