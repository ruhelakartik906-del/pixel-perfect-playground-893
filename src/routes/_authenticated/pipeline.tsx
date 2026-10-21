import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { MyLeads } from '@/components/workspace/MyLeads';
import { checkUserAccess,userCrmQuery } from '@/lib/user-crm-query';
import { userHead } from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/pipeline')({errorComponent:WorkspaceAccessError,head:()=>userHead('Pipeline','Manage assigned leads through saved pipeline stages in Routiva CRM.'),loader:async({context})=>checkUserAccess(await context.queryClient.ensureQueryData(userCrmQuery)),component:MyLeads});
