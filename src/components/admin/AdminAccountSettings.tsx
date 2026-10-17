import { useState, type FormEvent } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useRouter } from '@tanstack/react-router';
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { accountSettingsQuery } from '@/lib/settings-data';
import { changeAdminCredentials, saveAdminProfile } from '@/lib/settings.functions';
import { adminProfileSchema, credentialChangeSchema } from '@/lib/settings-validation';
import { initials } from '@/lib/admin-head';
import { Breadcrumb, StatusBadge } from './ui';
import { SettingsFeedback, SettingsField, SettingsSave, SettingsSection } from './SettingsForm';

function CredentialForm({ kind, pendingEmail, currentEmail, onSaved }: { kind: 'email' | 'password'; pendingEmail: string; currentEmail: string; onSaved: () => Promise<void> }) {
  const [current, setCurrent] = useState('');
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const change = useServerFn(changeAdminCredentials);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    const result = credentialChangeSchema.safeParse(kind === 'email' ? { kind, current_password: current, email: value, redirect_to: `${window.location.origin}/admin/login` } : { kind, current_password: current, password: value, confirm_password: confirm });
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Check the form'); return; }
    if (kind === 'email' && value.trim().toLowerCase() === currentEmail.toLowerCase()) { setError('Enter a different login email'); return; }
    setBusy(true);
    try {
      await change({ data: result.data });
      setCurrent(''); setValue(''); setConfirm('');
      setSuccess(kind === 'email' ? 'Email change requested. Complete the verification sent to your email addresses; your current email remains active until confirmation.' : 'Password changed successfully.');
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Changes could not be saved'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={e => void submit(e)}><SettingsSection title={kind === 'email' ? 'Login email' : 'Password'} icon={kind === 'email' ? Mail : KeyRound}>
    {kind === 'email' && <div className="sm:col-span-2"><p className="break-all text-sm text-muted-foreground">Current email: <span className="text-foreground">{currentEmail}</span></p>{pendingEmail && <p className="mt-2 break-all text-sm text-warning">Awaiting verification: {pendingEmail}</p>}</div>}
    <SettingsField label="Current password" type="password" value={current} onChange={setCurrent} required autoComplete="current-password" maxLength={500} />
    <SettingsField label={kind === 'email' ? 'New login email' : 'New password'} type={kind === 'email' ? 'email' : 'password'} value={value} onChange={setValue} required autoComplete={kind === 'email' ? 'email' : 'new-password'} maxLength={kind === 'email' ? 255 : 72} />
    {kind === 'password' && <SettingsField label="Confirm new password" type="password" value={confirm} onChange={setConfirm} required autoComplete="new-password" maxLength={72} />}
    <div className="sm:col-span-2"><SettingsFeedback error={error} success={success} /></div>
    <div className="sm:col-span-2"><SettingsSave busy={busy} label={kind === 'email' ? 'Request email change' : 'Change password'} /></div>
  </SettingsSection></form>;
}

export function AdminAccountSettings() {
  const { data } = useSuspenseQuery(accountSettingsQuery);
  const [name, setName] = useState(data.full_name);
  const [phone, setPhone] = useState(data.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const save = useServerFn(saveAdminProfile);
  const queryClient = useQueryClient();
  const router = useRouter();
  const reload = async () => { await queryClient.invalidateQueries({ queryKey: accountSettingsQuery.queryKey }); await router.invalidate(); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    const result = adminProfileSchema.safeParse({ full_name: name, phone });
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Check your profile'); return; }
    setBusy(true);
    try { await save({ data: result.data }); await reload(); setName(result.data.full_name); setPhone(result.data.phone); setSuccess('Profile saved successfully.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Profile could not be saved'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl"><Breadcrumb label="Admin Account & Security" trail={['Settings']} />
    <div className="mb-6 flex items-center gap-3"><ShieldCheck className="size-6 text-admin-blue" /><h1 className="text-2xl font-bold tracking-normal">Admin Account & Security</h1></div>
    <section className="mb-2 flex flex-wrap items-center gap-4 rounded-lg border bg-card p-5 shadow-card">
      {data.avatar_url ? <img src={data.avatar_url} alt="Admin avatar" className="size-16 rounded-full object-cover" /> : <span aria-label="Admin avatar" className="grid size-16 shrink-0 place-items-center rounded-full bg-admin-blue/10 text-xl font-bold text-admin-blue">{initials(data.full_name)}</span>}
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-xl font-semibold tracking-normal">{data.full_name || 'Super Admin'}</h2><StatusBadge tone="green">Active</StatusBadge></div><p className="mt-1 break-all text-sm text-muted-foreground">{data.email}</p><p className="mt-1 text-xs font-semibold text-admin-blue">Super Admin</p></div>
    </section>
    <form onSubmit={e => void submit(e)}><SettingsSection title="Profile details" icon={UserRound}>
      <SettingsField label="Full name" value={name} onChange={setName} required autoComplete="name" maxLength={120} />
      <SettingsField label="Phone number" value={phone} onChange={setPhone} type="tel" autoComplete="tel" maxLength={30} />
      <p className="text-xs text-muted-foreground sm:col-span-2">Phone verification: {data.phone_verified ? 'Verified' : 'Not verified'}</p>
      <div className="sm:col-span-2"><SettingsFeedback error={error} success={success} /></div><div className="sm:col-span-2"><SettingsSave busy={busy} /></div>
    </SettingsSection></form>
    <CredentialForm kind="email" currentEmail={data.email} pendingEmail={data.pending_email} onSaved={reload} />
    <CredentialForm kind="password" currentEmail={data.email} pendingEmail="" onSaved={reload} />
  </div>;
}