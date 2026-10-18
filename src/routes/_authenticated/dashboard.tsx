import { createFileRoute } from '@tanstack/react-router';
import { UserDashboard } from '@/components/workspace/UserDashboard';
import { checkUserAccess, userCrmQuery } from '@/lib/user-crm-query';
import { userHead } from '@/lib/user-crm';
export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => userHead('My Dashboard', 'Your assigned leads, active deals, tasks and follow-ups in Routiva CRM.'),
  loader: async ({ context }) => { const data = await context.queryClient.ensureQueryData(userCrmQuery); checkUserAccess(data, { personal: true }); },
  component: UserDashboard,
});
