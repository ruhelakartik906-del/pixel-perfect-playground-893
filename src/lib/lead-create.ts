import { z } from 'zod';
export const leadCreateSchema = z.object({
  stage_id: z.string().uuid(), source_id: z.string().uuid().nullable(), company_id: z.string().uuid().nullable(),
  customer_name: z.string().trim().min(1, 'Customer name is required').max(200),
  country_code: z.string().regex(/^\+[1-9]\d{0,3}$/, 'Enter a country code'),
  mobile: z.string().trim().regex(/^\d{6,14}$/, 'Enter a valid mobile number'),
  email: z.union([z.literal(''), z.string().trim().email().max(255)]),
  business_name: z.string().trim().max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  lead_from: z.string().trim().max(200), label: z.string().trim().max(100), estimate_amount: z.coerce.number().finite().min(0),
  reference: z.string().trim().max(500), address: z.string().trim().max(2000), outcome: z.enum(['open', 'won', 'lost']),
}).strict().refine(v => `${v.country_code}${v.mobile}`.length <= 16, 'Phone number must contain at most 15 digits');
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export function leadCreateRecord(data: LeadCreateInput, pipelineId: string, creator: string) {
  return { customer_name: data.customer_name, phone: `${data.country_code}${data.mobile}`, email: data.email, business_name: data.business_name,
    source_id: data.source_id, company_id: data.company_id, stage_id: data.stage_id, pipeline_id: pipelineId, created_by: creator,
    status: data.outcome, form_answers: { 'Lead From': data.lead_from, Date: data.date, Label: data.label, 'Estimate Amount': data.estimate_amount, Reference: data.reference, Address: data.address } };
}