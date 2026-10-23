import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

vi.mock('@/lib/user-phase2.functions', () => ({ loadUserPhase2: vi.fn() }));
vi.mock('@/lib/user-phase4.functions', () => ({ loadCommercial: vi.fn(), loadMyAccount: vi.fn() }));
import { phase2Query } from '@/lib/user-phase2-query';
import { commercialQuery } from '@/lib/user-phase4-query';

describe('Shared navigation cache', () => {
  for (const [name, query] of [['work', phase2Query], ['commercial', commercialQuery]] as const) {
    it(`${name} reuses loader data on mount and refetches after invalidation`, async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      let version = 0;
      const fetch = vi.fn(async () => ({ version: ++version }));
      const options = { queryKey: query.queryKey, staleTime: query.staleTime, queryFn: fetch };
      await client.ensureQueryData(options);
      const observer = new QueryObserver(client, options);
      const unsubscribe = observer.subscribe(() => {});
      await client.ensureQueryData(options);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(observer.getCurrentResult().data).toEqual({ version: 1 });
      await client.invalidateQueries({ queryKey: query.queryKey });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(observer.getCurrentResult().data).toEqual({ version: 2 });
      unsubscribe();
      client.clear();
    });
    it(`${name} never shares cached rows between separate clients`, async () => {
      const first = new QueryClient();
      const second = new QueryClient();
      first.setQueryData(query.queryKey, { owner: 'first' });
      expect(second.getQueryData(query.queryKey)).toBeUndefined();
      first.clear(); second.clear();
    });
  }
});