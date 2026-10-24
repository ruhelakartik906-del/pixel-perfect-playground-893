import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { installationSchema, installationChangeSchema } from './crm-installations';
import { readAllPages } from './backend-read';

type Context = { supabase: import('@supabase/supabase-js').SupabaseClient<import('@/integrations/supabase/types').Database>; userId: string };
async function authorize(context: Context) {
  const result = await context.supabase.rpc('routing_admin');
  if (result.error || result.data !== true) throw new Error('Active Super Admin authorization required');
}
export const listCrmInstallations = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await authorize(context);
  return readAllPages((start,end) => context.supabase.from('crm_installations').select('*').order('created_at').order('id').range(start,end));
});
export const createCrmInstallation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => installationSchema.parse(input)).handler(async ({ context, data }) => {
  await authorize(context);
  const origin = new URL(data.crm_url).hostname;
  if (['pixel-perfect-playground-893.lovable.app','app.hatflow.in','hatflow.in'].includes(origin) || origin.endsWith('.lovable.app') && origin.startsWith('id-preview--')) throw new Error('Use a separate customer installation, not this CRM or the legacy app');
  const result = await context.supabase.rpc('crm_installation_action', { _action: 'create', _payload: data });
  if (result.error) throw new Error(result.error.code === '23505' ? 'An installation already uses this email or CRM address' : 'Installation could not be saved. Check the details and try again.');
  return result.data;
});
export const installationAudit = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  await authorize(context);
  const result = await context.supabase.from('crm_installation_audit').select('*').eq('installation_id', data.id).order('created_at',{ascending:false}).limit(100);
  if (result.error) throw new Error('Audit history could not be loaded');
  return result.data;
});
export const changeCrmInstallation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => installationChangeSchema.parse(input)).handler(async ({ context, data }) => {
  await authorize(context);
  if (data.action !== 'extend') throw new Error('Setup Required: customer provisioning and license enforcement are not configured. No access was changed.');
  const result = await context.supabase.rpc('crm_installation_action', { _action: data.action, _payload: data });
  if (result.error) throw new Error('Validity could not be updated. Refresh the installation and try again.');
  return result.data;
});