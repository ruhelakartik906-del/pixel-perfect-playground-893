import { describe, expect, it } from 'vitest';
import { contactLinks, formEntries, inPeriod, leadDetailsSchema, stageCategory, userLeadActionSchema } from '@/lib/user-crm';
const id = '11111111-1111-4111-8111-111111111111';
describe('User CRM safeguards', () => {
  it('today uses Asia/Kolkata at midnight', () => { expect(inPeriod('2026-10-16T19:00:00Z', 'today', new Date('2026-10-17T00:00:00Z'))).toBe(true); expect(inPeriod('2026-10-16T18:00:00Z', 'today', new Date('2026-10-17T00:00:00Z'))).toBe(false); });
  it('this month excludes previous months', () => { expect(inPeriod('2026-09-15T00:00:00Z', 'month', new Date('2026-10-17T00:00:00Z'))).toBe(false); });
  it('converted leads are not new', () => { expect(stageCategory('New', 'won')).toBe('converted'); });
  it('unknown stages do not fabricate contacted counts', () => { expect(stageCategory('Custom review', 'open')).toBe('other'); });
  it('preserves unknown nested form answers and values', () => { expect(formEntries({ budget: 5000, unusual_question: { answer: 'Custom answer' }, extras: ['a', 'b'] })).toEqual([{ label: 'budget', value: '5000' }, { label: 'unusual_question · answer', value: 'Custom answer' }, { label: 'extras · 1', value: 'a' }, { label: 'extras · 2', value: 'b' }]); });
  it('preserves Meta field array values', () => { expect(formEntries([{ name: 'service', values: ['CRM'] }])).toEqual([{ label: 'service · 1', value: 'CRM' }]); });
  it('only builds safe dialer and WhatsApp links', () => { expect(contactLinks('+91 98765 43210')).toEqual({ call: 'tel:+919876543210', whatsapp: 'https://wa.me/919876543210' }); expect(contactLinks('javascript:alert(1)')).toBeNull(); });
  it('rejects employee assignment fields in details', () => { expect(leadDetailsSchema.safeParse({ customer_name: 'A', phone: '', email: '', business_name: '', business_category: '', region: '', requirements: '', interest_level: '', assigned_to: id }).success).toBe(false); });
  it('rejects blank notes', () => { expect(userLeadActionSchema.safeParse({ id, updated_at: '2026-10-17T00:00:00Z', action: 'note', payload: { note: ' ' } }).success).toBe(false); });
  it('rejects mismatched mutation payloads', () => { expect(userLeadActionSchema.safeParse({ id, updated_at: '2026-10-17T00:00:00Z', action: 'stage', payload: { note: 'Call made' } }).success).toBe(false); });
});