import { describe, expect, it, vi } from 'vitest';
import { readAllPages } from '@/lib/backend-read';

describe('Complete authoritative collection reads', () => {
  it('retains records and history after the first 1000 rows', async () => {
    const records = Array.from({ length: 2007 }, (_, id) => ({ id, created_at: '2026-10-18', creator: `user-${id}` }));
    const fetchPage = vi.fn(async (start: number, end: number) => ({ data: records.slice(start, end + 1), error: null }));
    const result = await readAllPages(fetchPage);
    expect(result).toHaveLength(2007);
    expect(result[2006]).toEqual(records[2006]);
    expect(new Set(result.map(row => row.id)).size).toBe(2007);
    expect(fetchPage.mock.calls).toEqual([[0,999],[1000,1999],[2000,2999]]);
  });
  it('does not return a misleading partial success when a later page fails', async () => {
    const fetchPage = vi.fn(async (start: number) => start === 0
      ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: 'Read denied' } });
    await expect(readAllPages(fetchPage)).rejects.toThrow('Read denied');
  });
  it('finishes exact page boundaries with an empty final read', async () => {
    const fetchPage = vi.fn(async (start: number) => ({ data: start === 0 ? Array.from({ length: 1000 }, (_, id) => id) : [], error: null }));
    expect(await readAllPages(fetchPage)).toHaveLength(1000);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});