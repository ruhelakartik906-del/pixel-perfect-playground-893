import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, History, Link2Off, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { checkWhatsAppHealth, completeWhatsAppSignup, disconnectWhatsApp, myOrgWhatsApp, myWhatsAppOrgs, whatsappSetupInfo, type WaConnection } from '@/lib/org-whatsapp.functions';
import { cn } from '@/lib/utils';

declare global {
  interface Window { FB?: any; fbAsyncInit?: () => void }
}

const STATUS: Record<string, [string, string]> = {
  connected: ['Connected', 'bg-success/15 text-success'],
  error: ['Needs attention', 'bg-destructive/10 text-destructive'],
  token_expired: ['Reconnect required', 'bg-warning/15 text-warning'],
  pending: ['Pending', 'bg-muted text-muted-foreground'],
};

function loadSdk(appId: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) { resolve(); return; }
    window.fbAsyncInit = () => { window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v21.0' }); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js'; s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    document.body.appendChild(s);
  });
}

export function OrgWhatsAppConnection() {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ['wa-orgs'], queryFn: () => myWhatsAppOrgs() });
  const setup = useQuery({ queryKey: ['wa-setup'], queryFn: () => whatsappSetupInfo() });
  const [picked, setPicked] = useState('');
  const company = picked || orgs.data?.[0]?.id || '';
  const info = useQuery({ queryKey: ['wa-conn', company], queryFn: () => myOrgWhatsApp({ data: { company_id: company } }), enabled: Boolean(company) });
  const [coexistence, setCoexistence] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<WaConnection | null>(null);
  const session = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.type === 'WA_EMBEDDED_SIGNUP' && d.event?.startsWith('FINISH')) session.current = { waba_id: d.data?.waba_id, phone_number_id: d.data?.phone_number_id };
      } catch { /* other messages */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const refresh = () => qc.invalidateQueries({ queryKey: ['wa-conn', company] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed'); } finally { setBusy(false); }
  };

  const connect = async () => {
    const s = setup.data;
    if (!s?.ready || !s.appId || !s.configId) return;
    if (!coexistence && !/^\d{6}$/.test(pin)) { toast.error('Enter a 6-digit PIN for number registration'); return; }
    setBusy(true);
    try {
      await loadSdk(s.appId);
      session.current = {};
      const code: string | null = await new Promise((resolve) => {
        window.FB.login((r: any) => resolve(r?.authResponse?.code ?? null), {
          config_id: s.configId, response_type: 'code', override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: '3', ...(coexistence ? { featureType: 'whatsapp_business_app_onboarding' } : {}) },
        });
      });
      const { waba_id, phone_number_id } = session.current;
      if (!code || !waba_id || !phone_number_id) { toast.error('Meta signup was cancelled or did not finish'); return; }
      const conn = await completeWhatsAppSignup({ data: { company_id: company, code, waba_id, phone_number_id, coexistence, ...(coexistence ? {} : { pin }) } });
      if (conn.status === 'connected') toast.success('WhatsApp connected and verified');
      else toast.warning(`Saved, but not fully verified: ${conn.last_error ?? 'see details'}`);
      setPin('');
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Connection failed'); } finally { setBusy(false); }
  };

  if (orgs.data && orgs.data.length === 0) {
    return <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-card"><ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="text-lg font-bold">No organization</h3><p className="mt-2 text-sm text-muted-foreground">WhatsApp connects at the organization level. Your account is not part of an organization.</p></div>;
  }
  const d = info.data;
  const isAdmin = d?.is_admin ?? false;
  const used = d?.connections.length ?? 0;
  const atLimit = d?.limit != null && used >= d.limit;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">WhatsApp Business Connection</h1><p className="text-sm text-muted-foreground">Connect your organization's own WhatsApp Business number through Meta. Employees use it without separate Meta login.</p></div>
        {(orgs.data?.length ?? 0) > 1 && <Select value={company} onValueChange={setPicked}><SelectTrigger className="w-60"><SelectValue placeholder="Organization" /></SelectTrigger><SelectContent>{orgs.data!.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>}
      </div>

      {setup.data && !setup.data.ready && <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"><b>Setup required.</b> The platform's Meta app is not fully configured yet, so connecting is unavailable. Everything else in your CRM keeps working.</div>}

      {(d?.connections ?? []).map((c) => { const [l, cls] = STATUS[c.status] ?? STATUS['pending']!; return (
        <div key={c.id} className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><MessageCircle className="size-5" /></span>
            <div className="flex-1"><h3 className="text-lg font-semibold">{c.verified_name ?? c.display_phone_number ?? 'WhatsApp number'}</h3><p className="text-sm text-muted-foreground">{c.display_phone_number} · {c.business_name ?? 'Business'}</p></div>
            <span className={cn('rounded px-2.5 py-1 text-sm font-medium', cls)}>{l}</span></div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-muted-foreground">WABA ID</dt><dd className="font-mono">{c.waba_id}</dd></div>
            <div><dt className="text-muted-foreground">Phone number ID</dt><dd className="font-mono">{c.phone_number_id}</dd></div>
            <div><dt className="text-muted-foreground">Quality</dt><dd>{c.quality_rating ?? '—'}</dd></div>
            {[['Meta authorization', c.token_ok], ['Number registered', c.number_registered], ['Webhooks subscribed', c.webhook_subscribed]].map(([k, v]) => <div key={k as string} className="flex items-center gap-1.5">{v ? <CheckCircle2 className="size-4 text-success" /> : <CircleAlert className="size-4 text-destructive" />}{k as string}</div>)}
            <div><dt className="text-muted-foreground">Permissions</dt><dd>{c.scopes.length ? c.scopes.join(', ') : '—'}</dd></div>
            <div><dt className="text-muted-foreground">Mode</dt><dd>{c.coexistence ? 'Business App coexistence' : 'Cloud API'}</dd></div>
            <div><dt className="text-muted-foreground">Last checked</dt><dd>{c.last_health_at ? new Date(c.last_health_at).toLocaleString() : '—'}</dd></div>
          </dl>
          {c.last_error && <p className="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{c.last_error}</p>}
          {isAdmin && <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => run(() => checkWhatsAppHealth({ data: { connection_id: c.id } }), 'Health check complete')}><RefreshCw className="size-4" />Check connection</Button><Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setConfirm(c)}><Link2Off className="size-4" />Disconnect</Button></div>}
        </div>); })}

      {d && d.connections.length === 0 && !isAdmin && <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Your organization has not connected WhatsApp yet. Ask your Customer Admin to connect it.</div>}

      {isAdmin && <div className="rounded-xl border bg-card p-6 shadow-card">
        <h3 className="text-lg font-semibold">{used ? 'Connect or reconnect a number' : 'Connect WhatsApp Business'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Opens Meta's official signup. Choose your Business Portfolio, WhatsApp Business Account and phone number. Reconnecting the same number refreshes its authorization. {d?.limit != null && `Plan: ${used}/${d.limit} numbers.`}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={coexistence} onCheckedChange={(v) => setCoexistence(v === true)} /><span>This number already uses the WhatsApp Business app (coexistence, where Meta allows it)</span></label>
          {!coexistence && <div className="grid gap-1"><Label htmlFor="wa-pin">New two-step verification PIN (6 digits)</Label><Input id="wa-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>}
        </div>
        <Button className="mt-4" disabled={busy || !setup.data?.ready || (atLimit && !used)} onClick={connect}><MessageCircle className="size-4" />{busy ? 'Working…' : 'Connect with Meta'}</Button>
        {atLimit && <p className="mt-2 text-xs text-muted-foreground">Your plan's number limit is reached; reconnecting an existing number is still allowed.</p>}
      </div>}

      {isAdmin && (d?.audit.length ?? 0) > 0 && <div className="rounded-xl border bg-card p-6"><h3 className="mb-3 flex items-center gap-2 font-semibold"><History className="size-4" />Connection history</h3><ul className="space-y-1.5 text-sm">{d!.audit.map((a) => <li key={a.id} className="flex justify-between gap-4"><span className="capitalize">{a.action.replace(/_/g, ' ')}</span><span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></li>)}</ul></div>}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Disconnect this WhatsApp number?</AlertDialogTitle><AlertDialogDescription>The stored Meta authorization is deleted and webhooks are unsubscribed. Past records stay. You can reconnect anytime.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { const c = confirm; setConfirm(null); if (c) void run(() => disconnectWhatsApp({ data: { connection_id: c.id } }), 'WhatsApp disconnected'); }}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
