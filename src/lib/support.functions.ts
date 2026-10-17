import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ticketSchema, replySchema, supportStatuses, supportPriorities, validateSupportFile } from './support-model';
import type { Json } from '@/integrations/supabase/types';

const idSchema = z.object({ id: z.string().uuid() }).strict();
export const getSupportWorkspace = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ admin: z.boolean(), search: z.string().max(200).default(''), status: z.string().default(''), priority: z.string().default(''), category: z.string().default(''), company: z.string().default(''), page: z.number().int().min(0).default(0), oldest: z.boolean().default(false) }).strict().parse(input)).handler(async ({ context, data }) => {
  const db = context.supabase;
  const role = await db.rpc('support_admin');
  if (data.admin && role.data !== true) throw new Error('Super Admin access required.');
  const companies = data.admin ? await db.from('companies').select('id,name').order('name') : await db.from('company_members').select('company_id,companies(id,name)').eq('user_id', context.userId);
  if (companies.error) throw new Error('Company list could not be loaded.');
  const scope = () => { const query = db.from('support_tickets').select('*', { count: 'exact' }); return data.admin ? query : query.eq('user_id', context.userId); };
  let query = scope();
  const term = data.search.replace(/[,%()\\]/g, ' ').trim();
  if (term) {
    const number = term.replace(/^RT-/i, '');
    const numberFilter = /^\d+$/.test(number) ? `,number.eq.${number}` : '';
    query = query.or(`subject.ilike.%${term}%,user_name.ilike.%${term}%,user_email.ilike.%${term}%${numberFilter}`);
  }
  if (data.status) query = query.eq('status', data.status);
  if (data.priority) query = query.eq('priority', data.priority);
  if (data.category) query = query.eq('category', data.category);
  if (data.company) query = query.eq('company_id', data.company);
  const rows = await query.order('created_at', { ascending: data.oldest }).order('id').range(data.page * 20, data.page * 20 + 19);
  if (rows.error) throw new Error('Tickets could not be loaded.');
  const counts = await Promise.all(['Total', 'Open', 'In Progress', 'Resolved', 'Closed'].map(async status => {
    let q = db.from('support_tickets').select('id', { count: 'exact', head: true });
    if (!data.admin) q = q.eq('user_id', context.userId);
    if (status !== 'Total') q = q.eq('status', status);
    const r = await q; if (r.error) throw new Error('Ticket counts could not be loaded.'); return [status, r.count ?? 0] as const;
  }));
  const choices = data.admin ? companies.data as { id: string; name: string }[] : (companies.data as unknown as { companies: { id: string; name: string } | null }[]).flatMap(c => c.companies ? [c.companies] : []);
  return { tickets: rows.data, count: rows.count ?? 0, counts: Object.fromEntries(counts), companies: choices, userId: context.userId };
});
export const getSupportTicket = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid(), admin: z.boolean() }).strict().parse(input)).handler(async ({ context, data }) => {
  if (data.admin && (await context.supabase.rpc('support_admin')).data !== true) throw new Error('Super Admin access required.');
  const ticket = await context.supabase.from('support_tickets').select('*').eq('id', data.id).single();
  if (ticket.error) throw new Error('Ticket not found or access denied.');
  if (!data.admin && ticket.data.user_id !== context.userId) throw new Error('Ticket access denied.');
  const [messages, attachments, events] = await Promise.all([
    context.supabase.from('support_messages').select('*').eq('ticket_id', data.id).order('created_at').order('id'),
    context.supabase.from('support_attachments').select('*').eq('ticket_id', data.id).order('created_at'),
    context.supabase.from('support_ticket_events').select('*').eq('ticket_id', data.id).order('created_at'),
  ]);
  if (messages.error || attachments.error || events.error) throw new Error('Conversation could not be loaded.');
  const visibleMessages = data.admin ? messages.data : messages.data.filter(m => !m.is_private);
  const visibleIds = new Set(visibleMessages.map(m => m.id));
  return { ticket: ticket.data, messages: visibleMessages, attachments: attachments.data.filter(a => !a.message_id || visibleIds.has(a.message_id)), events: events.data };
});
export const createSupportTicket = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => ticketSchema.parse(input)).handler(async ({ context, data }) => {
  const r = await context.supabase.rpc('support_action', { _action: 'create', _payload: data as Json });
  if (r.error) throw new Error(r.error.message); return r.data;
});
export const replySupportTicket = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => replySchema.parse(input)).handler(async ({ context, data }) => {
  const r = await context.supabase.rpc('support_action', { _action: 'reply', _payload: data as Json });
  if (r.error) throw new Error(r.error.message); return r.data;
});
export const changeSupportTicket = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.discriminatedUnion('action', [
  z.object({ id: z.string().uuid(), action: z.literal('status'), value: z.enum(supportStatuses) }).strict(),
  z.object({ id: z.string().uuid(), action: z.literal('priority'), value: z.enum(supportPriorities) }).strict(),
  z.object({ id: z.string().uuid(), action: z.literal('reopen') }).strict(),
  z.object({ id: z.string().uuid(), action: z.literal('read'), admin: z.boolean() }).strict(),
]).parse(input)).handler(async ({ context, data }) => {
  const r = await context.supabase.rpc('support_action', { _action: data.action, _payload: data as Json });
  if (r.error) throw new Error(r.error.message); return r.data;
});
export const uploadSupportAttachment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid(), message_id: z.string().uuid().optional(), filename: z.string().min(1).max(200), mime: z.string().max(100), base64: z.string().max(7000000) }).strict().parse(input)).handler(async ({ context, data }) => {
  const ticket = await context.supabase.from('support_tickets').select('id').eq('id', data.id).single();
  if (ticket.error) throw new Error('Attachment access denied.');
  if (data.message_id) {
    const message = await context.supabase.from('support_messages').select('id').eq('id', data.message_id).eq('ticket_id', data.id).eq('sender_id', context.userId).single();
    if (message.error) throw new Error('Message access denied.');
  }
  const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0)); validateSupportFile(bytes, data.mime);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const path = `${data.id}/${crypto.randomUUID()}/${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const upload = await supabaseAdmin.storage.from('support-private-files').upload(path, bytes, { contentType: data.mime, upsert: false });
  if (upload.error) throw new Error('Attachment upload failed.');
  const record = await context.supabase.rpc('support_action', { _action: 'attachment', _payload: { id: data.id, message_id: data.message_id, filename: data.filename, path, mime: data.mime, size: bytes.length } as Json });
  if (record.error) { await supabaseAdmin.storage.from('support-private-files').remove([path]); throw new Error('Attachment could not be saved.'); }
  return record.data;
});
export const downloadSupportAttachment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => idSchema.parse(input)).handler(async ({ context, data }) => {
  const record = await context.supabase.from('support_attachments').select('path,filename').eq('id', data.id).single();
  if (record.error) throw new Error('Attachment not found or access denied.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const signed = await supabaseAdmin.storage.from('support-private-files').createSignedUrl(record.data.path, 60, { download: record.data.filename });
  if (signed.error) throw new Error('Download could not be authorized.');
  const url = new URL(signed.data.signedUrl); const browser = new URL(import.meta.env['VITE_SUPABASE_URL']); url.protocol = browser.protocol; url.host = browser.host;
  return { url: url.toString() };
});
