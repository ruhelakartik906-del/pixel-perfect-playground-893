import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { authDestination } from '@/lib/auth-destination';
import { resetPasswordSchema } from '@/lib/auth-validation';

export const acceptEmployeeInvitation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => resetPasswordSchema.parse(v))
  .handler(async ({ context, data }) => {
    // Verify the recipient with Auth, not editable metadata or browser URL state.
    const user = await context.supabase.auth.getUser();
    const profile = await context.supabase.from('profiles').select('account_status').eq('id', context.userId).single();
    if (user.error || !user.data.user?.invited_at || !user.data.user.email_confirmed_at || profile.error || profile.data.account_status !== 'pending') {
      throw new Error('A verified pending invitation is required');
    }
    const password = await context.supabase.auth.updateUser({ password: data.password });
    if (password.error) throw new Error('The invitation password could not be saved');
    const accepted = await context.supabase.rpc('accept_employee_invitation');
    if (accepted.error || accepted.data !== context.userId) throw new Error('Invitation acceptance could not be completed');
    return { accepted: true };
  });

// The middleware revalidates the caller; no user ID or role is accepted from the browser.
export const resolveAuthAccess = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, roles] = await Promise.all([
      context.supabase.from('profiles').select('account_status').eq('id', context.userId).maybeSingle(),
      context.supabase.from('user_roles').select('role').eq('user_id', context.userId),
    ]);
    if (profile.error || roles.error) throw new Error('Your account access could not be verified. Please try again.');
    return { destination: authDestination(profile.data?.account_status, (roles.data ?? []).map(row => row.role)) };
  });