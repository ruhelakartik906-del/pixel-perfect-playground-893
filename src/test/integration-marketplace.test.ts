import { describe, expect, it } from 'vitest';
import { connectionCapacity, defaultPolicy, nonceDigest, policyInput } from '@/lib/integration-marketplace';

describe('Marketplace policy rules', () => {
  it('zero prevents new connections', () => expect(connectionCapacity(0, 0)).toBe(false));
  it('null is unlimited', () => expect(connectionCapacity(1000001, null)).toBe(true));
  it('custom caps reject the boundary', () => { expect(connectionCapacity(1, 2)).toBe(true); expect(connectionCapacity(2, 2)).toBe(false); });
  it('rejects negative connection caps', () => expect(policyInput.safeParse({ ...defaultPolicy('whatsapp'), max_connections: -1 }).success).toBe(false));
  it('rejects unknown provider IDs', () => expect(policyInput.safeParse({ ...defaultPolicy('whatsapp'), provider: 'shared_account' }).success).toBe(false));
  it('separates all plans from no permitted plans', () => { expect(policyInput.parse(defaultPolicy('zoom')).plan_ids).toBe(null); expect(policyInput.parse({ ...defaultPolicy('zoom'), plan_ids: [] }).plan_ids).toEqual([]); });
  it('hashes OAuth correlation rather than storing it as plaintext', async () => { const a = await nonceDigest('attempt-a'); expect(a).toHaveLength(64); expect(a).not.toBe('attempt-a'); expect(await nonceDigest('attempt-b')).not.toBe(a); });
});