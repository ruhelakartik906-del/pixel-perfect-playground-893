import { describe, expect, it } from 'vitest';
import { canReopen, replySchema, supportFileLimit, ticketSchema, validateSupportFile } from '@/lib/support-model';
const ticket = { subject: 'CRM issue', description: 'Lead list will not load.', category: 'Leads / CRM', priority: 'Medium' };
describe('Support safeguards', () => {
  it('requires subject', () => expect(ticketSchema.safeParse({ ...ticket, subject: ' ' }).success).toBe(false));
  it('requires description', () => expect(ticketSchema.safeParse({ ...ticket, description: ' ' }).success).toBe(false));
  it('rejects injected ownership', () => expect(ticketSchema.safeParse({ ...ticket, user_id: 'aa31bae5-79f6-497e-9df5-ba7ebda42fc1' }).success).toBe(false));
  it('validates authorized company ID shape', () => expect(ticketSchema.safeParse({ ...ticket, company_id: 'forged' }).success).toBe(false));
  it('restricts categories', () => expect(ticketSchema.safeParse({ ...ticket, category: 'Unknown' }).success).toBe(false));
  it('restricts priorities', () => expect(ticketSchema.safeParse({ ...ticket, priority: 'Critical' }).success).toBe(false));
  it('allows reopening resolved', () => expect(canReopen('Resolved')).toBe(true));
  it('allows reopening closed', () => expect(canReopen('Closed')).toBe(true));
  it('does not reopen pending tickets', () => expect(canReopen('Waiting for User')).toBe(false));
  it('requires reply body', () => expect(replySchema.safeParse({ id: 'aa31bae5-79f6-497e-9df5-ba7ebda42fc1', body: ' ' }).success).toBe(false));
  it('caps attachments at 5 MB', () => { const bytes = new Uint8Array(supportFileLimit + 1); bytes.set([137,80,78,71,13,10,26,10]); expect(() => validateSupportFile(bytes, 'image/png')).toThrow('5 MB'); });
  it('rejects false MIME declarations', () => expect(() => validateSupportFile(new Uint8Array([1,2,3]), 'image/png')).toThrow());
  it('rejects active files', () => expect(() => validateSupportFile(new TextEncoder().encode('<script>'), 'text/html')).toThrow());
  it('accepts PNG signature', () => expect(() => validateSupportFile(new Uint8Array([137,80,78,71,13,10,26,10]), 'image/png')).not.toThrow());
});
