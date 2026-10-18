import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { MyWorkTable } from '@/components/workspace/MyWorkTable';
import { phase2Query } from '@/lib/user-phase2-query';
import { userHead } from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/my-work-table')({
 errorComponent: WorkspaceAccessError,head:()=>userHead('My Work Table','Private custom work tables and authorized CRM links in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(phase2Query),component:MyWorkTable});
