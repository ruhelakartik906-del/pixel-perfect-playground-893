import { queryOptions } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { loadUserCrm } from '@/lib/user-crm.functions';
export const userCrmQuery = queryOptions({ queryKey: ['user-crm'], queryFn: () => loadUserCrm(), staleTime: 15_000, refetchInterval: 30_000, refetchOnWindowFocus: true });
export function checkUserAccess(data: Awaited<ReturnType<typeof loadUserCrm>>) {
  if (data.profile.account_status === 'blocked') throw redirect({ to: '/restricted', replace: true });
  if (data.profile.account_status !== 'active') throw redirect({ to: '/pending-approval', replace: true });
  if (!data.allowed) throw new Error('Your account does not have CRM access. Contact your administrator.');
}