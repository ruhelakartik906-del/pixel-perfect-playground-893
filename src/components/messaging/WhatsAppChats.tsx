import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { whatsAppQuery } from '@/lib/messaging-query';
import { loadWhatsAppHistory } from '@/lib/messaging.functions';
import { WhatsAppWebChat, type WaConversation, type WaChatMessage } from '@/components/messaging/WhatsAppWebChat';

export function WhatsAppChats() {
  const { data: d, isPending, error } = useQuery(whatsAppQuery);
  const [setup, setSetup] = useState(false);
  const [selected, setSelected] = useState('');
  const history = useQuery({ queryKey: ['wa-authorized-history', selected], queryFn: () => loadWhatsAppHistory({ data: { id: selected } }), enabled: !!selected });

  const conversations: WaConversation[] = (d?.conversations ?? []).map((c) => {
    const lead = d?.leads.find((l) => l.id === c.lead_id || l.phone.replace(/\D/g, '') === c.wa_phone.replace(/\D/g, ''));
    return { id: c.id, name: c.contact_name || c.wa_phone, phone: c.wa_phone, at: c.last_message_at, unread: c.unread_count, kind: 'contact', leadTo: lead ? '/my-leads' : undefined, leadLabel: lead?.customer_name };
  });
  const messages: WaChatMessage[] = (history.data ?? []).map((m) => ({ id: m.id, direction: m.direction === 'outbound' ? 'outbound' : 'inbound', body: m.body, at: m.created_at, status: m.status }));

  return (
    <UserWorkspace>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Chats</h1>
          <p className="mt-1 text-sm text-warning">Not Connected · demo preview below</p>
        </div>
        <Button variant="outline" onClick={() => setSetup(true)}><ShieldCheck />Connect WhatsApp Business</Button>
      </div>
      <WhatsAppWebChat
        me={{ name: 'Me', role: 'User' }}
        conversations={conversations}
        connected={false}
        loading={isPending}
        error={error ? error.message : null}
        selectedId={selected}
        onSelect={setSelected}
        messages={messages}
        messagesLoading={history.isPending}
        messagesError={history.error ? 'History could not be loaded' : null}
        emptyNote={!d?.permissions['whatsapp.view'] ? 'No authorized conversations — chats appear here once a verified business number is assigned to you.' : 'No authorized conversations'}
        className="h-[calc(100vh-16rem)] min-h-[540px]"
      />
      <Dialog open={setup} onOpenChange={setSetup}>
        <DialogContent>
          <DialogHeader><DialogTitle>Official WhatsApp Business Setup</DialogTitle></DialogHeader>
          <p className="text-sm font-semibold text-warning">Not Connected · Setup required</p>
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold">Missing in this app</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>A verified WhatsApp Business connection and assigned business number</li>
              <li>A configured sending service and signed incoming-message receiver</li>
              <li>Verified delivery-status tracking and Meta template approval sync</li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold">Administrator setup requirements</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Connect an official WhatsApp Business account in Lovable Connectors; complete Meta business, email and phone verification</li>
              <li>Use a registered business phone number with authorized messaging and template-management permissions</li>
              <li>Configure and deploy the signed receiver, then select this project under the connection’s Incoming messages setting</li>
              <li>Assign company access and check customer consent before enabling sending</li>
              <li>Free-form replies require a customer message within 24 hours; otherwise use a Meta-approved template</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">This button shows requirements only; it does not connect your number. Personal WhatsApp OTP or QR login is not supported. Local template drafts are not Meta-approved messages.</p>
          <Button asChild variant="outline"><Link to="/whatsapp/templates">WhatsApp Templates</Link></Button>
        </DialogContent>
      </Dialog>
    </UserWorkspace>
  );
}
