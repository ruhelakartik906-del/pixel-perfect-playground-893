import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPendingEmployeeInvitation, INVITATION_REDIRECT_URL } from '@/lib/admin-invitation';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), from: vi.fn(), getUser: vi.fn(), invite: vi.fn(), recovery: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { auth: {
  admin: { getUserById: mocks.getUser, inviteUserByEmail: mocks.invite }, resetPasswordForEmail: mocks.recovery,
} } }));
import { resendEmployeeInvitation } from '@/lib/admin-users.functions';
const id = '00000000-0000-4000-8000-000000000001';
const email = 'invite@example.test';
const context = { userId: 'admin', supabase: { rpc: mocks.admin, from: mocks.from } };
const resend = resendEmployeeInvitation as unknown as (i: { context: typeof context; data: { user_id: string } }) => Promise<unknown>;
const profile = { email, account_status: 'pending' };
const invited = { id, email, invited_at: '2026-10-21' };

describe('Pending employee invitation resend', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.admin.mockResolvedValue({ data: true, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: invited }, error: null });
    mocks.invite.mockResolvedValue({ data: { user: invited }, error: null });
    mocks.recovery.mockResolvedValue({ data: {}, error: null });
    mocks.from.mockImplementation((table: string) => {
      const result = { data: table === 'profiles' ? profile : [{ role: 'employee' }], error: null };
      const query = { select: () => query, eq: () => query, single: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    });
  });
  it('sends a renewed Auth invite to the public acceptance page without account setup writes', async () => {
    expect(await resend({ context, data: { user_id: id } })).toEqual({ sent: true });
    expect(mocks.invite).toHaveBeenCalledWith(email, { redirectTo: 'https://pixel-perfect-playground-893.lovable.app/accept-invitation' });
    expect(mocks.recovery).not.toHaveBeenCalled();
    expect(mocks.from.mock.calls.map(call => call[0])).toEqual(['profiles', 'user_roles']);
  });
  it('renews password setup for an already-confirmed pending invitee without creating another account', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...invited, email_confirmed_at: '2026-10-21' } }, error: null });
    await resend({ context, data: { user_id: id } });
    expect(mocks.recovery).toHaveBeenCalledWith(email, { redirectTo: INVITATION_REDIRECT_URL });
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('denies non-admin callers before reading Auth or sending mail', async () => {
    mocks.admin.mockResolvedValue({ data: false, error: null });
    await expect(resend({ context, data: { user_id: id } })).rejects.toThrow('Super Admin');
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.invite).not.toHaveBeenCalled();
  });
  it.each(['active', 'blocked'])('excludes %s employees', status => {
    expect(isPendingEmployeeInvitation({ ...profile, account_status: status }, ['employee'], invited)).toBe(false);
  });
  it('excludes public registrations', () => {
    expect(isPendingEmployeeInvitation(profile, ['employee'], { email })).toBe(false);
  });
  it.each([['client'], ['employee', 'super_admin'], ['employee', 'manager']])('excludes non-employee or elevated roles %j', (...roles) => {
    expect(isPendingEmployeeInvitation(profile, roles, invited)).toBe(false);
  });
  it('fails closed on a mismatched Auth identity', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...invited, email: 'other@example.test' } }, error: null });
    await expect(resend({ context, data: { user_id: id } })).rejects.toThrow('pending invited employees');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('reports mail failure rather than success', async () => {
    mocks.invite.mockResolvedValue({ data: {}, error: { message: 'Email rate limit exceeded' } });
    await expect(resend({ context, data: { user_id: id } })).rejects.toThrow('Email rate limit');
  });
});