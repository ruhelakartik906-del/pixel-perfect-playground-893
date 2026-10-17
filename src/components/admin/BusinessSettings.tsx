import { useState, type FormEvent } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Building2, FileText, IndianRupee } from 'lucide-react';
import { businessSettingsQuery } from '@/lib/settings-data';
import { saveBusinessSettings } from '@/lib/settings.functions';
import { businessSettingsSchema, type BusinessSettings as Values } from '@/lib/settings-validation';
import { Breadcrumb } from './ui';
import { SettingsFeedback, SettingsField, SettingsSave, SettingsSection } from './SettingsForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function BusinessSettings() {
  const { data } = useSuspenseQuery(businessSettingsQuery);
  const [values, setValues] = useState<Values>({ company_name: data?.company_name ?? '', email: data?.email ?? '', phone: data?.phone ?? '', address: data?.address ?? '', city: data?.city ?? '', state: data?.state ?? '', country: data?.country ?? '', gstin: data?.gstin ?? '', default_currency: data?.default_currency ?? 'INR', tax_percentage: data?.tax_percentage ?? 0, tax_preference: data?.tax_preference === 'inclusive' ? 'inclusive' : 'exclusive', invoice_prefix: data?.invoice_prefix ?? 'INV', invoice_business_information: data?.invoice_business_information ?? '', payment_instructions: data?.payment_instructions ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const save = useServerFn(saveBusinessSettings);
  const queryClient = useQueryClient();
  function field(key: keyof Values, label: string, options: { type?: string; required?: boolean; wide?: boolean; multiline?: boolean; maxLength?: number; min?: number; max?: number } = {}) {
    return <SettingsField key={key} label={label} value={values[key]} onChange={v => setValues(previous => ({ ...previous, [key]: v }))} {...options} />;
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    const result = businessSettingsSchema.safeParse(values);
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Check your settings'); return; }
    setBusy(true);
    try { await save({ data: result.data }); setValues(result.data); await queryClient.invalidateQueries({ queryKey: businessSettingsQuery.queryKey }); await queryClient.invalidateQueries({ queryKey: ['admin-sales'] }); setSuccess('Business settings saved. Existing invoices and payments are unchanged.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Business settings could not be saved'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl"><Breadcrumb label="Business Settings" trail={['Settings']} />
    <div className="mb-2 flex items-center gap-3"><Building2 className="size-6 text-admin-blue" /><h1 className="text-2xl font-bold tracking-normal">Business Settings</h1></div>
    <form onSubmit={e => void submit(e)}>
      <SettingsSection title="Business profile" icon={Building2}>
        {field('company_name', 'Business name', { required: true, maxLength: 120 })}{field('email', 'Contact email', { type: 'email', maxLength: 255 })}
        {field('phone', 'Business phone', { type: 'tel', maxLength: 30 })}{field('gstin', 'GSTIN', { maxLength: 15 })}
        {field('address', 'Address', { wide: true, maxLength: 500 })}{field('city', 'City', { maxLength: 100 })}{field('state', 'State', { maxLength: 100 })}{field('country', 'Country', { maxLength: 100 })}
      </SettingsSection>
      <SettingsSection title="Currency & tax" icon={IndianRupee}>
        {field('default_currency', 'Default currency', { required: true, maxLength: 3 })}
        {field('tax_percentage', 'GST / Tax percentage', { type: 'number', required: true, min: 0, max: 100 })}
        <label className="grid gap-1.5 text-sm font-semibold"><span>Tax preference</span><Select value={values.tax_preference} onValueChange={v => setValues(previous => ({ ...previous, tax_preference: v === 'inclusive' ? 'inclusive' : 'exclusive' }))}><SelectTrigger className="h-10 bg-card font-normal"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Tax exclusive</SelectItem><SelectItem value="inclusive">Tax inclusive</SelectItem></SelectContent></Select></label>
        <p className="self-center text-sm text-muted-foreground">INR — Indian Rupee (₹)</p>
      </SettingsSection>
      <SettingsSection title="Invoice defaults" icon={FileText}>
        {field('invoice_prefix', 'Invoice prefix', { required: true, maxLength: 20 })}
        {field('invoice_business_information', 'Invoice business information', { wide: true, multiline: true, maxLength: 2000 })}
        {field('payment_instructions', 'Payment instructions', { wide: true, multiline: true, maxLength: 2000 })}
      </SettingsSection>
      <div className="grid gap-4 py-6"><SettingsFeedback error={error} success={success} /><div className="flex justify-end"><SettingsSave busy={busy} label="Save business settings" /></div></div>
    </form>
  </div>;
}