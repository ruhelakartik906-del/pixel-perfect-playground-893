import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { createSupportTicket } from '@/lib/support.functions';
const id = 'aa31bae5-79f6-497e-9df5-ba7ebda42fc1';
const rpc = vi.fn(), single = vi.fn(), eq = vi.fn();
const query = { select: () => query, eq, single };
const context = { userId: 'owner', supabase: { rpc, from: vi.fn(() => query) } };
const create = createSupportTicket as unknown as (v: {context: typeof context; data: unknown}) => Promise<string>;
describe('Support save confirmation', () => {
 beforeEach(() => { vi.clearAllMocks(); eq.mockReturnValue(query); });
 it('returns the actual saved ticket ID after owner readback', async () => { rpc.mockResolvedValue({data:id,error:null}); single.mockResolvedValue({data:{id},error:null}); expect(await create({context,data:{}})).toBe(id); expect(eq).toHaveBeenCalledWith('user_id','owner'); });
 it('does not report a rejected insert as success', async () => { rpc.mockResolvedValue({data:null,error:{message:'Company membership required'}}); await expect(create({context,data:{}})).rejects.toThrow('Company membership required'); expect(single).not.toHaveBeenCalled(); });
 it('rejects missing saved IDs', async () => { rpc.mockResolvedValue({data:null,error:null}); await expect(create({context,data:{}})).rejects.toThrow('not confirmed'); });
 it('does not report success when the saved ticket cannot be read', async () => { rpc.mockResolvedValue({data:id,error:null}); single.mockResolvedValue({data:null,error:{message:'denied'}}); await expect(create({context,data:{}})).rejects.toThrow('could not be loaded'); });
});