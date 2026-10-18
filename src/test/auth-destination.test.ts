import { describe, expect, it } from 'vitest';
import { authDestination, loginDestination } from '@/lib/auth-destination';
import { registerSchema } from '@/lib/auth-validation';

describe('verified login destinations', () => {
  it('sends active Super Admin to the existing Admin panel', () => {
    expect(authDestination('active', ['super_admin'])).toBe('/admin/dashboard');
  });
  it.each(['employee', 'manager', 'client'])('sends active %s to the user workspace', role => {
    expect(authDestination('active', [role])).toBe('/dashboard');
  });
  it('restricts blocked accounts even with a Super Admin role', () => {
    expect(authDestination('blocked', ['super_admin'])).toBe('/restricted');
  });
  it('keeps pending Super Admin out of Admin', () => {
    expect(authDestination('pending', ['super_admin'])).toBe('/pending-approval');
  });
  it('sends standard, pending and unassigned users to the personal User Dashboard', () => {
    expect(authDestination(null, ['client'])).toBe('/dashboard');
    expect(authDestination('pending', [])).toBe('/dashboard');
    expect(authDestination('active', [])).toBe('/dashboard');
    expect(authDestination('active', ['admin'])).toBe('/dashboard');
  });
  it.each(['//outside.test', '/\\outside.test', '/%2e%2e/admin/dashboard', '/admin/dashboard', '/login', '/register'])('rejects unsafe user redirect %s', path => {
    expect(loginDestination('/dashboard', path)).toBe('/dashboard');
  });
  it('preserves authorized user paths without overriding pending or blocked access', () => {
    expect(loginDestination('/dashboard', '/tasks?filter=today')).toBe('/tasks?filter=today');
    expect(loginDestination('/pending-approval', '/tasks')).toBe('/pending-approval');
    expect(loginDestination('/restricted', '/admin/dashboard')).toBe('/restricted');
  });
  it('requires the public signup fields without requiring or trusting company/role metadata', () => {
    const input = { firstName: 'Test', lastName: 'User', email: 'person@example.test', phone: '+919876543210', password: 'StrongPass123', confirmPassword: 'StrongPass123', terms: true, role: 'super_admin', company_id: 'unrelated' };
    const result = registerSchema.parse(input);
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('company_id');
    expect(result.firstName).toBe('Test');
    expect(result.lastName).toBe('User');
    for (const key of ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword']) {
      expect(registerSchema.safeParse({ ...input, [key]: '' }).success).toBe(false);
    }
  });
});