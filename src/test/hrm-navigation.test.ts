import { describe, it, expect } from 'vitest';
import { adminNav } from '@/components/admin/nav';
describe('HRM navigation scope', () => {
  it('exposes only the six requested HRM pages in order', () => {
    expect(adminNav.find(group => group.label === 'HRM')?.items.map(item => item.path)).toEqual([
      'hrm/employees', 'hrm/attendance', 'hrm/holidays', 'hrm/leave-management', 'hrm/meetings', 'hrm/announcements',
    ]);
  });
});