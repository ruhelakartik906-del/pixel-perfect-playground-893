import { z } from 'zod';
export const invitationSchema = z.object({
  email: z.string().trim().email().max(255), full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).default(''), role: z.enum(['super_admin', 'manager', 'employee', 'client']),
  access_role_id: z.string().uuid().nullable(), company_id: z.string().uuid().nullable(), redirect_to: z.string().url(),
});
export function validateInvitationRedirect(address: string, origin: string | null) {
  const url = new URL(address);
  if (!origin || url.origin !== origin || url.pathname !== '/login' || url.search || url.hash || url.username || url.password) {
    throw new Error('Invalid invitation return address');
  }
}