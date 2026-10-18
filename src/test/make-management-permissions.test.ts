import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn(), bootstrap: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/lib/make-management.server', () => ({ makeAdminClient: mocks.admin, importMakeBootstrap: mocks.bootstrap }));
import { changeMakeSource, generateMakeKey, loadMakeManagement, revokeMakeKey, saveMakeSource } from '@/lib/make-management.functions';
const context = { userId: '00000000-0000-4000-8000-000000000001', supabase: { rpc: mocks.rpc } };
type Invocation = (input: { context: typeof context; data: any }) => Promise<unknown>;
describe('Make.com active Super Admin controls', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(['standard','pending','blocked'])('denies %s accounts before private config access or mutation', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    for (const fn of [loadMakeManagement, generateMakeKey, revokeMakeKey, saveMakeSource, changeMakeSource]) {
      await expect((fn as unknown as Invocation)({ context, data: { id: context.userId, label: 'Test' } })).rejects.toThrow('Active Super Admin');
    }
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.bootstrap).not.toHaveBeenCalled();
  });
  it('fails closed on authorization errors', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: { message: 'unavailable' } });
    await expect((generateMakeKey as unknown as Invocation)({ context, data: { label: 'Test' } })).rejects.toThrow('Active Super Admin');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });
  it('saves source configuration only through the existing authorized source RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: context.userId, error: null });
    const data = { name: 'Test', platform: 'Facebook', company_id: context.userId, account_id: '1', page_id: '2', form_id: '3', campaign_id: '', ad_id: '', rule_id: null, active: true };
    expect(await (saveMakeSource as unknown as Invocation)({ context, data })).toBe(context.userId);
    expect(mocks.rpc).toHaveBeenCalledWith('make_source_action', { _action: 'save', _payload: data });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});