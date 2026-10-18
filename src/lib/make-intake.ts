import { z } from 'zod';

const metaId = z.string().trim().regex(/^\d{1,40}$/);
export const intakeSchema = z.object({
  facebook_lead_id: metaId,
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40).regex(/^[+\d\s().-]+$/),
  email: z.union([z.literal(''), z.string().trim().email().max(255)]).default(''),
  source: z.string().trim().min(1).max(120),
  page_id: metaId, form_id: metaId, campaign_id: metaId, ad_id: metaId,
  adset_id: metaId.optional(), creative_id: metaId.optional(),
  form_answers: z.record(z.string().min(1).max(200), z.unknown()).default({}),
  dry_run: z.boolean().default(false),
}).strict();

export const sourceBindingsSchema = z.array(z.object({
  page_id: metaId, form_id: metaId, campaign_id: metaId,
  company_id: z.string().uuid(), account_id: metaId,
}).strict()).min(1).max(1000);

export function resolveIntakeSource(bindings: z.infer<typeof sourceBindingsSchema>, lead: z.infer<typeof intakeSchema>) {
  const matches = bindings.filter(b => b.page_id === lead.page_id && b.form_id === lead.form_id && b.campaign_id === lead.campaign_id);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Compare fixed-size digests so neither token length nor early mismatches determine comparison time. */
export async function verifyIntakeToken(supplied: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([supplied, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}