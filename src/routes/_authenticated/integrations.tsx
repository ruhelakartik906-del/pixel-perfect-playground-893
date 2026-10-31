import { createFileRoute } from '@tanstack/react-router';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { IntegrationMarketplace } from '@/components/workspace/IntegrationMarketplace';
import { checkUserAccess, userCrmQuery } from '@/lib/user-crm-query';
import { marketplaceQuery } from '@/lib/integration-marketplace.functions';
import { userHead } from '@/lib/user-crm';

export const Route = createFileRoute('/_authenticated/integrations')({
  head: () => userHead('Integrations Marketplace', 'Manage organization-owned WhatsApp, Meta Lead Ads, Google Calendar, Meet and Zoom connections.'),
  errorComponent: WorkspaceAccessError,
  loader: async ({ context }) => {
    const crm = await context.queryClient.ensureQueryData(userCrmQuery);
    checkUserAccess(crm);
    const first = crm.companies[0];
    if (first) await context.queryClient.ensureQueryData(marketplaceQuery(first.id));
    return crm.companies;
  },
  component: Page,
});
function Page() { const organizations = Route.useLoaderData(); return <UserWorkspace><IntegrationMarketplace organizations={organizations} /></UserWorkspace>; }