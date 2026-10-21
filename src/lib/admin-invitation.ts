import { z } from 'zod';
export const PUBLIC_APP_URL = 'https://pixel-perfect-playground-893.lovable.app';
export const INVITATION_REDIRECT_URL = `${PUBLIC_APP_URL}/login`;
export const invitationSchema = z.object({
  email: z.string().trim().email().max(255), full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).default(''), role: z.enum(['super_admin', 'manager', 'employee', 'client']),
  access_role_id: z.string().uuid().nullable(), company_id: z.string().uuid().nullable(), redirect_to: z.string().url(),
});
export function validateInvitationRedirect(address: string) {
  if (address !== INVITATION_REDIRECT_URL) {
    throw new Error('Invalid invitation return address');
  }
}