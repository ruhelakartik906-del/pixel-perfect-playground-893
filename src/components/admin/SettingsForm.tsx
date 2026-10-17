import type { ReactNode } from 'react';
import { Save, LoaderCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SettingsSection({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return <section className="grid gap-5 border-b py-7 last:border-b-0 lg:grid-cols-[220px_minmax(0,1fr)]"><h2 className="flex items-center gap-3 self-start text-lg font-semibold tracking-normal"><Icon className="size-5 text-admin-blue" />{title}</h2><div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div></section>;
}
export function SettingsField({ label, value, onChange, type = 'text', required, wide, multiline, autoComplete, min, max, maxLength }: {
  label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean; wide?: boolean; multiline?: boolean; autoComplete?: string; min?: number; max?: number; maxLength?: number;
}) {
  return <label className={`grid min-w-0 gap-1.5 text-sm font-semibold ${wide ? 'sm:col-span-2' : ''}`}><span>{label}{required && <span className="ml-1 text-destructive">*</span>}</span>{multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} rows={3} className="w-full resize-y rounded-md border bg-card p-3 font-normal outline-none focus:ring-2 focus:ring-ring/30" /> : <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} autoComplete={autoComplete} min={min} max={max} maxLength={maxLength} step={type === 'number' ? '0.01' : undefined} className="inp font-normal" />}</label>;
}
export function SettingsSave({ busy, label = 'Save changes' }: { busy: boolean; label?: string }) {
  return <Button type="submit" disabled={busy} className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90">{busy ? <LoaderCircle className="animate-spin" /> : <Save />}{busy ? 'Saving…' : label}</Button>;
}
export function SettingsFeedback({ error, success }: { error: string; success: string }) {
  return error ? <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : success ? <p role="status" className="rounded-md border border-success/20 bg-success-soft p-3 text-sm text-success">{success}</p> : null;
}