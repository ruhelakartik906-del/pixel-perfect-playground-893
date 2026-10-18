import { z } from 'zod';

const id = z.string().trim().regex(/^\d{1,40}$/);
const optionalId = z.union([z.literal(''), id]).default('');
export const managedSourceSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120),
  platform: z.enum(['Facebook', 'Instagram', 'Website']), company_id: z.string().uuid(),
  account_id: id, page_id: id, form_id: id, campaign_id: optionalId, ad_id: optionalId,
  rule_id: z.string().uuid().nullable().default(null), active: z.boolean().default(true),
}).strict();
export type ManagedSourceInput = z.infer<typeof managedSourceSchema>;
export type ManagedSource = ManagedSourceInput & { id: string; archived: boolean; created_at: string };
export function selectManagedSource(sources: ManagedSource[], lead: { page_id: string; form_id: string; campaign_id?: string; ad_id?: string }) {
  const matches = sources.filter(s => s.page_id === lead.page_id && s.form_id === lead.form_id && (!s.campaign_id || s.campaign_id === lead.campaign_id) && (!s.ad_id || s.ad_id === lead.ad_id));
  const specificity = (s: ManagedSource) => (s.campaign_id ? 1 : 0) + (s.ad_id ? 2 : 0);
  matches.sort((a, b) => specificity(b) - specificity(a));
  const first = matches[0];
  if (!first || !first.active || first.archived || matches.filter(s => specificity(s) === specificity(first)).length !== 1) return undefined;
  return first;
}
export async function hashMakeCredential(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}