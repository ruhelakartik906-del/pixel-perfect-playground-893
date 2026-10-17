import { createFileRoute } from '@tanstack/react-router';
import { MyLeads } from '@/components/workspace/MyLeads';
import { checkUserAccess, userCrmQuery } from '@/lib/user-crm-query';
import { userHead } from '@/lib/user-crm';
export const Route = createFileRoute('/_authenticated/my-leads')({
  head: () => userHead('My Leads', 'Manage assigned customer enquiries, lead stages, notes and follow-ups in Routiva CRM.'),
  loader: async ({ context }) => { const data = await context.queryClient.ensureQueryData(userCrmQuery); checkUserAccess(data); },
  component: MyLeads,
});