import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), password: vi.fn(), rpc: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { acceptEmployeeInvitation } from '@/lib/auth-access.functions';

const id = '00000000-0000-4000-8000-000000000001';
const query = { select: () => query, eq: () => query, single: mocks.profile };
const context = { userId: id, supabase: { from: () => query, auth: { getUser: mocks.user, updateUser: mocks.password }, rpc: mocks.rpc } };
const accept = acceptEmployeeInvitation as unknown as (input: { context: typeof context; data: { password: string; confirmPassword: string } }) => Promise<unknown>;
const data = { password: 'Only-a-test-password', confirmPassword: 'Only-a-test-password' };

describe('Employee invitation acceptance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ data: { user: { id, invited_at: '2026-10-20', email_confirmed_at: '2026-10-20' } }, error: null });
    mocks.profile.mockResolvedValue({ data: { account_status: 'pending' }, error: null });
    mocks.password.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: id, error: null });
  });
  it('activates only the verified caller after successful password setup', async () => {
    expect(await accept({ context, data })).toEqual({ accepted: true });
    expect(mocks.password).toHaveBeenCalledWith({ password: data.password });
    expect(mocks.rpc).toHaveBeenCalledWith('accept_employee_invitation');
    expect(mocks.password.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0] ?? 0);
  });
  it.each(['active', 'blocked'])('rejects %s accounts before password or access changes', async account_status => {
    mocks.profile.mockResolvedValue({ data: { account_status }, error: null });
    await expect(accept({ context, data })).rejects.toThrow('verified pending invitation');
    expect(mocks.password).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not accept an unconfirmed email', async () => {
    mocks.user.mockResolvedValue({ data: { user: { invited_at: '2026-10-20', email_confirmed_at: null } }, error: null });
    await expect(accept({ context, data })).rejects.toThrow(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not accept public registration as an invitation', async () => {
    mocks.user.mockResolvedValue({ data: { user: { email_confirmed_at: '2026-10-20' } }, error: null });
    await expect(accept({ context, data })).rejects.toThrow(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('keeps pending access when password setup fails', async () => {
    mocks.password.mockResolvedValue({ error: { message: 'expired' } });
    await expect(accept({ context, data })).rejects.toThrow('password could not be saved');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});