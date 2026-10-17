import { queryOptions } from '@tanstack/react-query';
import { loadMessaging,loadUserWhatsApp } from './messaging.functions';
export const chatQuery=queryOptions({queryKey:['shared-team-chat'],queryFn:()=>loadMessaging(),staleTime:10000,refetchInterval:30000});
export const whatsAppQuery=queryOptions({queryKey:['user-whatsapp'],queryFn:()=>loadUserWhatsApp(),staleTime:10000});
