import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { FeatureGate } from '@/components/workspace/FeatureGate';
import { OrgWhatsAppConnection } from '@/components/workspace/OrgWhatsAppConnection';
import { checkUserAccess, userCrmQuery } from '@/lib/user-crm-query';
import { userHead } from '@/lib/user-crm';

export const Route = createFileRoute('/_authenticated/whatsapp/connection')({
  errorComponent: WorkspaceAccessError,
  head: () => userHead('WhatsApp Connection', "Connect and monitor your organization's own WhatsApp Business number in Routiva CRM."),
  loader: async ({ context }) => { checkUserAccess(await context.queryClient.ensureQueryData(userCrmQuery)); },
  component: Page,
});

function Page() {
  return (
    <UserWorkspace>
      <FeatureGate feature="whatsapp">
        <OrgWhatsAppConnection />
      </FeatureGate>
    </UserWorkspace>
  );
}
