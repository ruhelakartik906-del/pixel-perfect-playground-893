import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { WhatsAppTemplates } from '@/components/messaging/WhatsAppTemplates';
import { FeatureGate } from '@/components/workspace/FeatureGate';
import { whatsAppQuery } from '@/lib/messaging-query';
import { userHead } from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/whatsapp/templates')({
 errorComponent: WorkspaceAccessError,head:()=>userHead('WhatsApp Templates','Permission-scoped shared WhatsApp drafts and provider approval status in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(whatsAppQuery),component:WhatsAppTemplates});
