import { z } from 'zod';

export const supportCategories = ['Technical Issue', 'Login / Account', 'Leads / CRM', 'Billing / Payment', 'Integrations', 'Other'] as const;
export const supportPriorities = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const supportStatuses = ['Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'] as const;
export const ticketSchema = z.object({ subject: z.string().trim().min(1).max(200), category: z.enum(supportCategories), priority: z.enum(supportPriorities), description: z.string().trim().min(1).max(10000), company_id: z.string().uuid().nullable().optional() }).strict();
export const replySchema = z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(10000), private: z.boolean().default(false) }).strict();
export const canReopen = (status: string) => status === 'Resolved' || status === 'Closed';
export const supportFileLimit = 5 * 1024 * 1024;
export function validateSupportFile(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > supportFileLimit) throw new Error('Attachment must be between 1 byte and 5 MB.');
  const signature = Array.from(bytes.slice(0, 8));
  const valid = mime === 'image/png' ? signature.join(',') === '137,80,78,71,13,10,26,10'
    : mime === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
    : mime === 'application/pdf' ? String.fromCharCode(...signature.slice(0, 5)) === '%PDF-'
    : false;
  if (!valid) throw new Error('Choose a valid PNG, JPEG or PDF attachment.');
}