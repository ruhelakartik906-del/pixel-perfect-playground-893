import { z } from 'zod';

export const PROVIDER_IDS = ['whatsapp', 'meta_ads', 'google_calendar', 'google_meet', 'zoom'] as const;
export type ProviderId = typeof PROVIDER_IDS[number];
export const PROVIDERS: { id: ProviderId; name: string; description: string; permissions: string[] }[] = [
  { id: 'whatsapp', name: 'WhatsApp Business', description: 'Your business number, customer conversations and message templates.', permissions: ['whatsapp.view', 'whatsapp.create'] },
  { id: 'meta_ads', name: 'Facebook & Instagram Lead Ads', description: 'Lead forms, field mapping and campaign attribution.', permissions: ['lead.view', 'lead.create'] },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Calendar events linked to CRM contacts and tasks.', permissions: ['task.view', 'task.create', 'task.edit'] },
  { id: 'google_meet', name: 'Google Meet', description: 'Video meeting links for scheduled customer calls.', permissions: ['hr_meeting.view', 'hr_meeting.create'] },
  { id: 'zoom', name: 'Zoom', description: 'Scheduled video meetings linked to contacts and deals.', permissions: ['deal.view', 'deal.edit'] },
];
export const policyInput = z.object({
  provider: z.enum(PROVIDER_IDS), enabled: z.boolean(),
  plan_ids: z.array(z.string().uuid()).max(100).nullable(),
  max_connections: z.number().int().min(0).max(1_000_000).nullable(),
  required_permissions: z.array(z.string().regex(/^[a-z_]+\.(view|create|edit|delete)$/).max(80)).max(40),
}).strict();
export type IntegrationPolicy = z.infer<typeof policyInput>;
export function defaultPolicy(provider: ProviderId): IntegrationPolicy {
  return { provider, enabled: true, plan_ids: null, max_connections: null, required_permissions: [] };
}
export function connectionCapacity(used: number, limit: number | null): boolean {
  return limit === null || used < limit;
}

export async function nonceDigest(nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}