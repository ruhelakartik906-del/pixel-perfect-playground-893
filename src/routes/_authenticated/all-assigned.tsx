import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { AllAssigned } from '@/components/workspace/AllAssigned';
import { FeatureGate } from '@/components/workspace/FeatureGate';
import { checkUserAccess, userCrmQuery } from '@/lib/user-crm-query';
import { userHead } from '@/lib/user-crm';
export const Route = createFileRoute('/_authenticated/all-assigned')({
  errorComponent: WorkspaceAccessError,
  head: () => userHead('All Assigned', 'Review leads routed to you and move them to your Leads Board in Routiva CRM.'),
  loader: async ({ context }) => { checkUserAccess(await context.queryClient.ensureQueryData(userCrmQuery)); },
  component: Page,
});
function Page() { return <FeatureGate feature="leads"><AllAssigned /></FeatureGate>; }
