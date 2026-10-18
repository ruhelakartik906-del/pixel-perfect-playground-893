import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
    return builder;
  },
}));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { loadMessaging, sendChat } from '@/lib/messaging.functions';

const rpc = vi.fn();
const from = vi.fn();
const context = { userId: 'client-user', supabase: { rpc, from } };
const load = loadMessaging as unknown as (input: { context: typeof context }) => Promise<{ available: boolean; people: unknown[]; companies: unknown[] }>;
const send = sendChat as unknown as (input: { context: typeof context; data: { peer: string; group: null; body: string; client: string } }) => Promise<string>;

describe('Team Chat access boundary', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('returns an empty state for inactive users without querying people or messages', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await load({ context });
    expect(result.available).toBe(false);
    expect(result.people).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
  it('loads active personal clients through scoped contact discovery, without a company directory', async () => {
    rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'messaging_allowed' ? true : name === 'chat_people' ? [{ id: 'admin' }] : false, error: null }));
    from.mockImplementation(() => {
      const query = { select: () => query, order: () => query, range: () => Promise.resolve({ data: [], error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
      return query;
    });
    const result = await load({ context });
    expect(result.available).toBe(true);
    expect(result.people).toEqual([{ id: 'admin' }]);
    expect(result.companies).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('chat_people');
    expect(from).not.toHaveBeenCalledWith('profiles');
    expect(from).not.toHaveBeenCalledWith('companies');
    expect(from).not.toHaveBeenCalledWith('company_members');
  });
  it('sends personal messages through the existing participant-authorized Admin chat RPC', async () => {
    rpc.mockResolvedValue({ data: 'persisted-message', error: null });
    expect(await send({ context, data: { peer: 'admin', group: null, body: 'Hello', client: 'retry-id' } })).toBe('persisted-message');
    expect(rpc).toHaveBeenCalledWith('chat_send', { _peer: 'admin', _group: null, _body: 'Hello', _client: 'retry-id' });
  });
  it('does not accept a denied participant send as successful', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Recipient access denied' } });
    await expect(send({ context, data: { peer: 'another-client', group: null, body: 'Hello', client: 'retry-id' } })).rejects.toThrow('Recipient access denied');
  });
});