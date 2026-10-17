import { z } from 'zod';
import { localDay } from '@/lib/crm-work';
export type Period = 'today' | 'month' | 'all';
export function inPeriod(iso: string, period: Period, now = new Date()) {
  if (period === 'all') return true;
  const day = localDay(new Date(iso)), today = localDay(now);
  return period === 'today' ? day === today : day.slice(0, 7) === today.slice(0, 7);
}
export function stageCategory(name: string, status: string) {
  if (status === 'won' || status === 'converted') return 'converted';
  const label = name.toLowerCase().trim();
  if (/^(converted|won|closed won)$/.test(label)) return 'converted';
  if (/^(interested|qualified)$/.test(label)) return 'interested';
  if (/^(contacted|contact made)$/.test(label)) return 'contacted';
  if (/^(new|new lead|new leads)$/.test(label)) return 'new';
  return 'other';
}
export function formEntries(value: unknown, prefix = ''): { label: string; value: string }[] {
  if (Array.isArray(value)) return value.flatMap((entry, i) => {
    if (entry && typeof entry === 'object' && 'name' in entry && 'values' in entry) {
      const row = entry as { name: unknown; values: unknown };
      return formEntries(row.values, prefix ? `${prefix} · ${String(row.name)}` : String(row.name));
    }
    return formEntries(entry, `${prefix}${prefix ? ' · ' : ''}${i + 1}`);
  });
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, v]) => formEntries(v, prefix ? `${prefix} · ${key}` : key));
  return [{ label: prefix || 'Answer', value: value === null ? '—' : String(value) }];
}
export function contactLinks(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? { call: `tel:${phone.startsWith('+') ? '+' : ''}${digits}`, whatsapp: `https://wa.me/${digits}` } : null;
}
export const leadDetailsSchema = z.object({
  customer_name: z.string().trim().min(1).max(200), phone: z.string().max(30), email: z.union([z.literal(''), z.string().email()]),
  business_name: z.string().max(200), business_category: z.string().max(200), region: z.string().max(200), requirements: z.string().max(5000), interest_level: z.string().max(100),
}).strict();
export const userLeadActionSchema = z.object({
  id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }),
  action: z.enum(['stage', 'status', 'note', 'details']),
  payload: z.union([z.object({ stage_id: z.string().uuid() }).strict(), z.object({ status: z.enum(['open', 'won', 'lost']) }).strict(), z.object({ note: z.string().trim().min(1).max(5000) }).strict(), leadDetailsSchema]),
}).superRefine((v, ctx) => {
  if ((v.action === 'stage' && !('stage_id' in v.payload)) || (v.action === 'status' && !('status' in v.payload)) || (v.action === 'note' && !('note' in v.payload)) || (v.action === 'details' && !('customer_name' in v.payload))) ctx.addIssue({ code: 'custom', message: 'Invalid lead action' });
});
export function userHead(title: string, description: string) {
  const text = `${title} — Routiva CRM`;
  return { meta: [{ title: text }, { name: 'description', content: description }, { property: 'og:title', content: text }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}