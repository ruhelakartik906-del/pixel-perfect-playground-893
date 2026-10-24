import { z } from 'zod';

export const installationSchema = z.object({
  client_name: z.string().trim().min(1).max(120), company_name: z.string().trim().min(1).max(160),
  admin_email: z.string().trim().email().max(255).transform(v => v.toLowerCase()),
  admin_phone: z.string().trim().max(30).refine(v => !v || /^\+?[0-9 ()-]{7,30}$/.test(v), 'Enter a valid phone number').default(''),
  crm_url: z.string().trim().url().max(500).transform(v => v.replace(/\/+$/, '').toLowerCase()).refine(v => /^https:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:443)?$/.test(v), 'Use an HTTPS installation address without a path'),
  validity_years: z.union([z.literal(1), z.literal(2)]),
});
export type Installation = import('@/integrations/supabase/types').Database['public']['Tables']['crm_installations']['Row'];
export type Audit = import('@/integrations/supabase/types').Database['public']['Tables']['crm_installation_audit']['Row'];
export function installationStatus(row: Installation, now = new Date()) {
  return new Date(row.expires_at) <= now ? 'expired' : row.license_status;
}
export const statusLabels: Record<string, string> = { active: 'Active', suspended: 'Suspended', expired: 'Expired', setup_required: 'Setup Required' };
export function addLicenseYears(value: string, years: 1 | 2) {
  const date = new Date(new Date(value).getTime() + 19800000);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return new Date(date.getTime() - 19800000).toISOString();
}
export function renewalExpiry(expiry: string, years: 1 | 2, now = new Date()) {
  return addLicenseYears(new Date(expiry) > now ? expiry : now.toISOString(), years);
}
export function filterInstallations(rows: Installation[], search: string, status: string, soon: boolean, now = new Date()) {
  const end = now.getTime() + 30 * 86400000;
  return rows.filter(row => (!search || [row.client_name,row.company_name,row.admin_email,row.installation_id].join(' ').toLowerCase().includes(search.toLowerCase())) &&
    (status === 'all' || installationStatus(row, now) === status) &&
    (!soon || (new Date(row.expires_at).getTime() > now.getTime() && new Date(row.expires_at).getTime() <= end)));
}
export const licenseDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });