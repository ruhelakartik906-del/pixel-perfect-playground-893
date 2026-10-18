import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { hashMakeCredential, managedSourceSchema } from './make-management';

async function requireAdmin(db: { rpc: (name: 'routing_admin') => PromiseLike<{ data: unknown; error: unknown }> }) {
  const result = await db.rpc('routing_admin');
  if (result.error || !result.data) throw new Error('Active Super Admin authorization required');
}

export const loadMakeManagement = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context.supabase);
  const { importMakeBootstrap } = await import('./make-management.server');
  const db = await importMakeBootstrap();
  async function all(table: 'make_lead_sources' | 'companies' | 'ad_routing_rules' | 'ad_routing_steps') {
    const rows: any[] = [];
    for (let start = 0; ; start += 1000) {
      const result = await db.from(table).select('*').order('id').range(start, start + 999);
      if (result.error) throw new Error('Make.com configuration unavailable');
      rows.push(...result.data);
      if (result.data.length < 1000) return rows;
    }
  }
  const [keys, sources, companies, rules, steps, logs, created, duplicate, rejected, last] = await Promise.all([
    db.from('make_api_keys').select('id,label,created_at,last_used_at,revoked_at').order('created_at', { ascending: false }),
    all('make_lead_sources'), all('companies'), all('ad_routing_rules'), all('ad_routing_steps'),
    db.from('make_intake_logs').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('make_intake_logs').select('id', { count: 'exact', head: true }).eq('status', 'created'),
    db.from('make_intake_logs').select('id', { count: 'exact', head: true }).eq('status', 'duplicate'),
    db.from('make_intake_logs').select('id', { count: 'exact', head: true }).in('status', ['rejected', 'error']),
    db.from('make_intake_logs').select('created_at,is_test,status').in('status', ['created','duplicate','validated']).order('created_at', { ascending: false }).limit(1),
  ]);
  if ([keys, logs, created, duplicate, rejected, last].some(r => r.error)) throw new Error('Make.com activity unavailable');
  return { keys: keys.data ?? [], sources, companies: companies.filter(c => c.is_active), rules: rules.filter(r => r.status !== 'deleted'), steps, logs: logs.data ?? [], counts: { created: created.count ?? 0, duplicate: duplicate.count ?? 0, rejected: rejected.count ?? 0 }, lastSuccess: last.data?.[0] ?? null };
});

export const generateMakeKey = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ label: z.string().trim().min(1).max(100) }).strict().parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase);
    const { importMakeBootstrap } = await import('./make-management.server');
    const db = await importMakeBootstrap();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = 'rtv_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const key_hash = await hashMakeCredential(key);
    const result = await db.from('make_api_keys').insert({ label: data.label, key_hash, created_by: context.userId }).select('id').single();
    if (result.error) throw new Error('Key could not be generated');
    return { id: result.data.id, key };
  });

export const revokeMakeKey = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase);
    const { makeAdminClient } = await import('./make-management.server');
    const db = await makeAdminClient();
    const result = await db.from('make_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', data.id).is('revoked_at', null).select('id').maybeSingle();
    if (result.error || !result.data) throw new Error('Active key unavailable');
    return { revoked: true };
  });

export const saveMakeSource = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => managedSourceSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase);
    const result = await context.supabase.rpc('make_source_action', { _action: 'save', _payload: data });
    if (result.error) throw new Error('Source could not be saved; check company, matching rule and unique source IDs');
    return result.data;
  });

export const changeMakeSource = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), action: z.enum(['enable','disable','archive']) }).strict().parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase);
    const result = await context.supabase.rpc('make_source_action', { _action: data.action, _payload: { id: data.id } });
    if (result.error) throw new Error('Source could not be changed');
    return result.data;
  });

export type MakeManagementData = Awaited<ReturnType<typeof loadMakeManagement>>;