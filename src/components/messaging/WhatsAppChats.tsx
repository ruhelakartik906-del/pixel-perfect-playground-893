import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { sendInboxMessage } from '@/lib/whatsapp-inbox.functions';
import { InboxConversationTools } from './InboxConversationTools';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { whatsAppQuery } from '@/lib/messaging-query';
import { loadWhatsAppHistory, getWhatsAppConnectionStatus, addWhatsAppContact } from '@/lib/messaging.functions';
import { WhatsAppWebChat, type WaConversation, type WaChatMessage, type WaContactForm } from '@/components/messaging/WhatsAppWebChat';

export function WhatsAppChats() {
  const send=useServerFn(sendInboxMessage);
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
  const messages: WaChatMessage[] = (history.data ?? []).map((m) => ({ id: m.id, direction: m.direction === 'outbound' ? 'outbound' : 'inbound', body: m.body, at: m.created_at, status: m.status }));
  const active=d?.conversations.find(c=>c.id===selected);
  const connected = Boolean(active?.connection_id);

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
            {connected ? `Connected · ${connection.data?.phone ?? 'business number'}` : 'Not Connected · contacts and previews only'}
          </p>
        </div>
        {connected ? (
          <Button onClick={() => setOpenSignal((n) => n + 1)} className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90"><Plus className="size-4" />Add Number</Button>
        ) : (
          <Button variant="outline" onClick={() => setOpenSignal((n) => n + 1)} className="border-wa-green-deep/40 text-wa-green-deep hover:bg-wa-bubble"><ShieldCheck className="size-4" />Connect WhatsApp Business</Button>
        )}
      </div>
      {active?.connection_id&&<InboxConversationTools id={active.id} status={active.inbox_status} takeover={active.human_takeover}/>}
      <WhatsAppWebChat
        me={{ name: 'Me', role: 'User' }}
        conversations={conversations}
        connected={connected}
        connectedPhone={connection.data?.phone}
        loading={isPending}
        error={error ? error.message : null}
        selectedId={selected}
        onSelect={setSelected}
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
