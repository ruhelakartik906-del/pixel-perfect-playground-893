import { createFileRoute } from '@tanstack/react-router';
import { WhatsAppChats } from '@/components/messaging/WhatsAppChats';
import { whatsAppQuery } from '@/lib/messaging-query';
import { userHead } from '@/lib/user-phase2-query';
export const Route=createFileRoute('/_authenticated/whatsapp/chats')({head:()=>userHead('WhatsApp Chats','Authorized business conversations and official connection status in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(whatsAppQuery),component:WhatsAppChats});
