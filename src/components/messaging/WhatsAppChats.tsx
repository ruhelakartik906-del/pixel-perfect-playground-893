import { useState,useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { inboxAction } from '@/lib/whatsapp-inbox.functions';
import { useServerFn } from '@tanstack/react-start';
import { sendInboxMessage } from '@/lib/whatsapp-inbox.functions';
import { InboxConversationTools } from './InboxConversationTools';
import { myOrgWhatsApp } from '@/lib/org-whatsapp.functions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { whatsAppQuery } from '@/lib/messaging-query';
import { loadWhatsAppHistory, getWhatsAppConnectionStatus, addWhatsAppContact } from '@/lib/messaging.functions';
import { WhatsAppWebChat, type WaConversation, type WaChatMessage, type WaContactForm } from '@/components/messaging/WhatsAppWebChat';

export function WhatsAppChats() {
  const send=useServerFn(sendInboxMessage),action=useServerFn(inboxAction);
  const qc = useQueryClient();
  const { data: d, isPending, error } = useQuery(whatsAppQuery);
  const connection = useQuery({ queryKey: ['wa-connection-status'], queryFn: () => getWhatsAppConnectionStatus(), staleTime: 30000 });
  const [openSignal, setOpenSignal] = useState(0);
  const [selected, setSelected] = useState('');
  const history = useQuery({ queryKey: ['wa-authorized-history', selected], queryFn: () => loadWhatsAppHistory({ data: { id: selected } }), enabled: !!selected });

  const conversations: WaConversation[] = (d?.conversations ?? []).map((c) => {
    const lead = d?.leads.find((l) => l.id === c.lead_id || l.phone.replace(/\D/g, '') === c.wa_phone.replace(/\D/g, ''));
    return { id: c.id, name: c.contact_name || c.provider_phone || c.wa_phone, phone: c.provider_phone || c.wa_phone, at: c.last_message_at, unread: c.unread_count, kind: 'contact', leadTo: lead ? '/my-leads' : undefined, leadLabel: lead?.customer_name };
  });
  const messages: WaChatMessage[] = (history.data ?? []).map((m) => ({ id: m.id, direction: m.direction === 'outbound' ? 'outbound' : 'inbound', body: m.body||(m.message_type!=='text'?`[${m.message_type}${m.media_filename?`: ${m.media_filename}`:''}]`:''), at: m.created_at, status: m.status }));
  const active=d?.conversations.find(c=>c.id===selected);
  const orgConnection=useQuery({queryKey:['wa-inbox-connection',active?.company_id],queryFn:()=>myOrgWhatsApp({data:{company_id:active?.company_id??''}}),enabled:Boolean(active?.company_id)});
  const connected = orgConnection.data?.connections.some(c=>c.id===active?.connection_id&&c.status==='connected'&&c.token_ok&&c.webhook_subscribed)===true;
  useEffect(()=>{const channel=supabase.channel(`wa-inbox-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'whatsapp_conversations'},()=>{void qc.invalidateQueries({queryKey:whatsAppQuery.queryKey});}).on('postgres_changes',{event:'*',schema:'public',table:'whatsapp_messages'},()=>{void qc.invalidateQueries({queryKey:['wa-authorized-history',selected]});}).subscribe();return ()=>{void supabase.removeChannel(channel);};},[qc,selected]);

  const checkConnection = async () => {
    const r = await connection.refetch();
    return r.data?.connected === true;
  };

  const addContact = async (input: WaContactForm) => {
    const id = await addWhatsAppContact({ data: input });
    await qc.invalidateQueries({ queryKey: whatsAppQuery.queryKey });
    if (typeof id === 'string') setSelected(id);
  };

  return (
    <UserWorkspace>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Chats</h1>
          <p className={connected ? 'mt-1 text-sm text-wa-green-deep' : 'mt-1 text-sm text-warning'}>
            {connected ? `Connected · ${orgConnection.data?.connections.find(c=>c.id===active?.connection_id)?.display_phone_number??'business number'}` : 'Select an authorized conversation or connect your organization’s number'}
          </p>
        </div>
        {connected ? (
          <Button onClick={() => setOpenSignal((n) => n + 1)} className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90"><Plus className="size-4" />Add Number</Button>
        ) : (
          <Button asChild variant="outline" className="border-wa-green-deep/40 text-wa-green-deep hover:bg-wa-bubble"><Link to="/whatsapp/connection"><ShieldCheck className="size-4" />Connect WhatsApp Business</Link></Button>
        )}
      </div>
      {active?.connection_id&&active.company_id&&<InboxConversationTools key={active.id} id={active.id} status={active.inbox_status} takeover={active.human_takeover} companyId={active.company_id} assignedTo={active.assigned_to}/>}
      <WhatsAppWebChat
        me={{ name: 'Me', role: 'User' }}
        conversations={conversations}
        connected={connected}
        connectedPhone={connection.data?.phone}
        loading={isPending}
        error={error ? error.message : null}
        selectedId={selected}
        onSelect={(id)=>{setSelected(id);if(d?.conversations.find(c=>c.id===id)?.connection_id)void action({data:{id,action:'read',payload:{}}}).then(()=>qc.invalidateQueries({queryKey:whatsAppQuery.queryKey})).catch(()=>toast.error('Unread count could not be updated'));}}
        messages={messages}
        messagesLoading={history.isPending}
        messagesError={history.error ? 'History could not be loaded' : null}
        emptyNote={!d?.permissions['whatsapp.view'] ? 'No authorized conversations — chats appear here once a verified business number is assigned to you.' : 'No chats yet. Add a client number to start.'}
        className="h-[calc(100vh-16rem)] min-h-[540px]"
        onCheckConnection={checkConnection}
        openSignal={openSignal}
        checkingConnection={connection.isFetching}
        onAddContact={addContact}
        onSend={active?.connection_id?async(body)=>{await send({data:{id:selected,client_id:crypto.randomUUID(),body,type:'text'}});await qc.invalidateQueries({queryKey:['wa-authorized-history',selected]});await qc.invalidateQueries({queryKey:whatsAppQuery.queryKey});}:undefined}
      />
    </UserWorkspace>
  );
}
