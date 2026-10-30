import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { FeatureGate } from '@/components/workspace/FeatureGate';
import { OrgEmployees } from '@/components/workspace/OrgEmployees';
import { checkUserAccess, userCrmQuery } from '@/lib/user-crm-query';
import { userHead } from '@/lib/user-crm';

export const Route = createFileRoute('/_authenticated/employees')({
  errorComponent: WorkspaceAccessError,
  head: () => userHead('Employees', 'Create and manage your organization employees, roles and permissions in Routiva CRM.'),
  loader: async ({ context }) => { checkUserAccess(await context.queryClient.ensureQueryData(userCrmQuery)); },
  component: Page,
});

function Page() {
  return (
    <UserWorkspace>
      <FeatureGate feature="employees">
        <OrgEmployees />
      </FeatureGate>
    </UserWorkspace>
  );
}
