import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Calendar, Facebook, MessageCircle, Plug, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { marketplaceQuery } from '@/lib/integration-marketplace.functions';
import type { ProviderId } from '@/lib/integration-marketplace';

const icons = { whatsapp: MessageCircle, meta_ads: Facebook, google_calendar: Calendar, google_meet: Video, zoom: Video };
export function IntegrationMarketplace({ organizations }: { organizations: { id: string; name: string }[] }) {
  const [picked, setPicked] = useState('');
  const company = organizations.find(o => o.id === picked) ?? organizations[0];
  return <section className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-3 text-2xl font-bold"><Plug className="text-primary" />Integrations Marketplace</h1>
      {company && <Select value={company.id} onValueChange={setPicked}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>}
    </header>
    {company ? <OrganizationMarketplace companyId={company.id} /> : <p className="border-t py-8 text-muted-foreground">No organization is assigned to your account.</p>}
  </section>;
}
function OrganizationMarketplace({ companyId }: { companyId: string }) {
  const { data } = useSuspenseQuery(marketplaceQuery(companyId));
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.providers.map(p => {
    const Icon = icons[p.id];
    const connections = p.id === 'whatsapp' ? data.whatsapp : [];
    const status = !p.policy.enabled ? 'Disabled by platform' : !p.allowed ? 'Not available for this organization' : connections.length ? `${connections.length} number${connections.length === 1 ? '' : 's'}` : 'Setup required';
    return <article key={p.id} className="flex min-w-0 flex-col rounded-lg border bg-card p-6">
      <Icon className="mb-4 size-8 text-primary" /><h2 className="text-lg font-semibold">{p.name}</h2><p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
      <p className="mt-5 border-t pt-4 text-sm font-medium">{status}</p>
      {connections.map(c => <dl key={c.id} className="mt-3 space-y-1 text-sm"><dt className="font-semibold">{c.verified_name || c.display_phone_number}</dt><dd className="capitalize text-muted-foreground">{c.status.replaceAll('_', ' ')}</dd><dd className="text-muted-foreground">Last check: {c.last_health_at ? new Date(c.last_health_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not checked'}</dd>{c.last_error && <dd className="break-words text-destructive">{c.last_error}</dd>}</dl>)}
      {p.id === 'whatsapp' && p.allowed ? <Button asChild variant="outline" className="mt-5"><Link to="/whatsapp/connection">{p.can_manage ? 'Manage connection' : 'View connection'}</Link></Button> : <Button variant="outline" className="mt-5" disabled>{providerAction(p.id, p.allowed)}</Button>}
    </article>;
  })}</div>;
}
function providerAction(id: ProviderId, allowed: boolean) {
  return allowed ? id === 'whatsapp' ? 'Connect' : 'Provider setup pending' : 'Unavailable';
}