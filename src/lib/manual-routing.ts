import { z } from 'zod';

export const manualRoutingLeadSchema = z.object({
  request_id: z.string().uuid(),
  customer_name: z.string().trim().min(1, 'Client name is required').max(200),
  country_code: z.string().regex(/^\+[1-9]\d{0,3}$/, 'Enter a country code'),
  mobile: z.string().trim().regex(/^\d{6,14}$/, 'Enter a valid mobile number'),
  email: z.union([z.literal(''), z.string().trim().email().max(255)]),
  business_name: z.string().trim().max(200), business_category: z.string().trim().max(120),
  address: z.string().trim().max(2000), city: z.string().trim().max(120), state: z.string().trim().max(120),
  service: z.enum(['Meta Ads', 'Google Ads', 'Website', 'SEO', 'Social Media Marketing', 'Other']),
  notes: z.string().trim().max(2000), source: z.string().trim().min(1).max(120).default('Manual'),
  priority: z.enum(['low', 'medium', 'high']),
  company_id: z.string().uuid().nullable(), assign_user: z.string().uuid().nullable(),
}).strict().refine(v => `${v.country_code}${v.mobile}`.length <= 16, 'Phone number must contain at most 15 digits');