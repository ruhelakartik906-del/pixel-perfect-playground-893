import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { verifyIntakeToken } from '@/lib/make-intake';

afterEach(() => vi.unstubAllGlobals());
it('accepts matching tokens and rejects wrong or empty tokens using the real digest comparison', async () => {
  vi.stubGlobal('crypto', webcrypto);
  expect(await verifyIntakeToken('test-only-credential', 'test-only-credential')).toBe(true);
  expect(await verifyIntakeToken('incorrect-test-credential', 'test-only-credential')).toBe(false);
  expect(await verifyIntakeToken('', 'test-only-credential')).toBe(false);
});