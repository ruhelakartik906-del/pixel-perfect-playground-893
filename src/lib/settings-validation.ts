import { z } from 'zod';

const optionalEmail = z.string().trim().max(255).refine(v => !v || z.string().email().safeParse(v).success, 'Enter a valid email');
const phone = z.string().trim().max(30).refine(v => !v || /^[+\d][\d\s()-]{5,29}$/.test(v), 'Enter a valid phone number');
export const adminProfileSchema = z.object({ full_name: z.string().trim().min(2, 'Enter your full name').max(120), phone });
export const businessSettingsSchema = z.object({
  company_name: z.string().trim().min(1, 'Business name is required').max(120),
  email: optionalEmail, phone, address: z.string().trim().max(500), city: z.string().trim().max(100),
  state: z.string().trim().max(100), country: z.string().trim().max(100),
  gstin: z.string().trim().toUpperCase().refine(v => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), 'Enter a valid 15-character GSTIN'),
  default_currency: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code').default('INR'),
  tax_percentage: z.coerce.number().min(0, 'Tax cannot be negative').max(100, 'Tax cannot exceed 100%').default(0),
  tax_preference: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  invoice_prefix: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/, 'Use 1–20 letters, numbers, hyphens or underscores').default('INV'),
  invoice_business_information: z.string().trim().max(2000), payment_instructions: z.string().trim().max(2000),
});
export const credentialChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('email'), current_password: z.string().min(1, 'Enter your current password').max(500), email: z.string().trim().email('Enter a valid email').max(255), redirect_to: z.string().url() }),
  z.object({ kind: z.literal('password'), current_password: z.string().min(1, 'Enter your current password').max(500), password: z.string().min(8, 'Use at least 8 characters').max(72), confirm_password: z.string() }),
]).superRefine((v, ctx) => {
  if (v.kind !== 'password') return;
  if (v.password !== v.confirm_password) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Passwords do not match', path: ['confirm_password'] });
  if (v.password === v.current_password) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a different password', path: ['password'] });
});
export function settingsAdminAllowed(role: boolean, status: string) { return role && status === 'active'; }
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;