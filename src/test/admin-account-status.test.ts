import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  let validate = (data: unknown) => data;
  const builder = {
    middleware: () => builder,
    inputValidator: (fn: typeof validate) => { validate = fn; return builder; },
    handler: (fn: (args: any) => unknown) => async (args: any) => fn({ ...args, data: validate(args.data) }),
  };
  return builder;
} }));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: vi.fn() }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: mocks.from } }));
import { setUserAccountStatus } from '@/lib/admin-users.functions';

const context = { userId: '00000000-0000-4000-8000-000000000001', supabase: { rpc: mocks.rpc } };
const target = '079d6dd9-e476-4aa5-8aaf-f61e737fa510';
const change = setUserAccountStatus as unknown as (args: { context: typeof context; data: { user_id: string; status: string } }) => Promise<unknown>;

describe('Admin account status authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const query = { update: mocks.update, eq: mocks.eq, select: mocks.select, single: mocks.single };
    mocks.from.mockReturnValue(query); mocks.update.mockReturnValue(query); mocks.eq.mockReturnValue(query); mocks.select.mockReturnValue(query);
    mocks.single.mockResolvedValue({ data: { id: target, account_status: 'blocked' }, error: null });
  });
  it.each(['active', 'blocked'])('allows an authorized Super Admin to save %s only on the target', async status => {
    mocks.single.mockResolvedValue({ data: { id: target, account_status: status }, error: null });
    expect(await change({ context, data: { user_id: target, status } })).toEqual({ id: target, account_status: status });
    expect(mocks.rpc).toHaveBeenCalledWith('routing_admin');
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.update).toHaveBeenCalledWith({ account_status: status });
    expect(mocks.eq).toHaveBeenCalledWith('id', target);
  });
  it('denies non-admin and inactive-admin authorization before any privileged writes', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(change({ context, data: { user_id: target, status: 'active' } })).rejects.toThrow('Active Super Admin');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('fails closed when the authorization check fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(change({ context, data: { user_id: target, status: 'active' } })).rejects.toThrow('Active Super Admin');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects self status changes', async () => {
    await expect(change({ context, data: { user_id: context.userId, status: 'blocked' } })).rejects.toThrow('own account');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not accept an unsupported status', async () => {
    await expect(change({ context, data: { user_id: target, status: 'pending' } })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not claim a save when no profile was updated', async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    await expect(change({ context, data: { user_id: target, status: 'blocked' } })).rejects.toThrow('not saved');
  });
});