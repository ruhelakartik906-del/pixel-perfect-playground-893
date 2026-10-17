import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { adminProfileSchema, businessSettingsSchema, credentialChangeSchema, settingsAdminAllowed } from './settings-validation';

type Context = { supabase: import('@supabase/supabase-js').SupabaseClient<import('@/integrations/supabase/types').Database>; userId: string };
async function authorize(context: Context) {
  const [role, profile] = await Promise.all([
    context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' }),
    context.supabase.from('profiles').select('*').eq('id', context.userId).single(),
  ]);
  if (role.error || profile.error || !profile.data || !settingsAdminAllowed(role.data === true, profile.data.account_status)) throw new Error('Active Super Admin authorization required');
  return profile.data;
}
export const getAdminAccount = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const profile = await authorize(context);
  const token = getRequest().headers.get('authorization')?.replace(/^Bearer /, '');
  const { data, error } = await context.supabase.auth.getUser(token);
  if (error || !data.user || data.user.id !== context.userId) throw new Error('Please sign in again');
  return { ...profile, email: data.user.email ?? '', pending_email: data.user.new_email ?? '', phone_verified: Boolean(data.user.phone && data.user.phone === profile.phone && data.user.phone_confirmed_at) };
});
export const saveAdminProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => adminProfileSchema.parse(input)).handler(async ({ context, data }) => {
  await authorize(context);
  const r = await context.supabase.from('profiles').update({ ...data, updated_at: new Date().toISOString() }).eq('id', context.userId).select('id').single();
  if (r.error) throw new Error('Your profile could not be saved. Please try again.');
  return { ok: true };
});
export const getBusinessSettings = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await authorize(context);
  const r = await context.supabase.from('sales_settings').select('*').maybeSingle();
  if (r.error) throw new Error('Business settings could not be loaded');
  return r.data;
});
export const saveBusinessSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => businessSettingsSchema.parse(input)).handler(async ({ context, data }) => {
  await authorize(context);
  const r = await context.supabase.rpc('save_business_settings', { _payload: data });
  if (r.error) throw new Error('Business settings could not be saved. Check your values and try again.');
  return { ok: true };
});
export const changeAdminCredentials = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => credentialChangeSchema.parse(input)).handler(async ({ context, data }) => {
  await authorize(context);
  const request = getRequest();
  const auth = request.headers.get('authorization');
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!auth || !url || !key) throw new Error('Please sign in again');
  const { data: identity, error } = await context.supabase.auth.getUser(auth.replace(/^Bearer /, ''));
  if (error || !identity.user?.email || identity.user.id !== context.userId) throw new Error('Please sign in again');
  if (data.kind === 'email') {
    const origin = request.headers.get('origin');
    const redirect = new URL(data.redirect_to);
    if (!origin || redirect.origin !== origin || redirect.pathname !== '/admin/login' || redirect.search || redirect.hash) throw new Error('Invalid verification return address');
    if (data.email.toLowerCase() === identity.user.email.toLowerCase()) throw new Error('Enter a different login email');
  }
  // Reauthenticate without storing or returning the temporary session. No admin key is used.
  const reauth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identity.user.email, password: data.current_password }),
  });
  if (!reauth.ok) throw new Error('Current password could not be verified. Please try again.');
  const verified = await reauth.json() as { user?: { id?: string } };
  if (verified.user?.id !== context.userId) throw new Error('Account verification failed');
  const redirect = data.kind === 'email' ? `?redirect_to=${encodeURIComponent(data.redirect_to)}` : '';
  const response = await fetch(`${url}/auth/v1/user${redirect}`, {
    method: 'PUT', headers: { apikey: key, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(data.kind === 'email' ? { email: data.email } : { password: data.password, current_password: data.current_password }),
  });
  if (!response.ok) {
    const result = await response.json() as { code?: string };
    if (result.code === 'over_email_send_rate_limit') throw new Error('Email limit reached. Please wait before trying again.');
    if (result.code === 'reauthentication_needed') throw new Error('Please sign out and sign in again before changing your credentials.');
    if (result.code === 'weak_password') throw new Error('Choose a stronger password.');
    throw new Error('The credential change could not be completed. Please try again.');
  }
  return { ok: true, kind: data.kind };
});