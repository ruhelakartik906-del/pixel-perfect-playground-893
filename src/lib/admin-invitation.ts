import { z } from 'zod';
export const PUBLIC_APP_URL = 'https://pixel-perfect-playground-893.lovable.app';
export const INVITATION_REDIRECT_URL = `${PUBLIC_APP_URL}/accept-invitation`;
export function isPendingEmployeeInvitation(profile: { account_status: string; email: string }, roles: string[], user: { invited_at?: string; email?: string } | null) {
  return profile.account_status === 'pending' && roles.includes('employee') &&
    !roles.some(role => role === 'super_admin' || role === 'manager') &&
    Boolean(user?.invited_at && user.email?.toLowerCase() === profile.email.toLowerCase());
}
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