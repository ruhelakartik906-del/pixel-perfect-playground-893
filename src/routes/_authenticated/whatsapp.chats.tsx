import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { WhatsAppChats } from '@/components/messaging/WhatsAppChats';
import { FeatureGate } from '@/components/workspace/FeatureGate';
import { whatsAppQuery } from '@/lib/messaging-query';
import { userHead } from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/whatsapp/chats')({
 errorComponent: WorkspaceAccessError,head:()=>userHead('WhatsApp Chats','Authorized business conversations and official connection status in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(whatsAppQuery),component:WhatsAppChats});
