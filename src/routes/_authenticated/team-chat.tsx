import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { TeamChat } from '@/components/messaging/TeamChat';
import { chatQuery } from '@/lib/messaging-query';
import { userHead } from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/team-chat')({
 errorComponent: WorkspaceAccessError,head:()=>userHead('Team Chat','Private authorized team conversations in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(chatQuery),component:TeamChat});
