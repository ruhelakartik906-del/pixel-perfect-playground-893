import { describe, expect, it } from 'vitest';
import { adminProfileSchema, businessSettingsSchema, credentialChangeSchema, settingsAdminAllowed } from '@/lib/settings-validation';

const business = { company_name: 'Example', email: '', phone: '', address: '', city: '', state: '', country: '', gstin: '', invoice_business_information: '', payment_instructions: '' };
describe('admin settings safeguards', () => {
  it('defaults new business settings to INR', () => expect(businessSettingsSchema.parse(business).default_currency).toBe('INR'));
  it('bounds configurable GST to 0–100 percent', () => {
    expect(businessSettingsSchema.safeParse({ ...business, tax_percentage: -1 }).success).toBe(false);
    expect(businessSettingsSchema.safeParse({ ...business, tax_percentage: 101 }).success).toBe(false);
    expect(businessSettingsSchema.parse({ ...business, tax_percentage: 18 }).tax_percentage).toBe(18);
  });
  it('accepts inclusive and exclusive tax preferences only', () => {
    expect(businessSettingsSchema.parse({ ...business, tax_preference: 'inclusive' }).tax_preference).toBe('inclusive');
    expect(businessSettingsSchema.parse({ ...business, tax_preference: 'exclusive' }).tax_preference).toBe('exclusive');
    expect(businessSettingsSchema.safeParse({ ...business, tax_preference: 'unknown' }).success).toBe(false);
  });
  it('requires an active Super Admin', () => {
    expect(settingsAdminAllowed(true, 'active')).toBe(true);
    expect(settingsAdminAllowed(false, 'active')).toBe(false);
    expect(settingsAdminAllowed(true, 'blocked')).toBe(false);
    expect(settingsAdminAllowed(true, 'pending')).toBe(false);
  });
  it('requires current password for both credential changes', () => {
    expect(credentialChangeSchema.safeParse({ kind: 'email', current_password: '', email: 'new@example.com', redirect_to: 'https://example.com/admin/login' }).success).toBe(false);
    expect(credentialChangeSchema.safeParse({ kind: 'password', current_password: '', password: 'new-password', confirm_password: 'new-password' }).success).toBe(false);
  });
  it('requires matching new passwords and forbids reusing the current password', () => {
    expect(credentialChangeSchema.safeParse({ kind: 'password', current_password: 'old-password', password: 'new-password', confirm_password: 'mismatch' }).success).toBe(false);
    expect(credentialChangeSchema.safeParse({ kind: 'password', current_password: 'same-password', password: 'same-password', confirm_password: 'same-password' }).success).toBe(false);
  });
  it('rejects invalid business email and GSTIN', () => {
    expect(businessSettingsSchema.safeParse({ ...business, email: 'invalid' }).success).toBe(false);
    expect(businessSettingsSchema.safeParse({ ...business, gstin: 'invalid' }).success).toBe(false);
  });
  it('profile input cannot supply another user ID or privilege fields', () => {
    expect(adminProfileSchema.parse({ full_name: 'Admin Name', phone: '', id: 'other-user', account_status: 'active', role: 'super_admin' })).toEqual({ full_name: 'Admin Name', phone: '' });
  });
});