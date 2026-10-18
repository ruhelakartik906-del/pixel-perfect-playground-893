import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invitationSchema, validateInvitationRedirect } from '@/lib/admin-invitation';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), invite: vi.fn(), setup: vi.fn(), adminFrom: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => new Request('https://routiva.test/', { headers: { origin: 'https://routiva.test' } }) }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { auth: { admin: { inviteUserByEmail: mocks.invite } }, rpc: mocks.setup, from: mocks.adminFrom } }));
import { inviteUser, saveMailbox, disconnectMailbox } from '@/lib/admin-users.functions';
const context = { userId: '00000000-0000-4000-8000-000000000001', supabase: { rpc: mocks.rpc, from: mocks.from } };
const draft: ReturnType<typeof invitationSchema.parse> = { email: 'invite@example.test', full_name: 'Invited user', phone: '', role: 'employee', access_role_id: null, company_id: null, redirect_to: 'https://routiva.test/login' };
type Invocation = (input: { context: typeof context; data: typeof draft }) => Promise<unknown>;
const invite = inviteUser as unknown as Invocation;

describe('Administrative invitation safeguards', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: true, error: null }); mocks.invite.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null }); mocks.setup.mockResolvedValue({ data: 'new-user', error: null }); });
  it('allows a standard invitation without creating company membership', async () => {
    expect(invitationSchema.parse(draft).company_id).toBeNull();
    expect(await invite({ context, data: draft })).toEqual({ id: 'new-user' });
    expect(mocks.setup).toHaveBeenCalledWith('admin_complete_invitation', expect.objectContaining({ _actor: context.userId, _user: 'new-user', _role: 'employee' }));
    expect(mocks.setup.mock.calls[0]?.[1]).not.toHaveProperty('_company');
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it.each(['pending','blocked'])('denies %s administrators before any privileged operation', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    for (const endpoint of [inviteUser, saveMailbox, disconnectMailbox]) {
      await expect((endpoint as unknown as Invocation)({ context, data: draft })).rejects.toThrow('Active Super Admin');
    }
    expect(mocks.rpc).toHaveBeenCalledWith('routing_admin');
    expect(mocks.invite).not.toHaveBeenCalled(); expect(mocks.setup).not.toHaveBeenCalled(); expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it('fails closed when authorization cannot be checked', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(invite({ context, data: draft })).rejects.toThrow('Active Super Admin');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('rejects a missing company before sending an invitation', async () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) }; mocks.from.mockReturnValue(query);
    await expect(invite({ context, data: { ...draft, company_id: '00000000-0000-4000-8000-000000000002' } })).rejects.toThrow('active company');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('rejects a missing permission role before sending an invitation', async () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) }; mocks.from.mockReturnValue(query);
    await expect(invite({ context, data: { ...draft, access_role_id: '00000000-0000-4000-8000-000000000002' } })).rejects.toThrow('permission role');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('does not report success when atomic setup fails', async () => {
    mocks.setup.mockResolvedValue({ data: null, error: { message: 'membership failure' } });
    await expect(invite({ context, data: draft })).rejects.toThrow('account setup did not complete');
    expect(mocks.setup).toHaveBeenCalledTimes(1); expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it('does not run setup after the invitation provider rejects the request', async () => {
    mocks.invite.mockResolvedValue({ data: { user: null }, error: { message: 'Invite unavailable' } });
    await expect(invite({ context, data: draft })).rejects.toThrow('Invite unavailable');
    expect(mocks.setup).not.toHaveBeenCalled();
  });
  it.each(['https://evil.test/login','https://routiva.test/admin','https://routiva.test/login?next=evil','https://routiva.test/login#token','https://user:pass@routiva.test/login'])('rejects unsafe return address %s', address => {
    expect(() => validateInvitationRedirect(address, 'https://routiva.test')).toThrow('Invalid invitation');
  });
  it('accepts only the existing same-origin login return address', () => {
    expect(() => validateInvitationRedirect(draft.redirect_to, 'https://routiva.test')).not.toThrow();
    expect(() => validateInvitationRedirect(draft.redirect_to, null)).toThrow();
  });
});