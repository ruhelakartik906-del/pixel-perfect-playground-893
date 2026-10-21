import { describe, expect, it } from 'vitest';
import { leadCreateSchema, leadCreateRecord } from '@/lib/lead-create';
const input = { stage_id: '11111111-1111-4111-8111-111111111111', source_id: null, company_id: null, customer_name: 'Customer', country_code: '+91', mobile: '9876543210', email: '', business_name: 'Company', date: '2026-10-21', lead_from: 'Manual referral', label: 'Interested', estimate_amount: 1250, reference: 'Ref 1', address: 'Address 1', outcome: 'open' };
describe('Shared Add Lead data', () => {
  it('preserves every optional reference field in the existing lead record', () => { const data = leadCreateSchema.parse(input); expect(leadCreateRecord(data, 'pipeline', 'creator').form_answers).toEqual({ 'Lead From': 'Manual referral', Date: '2026-10-21', Label: 'Interested', 'Estimate Amount': 1250, Reference: 'Ref 1', Address: 'Address 1' }); });
  it('combines country code and mobile number without losing digits', () => expect(leadCreateRecord(leadCreateSchema.parse(input), 'pipeline', 'creator').phone).toBe('+919876543210'));
  it('rejects invalid customer inputs', () => { expect(leadCreateSchema.safeParse({ ...input, customer_name: '' }).success).toBe(false); expect(leadCreateSchema.safeParse({ ...input, mobile: 'fake' }).success).toBe(false); });
});