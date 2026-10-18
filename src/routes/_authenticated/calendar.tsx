import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { UserCalendar } from '@/components/workspace/UserCalendar';
import { phase2Query } from '@/lib/user-phase2-query';
import { userHead } from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/calendar')({
 errorComponent: WorkspaceAccessError,head:()=>userHead('My Calendar','Authorized tasks, follow-ups and meetings together in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(phase2Query),component:UserCalendar});
