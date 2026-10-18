import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { authDestination } from '@/lib/auth-destination';

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