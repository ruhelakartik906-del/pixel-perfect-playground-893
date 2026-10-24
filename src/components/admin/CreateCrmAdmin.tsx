import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumb, PageHeader } from './ui';
import { createCrmInstallation } from '@/lib/crm-installations.functions';
import { installationSchema } from '@/lib/crm-installations';

export function CreateCrmAdmin() {
  const create = useServerFn(createCrmInstallation);
  const qc = useQueryClient();
  const [years,setYears] = useState<1 | 2>(1);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [saved,setSaved] = useState(false);
  const [installationId,setInstallationId] = useState('');
  const submitting = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(''); setSaved(false);
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const parsed = installationSchema.safeParse({ ...fields, validity_years: years });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the installation details'); return; }
    submitting.current = true; setBusy(true);
    try {
      const result = await create({ data: parsed.data });
      if (result && typeof result === 'object' && !Array.isArray(result)) setInstallationId(String(result['installation_id'] ?? ''));
      setSaved(true); form.reset(); setYears(1);
      // A refresh failure must not turn a committed creation into a failed save.
      void qc.invalidateQueries({queryKey:['crm-installations']}).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : 'Installation could not be saved'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="space-y-5">
    <Breadcrumb label="Create CRM Admin" />
    <PageHeader title="Create CRM Admin"><Button variant="outline" asChild><Link to="/admin/sold-crm-admins"><ArrowLeft className="size-4" />Sold CRM Admins</Link></Button></PageHeader>
    {saved && <div role="status" className="rounded-md border border-admin-blue/30 bg-admin-blue/10 p-4"><p className="font-semibold">Installation record saved · Setup Required</p><p className="break-all text-sm">{installationId}</p><p className="mt-2 text-sm">No Admin account was created. A separate customer installation, secure provisioning connection and enforced license check must be configured before access can be activated.</p></div>}
    <form onSubmit={submit} className="space-y-6 rounded-lg border bg-card p-5 sm:p-7">
      <section className="space-y-4"><h2 className="text-lg font-semibold">Client Details</h2><div className="grid gap-4 md:grid-cols-2">
        <Field label="Client/Admin Name" name="client_name" maxLength={120} required />
        <Field label="Company Name" name="company_name" maxLength={160} required />
        <Field label="Admin Email" name="admin_email" type="email" maxLength={255} required />
        <Field label="Admin Phone" name="admin_phone" type="tel" maxLength={30} />
      </div></section>
      <section className="space-y-4 border-t pt-5"><h2 className="text-lg font-semibold">CRM Installation</h2><div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">CRM Installation ID<input className="inp" value="Generated securely after Save" readOnly /></label>
        <Field label="Customer CRM URL" name="crm_url" type="url" maxLength={500} placeholder="https://crm.customer.com" required />
        <label className="grid gap-1.5 text-sm font-medium">Installation Status<input className="inp" value="Setup Required" readOnly /></label>
        <label className="grid gap-1.5 text-sm font-medium">Installation Verification<input className="inp" value="Not verified" readOnly /></label>
      </div></section>
      <section className="space-y-3 border-t pt-5"><h2 className="text-lg font-semibold">Validity</h2><div className="flex gap-6">{([1,2] as const).map(v => <label key={v} className="flex items-center gap-2 text-sm"><input type="radio" name="validity" checked={years===v} onChange={()=>setYears(v)} />{v} Year{v===2?'s':''}</label>)}</div><p className="text-sm text-muted-foreground">Start and expiry dates are calculated when the installation is saved. Expired renewals start on the renewal date.</p></section>
      <section className="space-y-2 border-t pt-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-admin-blue" />Admin Account Creation</h2><p className="text-sm text-muted-foreground">Email invitation requires the independent customer installation to be configured. Phone sign-in is not configured. Passwords are never collected here.</p></section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={busy}><UserPlus className="size-4" />{busy?'Saving…':'Create CRM Admin'}</Button></div>
    </form>
  </div>;
}
function Field({label,...props}: React.InputHTMLAttributes<HTMLInputElement> & {label:string}) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<input className="inp" {...props} /></label>;
}