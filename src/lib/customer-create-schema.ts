import { z } from "zod";

export const customerCreateSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(120),
  full_name: z.string().trim().min(1, "Customer name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z.string().trim().max(40).optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
}).strict();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerCreateResult = { company_id: string; user_id: string };