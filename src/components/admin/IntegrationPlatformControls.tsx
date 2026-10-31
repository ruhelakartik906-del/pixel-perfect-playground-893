import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { Settings2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { masterPolicyQuery, saveIntegrationPolicy } from '@/lib/integration-marketplace.functions';
import { PROVIDERS, type IntegrationPolicy } from '@/lib/integration-marketplace';

export function IntegrationPlatformControls() {
  const query = useQuery(masterPolicyQuery), qc = useQueryClient();
  const save = useServerFn(saveIntegrationPolicy);
  const [editing, setEditing] = useState<IntegrationPolicy | null>(null), [busy, setBusy] = useState(false);
  return <section className="space-y-4 border-b pb-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><Settings2 className="size-5" />Marketplace controls</h2>
    {query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{query.data?.policies.map(p => <div key={p.provider} className="rounded-lg border bg-card p-4"><h3 className="font-semibold">{PROVIDERS.find(x => x.id === p.provider)?.name}</h3><p className="my-2 text-sm text-muted-foreground">{p.enabled ? 'Globally enabled' : 'Globally disabled'} · {query.data.readiness[p.provider] ? 'Credentials configured; live verification pending' : 'Credentials required'}</p><Button variant="outline" onClick={() => setEditing(p)}>Configure</Button></div>)}</div>
    <Button asChild variant="outline"><Link to="/admin/whatsapp/org-connections">WhatsApp connection health and history</Link></Button>
    {query.data && query.data.audit.length > 0 && <p className="text-sm text-muted-foreground">Latest policy change: {new Date(query.data.audit[0]?.created_at ?? '').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>}
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{PROVIDERS.find(p => p.id === editing?.provider)?.name} policy</DialogTitle></DialogHeader>
      {editing && <form className="space-y-5" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await save({ data: editing }); await qc.invalidateQueries({ queryKey: masterPolicyQuery.queryKey }); await qc.invalidateQueries({ queryKey: ['integration-marketplace'] }); toast.success('Integration policy saved'); setEditing(null); } catch (error) { toast.error(error instanceof Error ? error.message : 'Policy could not be saved'); } finally { setBusy(false); } }}>
        <label className="flex items-center gap-2"><Checkbox checked={editing.enabled} onCheckedChange={v => setEditing({ ...editing, enabled: v === true })} />Enable globally</label>
        <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Subscription access</legend><label className="flex items-center gap-2"><Checkbox checked={editing.plan_ids === null} onCheckedChange={v => setEditing({ ...editing, plan_ids: v === true ? null : [] })} />All plans, including legacy organizations</label>{editing.plan_ids !== null && query.data?.plans.map(plan => <label key={plan.id} className="flex items-center gap-2 text-sm"><Checkbox checked={editing.plan_ids?.includes(plan.id) ?? false} onCheckedChange={v => setEditing({ ...editing, plan_ids: v === true ? [...(editing.plan_ids ?? []), plan.id] : (editing.plan_ids ?? []).filter(id => id !== plan.id) })} />{plan.name}{!plan.is_active && ' (retired)'}</label>)}</fieldset>
        <fieldset className="space-y-2"><legend className="font-semibold">Connection cap</legend><label className="flex items-center gap-2"><Checkbox checked={editing.max_connections === null} onCheckedChange={v => setEditing({ ...editing, max_connections: v === true ? null : 0 })} />No platform cap</label>{editing.max_connections !== null && <Input aria-label="Maximum connections" type="number" min="0" max="1000000" value={editing.max_connections} onChange={e => setEditing({ ...editing, max_connections: Number(e.target.value) })} />}</fieldset>
        <fieldset className="space-y-2"><legend className="font-semibold">Employee usage permissions</legend>{PROVIDERS.find(p => p.id === editing.provider)?.permissions.map(permission => <label key={permission} className="flex items-center gap-2 text-sm"><Checkbox checked={editing.required_permissions.includes(permission)} onCheckedChange={v => setEditing({ ...editing, required_permissions: v === true ? [...editing.required_permissions, permission] : editing.required_permissions.filter(p => p !== permission) })} />{permission}</label>)}</fieldset>
        <Button type="submit" disabled={busy}><Save className="size-4" />{busy ? 'Saving…' : 'Save policy'}</Button>
      </form>}
    </DialogContent></Dialog>
  </section>;
}