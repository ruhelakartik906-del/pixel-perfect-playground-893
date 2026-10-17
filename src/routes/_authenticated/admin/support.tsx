import { createFileRoute } from '@tanstack/react-router';
import { SupportPage, supportQuery } from '@/components/support/SupportPage';
import { adminHead } from '@/lib/admin-head';
export const Route = createFileRoute('/_authenticated/admin/support')({
  head: () => adminHead('Support Ticket Management', 'Manage Routiva support tickets and private customer conversations.'),
  loader: ({ context }) => context.isAdmin ? context.queryClient.ensureQueryData(supportQuery(true)) : undefined,
  component: AdminSupport,
});
function AdminSupport() { return <SupportPage admin />; }
