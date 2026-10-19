import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Opt-in live regression checks against removable QA records. Sessions stay outside
// the project; ordinary test runs neither authenticate nor mutate hosted data.
const enabled = Boolean(process.env.AUTOMATION_QA_DIR);
describe.skipIf(!enabled)('Lead Created executor: authenticated QA records', () => {
  const directory = process.env.AUTOMATION_QA_DIR ?? '';
  function fixture(name: string) {
    return JSON.parse(readFileSync(`${directory}/${name}.json`, 'utf8'));
  }
  async function rows(account: string, path: string) {
    const session = fixture(`${account}-session`).session;
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '', Authorization: `Bearer ${session.access_token}` },
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  it('creates exactly one task assigned to the lead user in the same company', async () => {
    const ids = fixture('ids');
    const tasks = await rows('employee', `crm_work_items?lead_id=eq.${ids.lead}`);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: ids.task, assigned_to: ids.user, company_id: ids.company, lead_id: ids.lead, kind: 'task', created_by: ids.admin });
  });
  it('logs success with the actual task identifier', async () => {
    const ids = fixture('ids');
    const logs = await rows('admin', `automation_executions?lead_id=eq.${ids.lead}&workflow_id=eq.${ids.workflow}`);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'success', task_ids: [ids.task], company_id: ids.company });
  });
  it('never executes paused workflows', async () => {
    const ids = fixture('ids');
    expect(await rows('admin', `automation_executions?workflow_id=eq.${ids.paused}`)).toEqual([]);
  });
  it('skips unmatched conditions without tasks', async () => {
    const ids = fixture('ids');
    const logs = await rows('admin', `automation_executions?workflow_id=eq.${ids.mismatch}&lead_id=eq.${ids.lead}`);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'skipped', task_ids: [] });
  });
  it('creates no task for an unassigned lead', async () => {
    const ids = fixture('ids');
    expect(await rows('admin', `crm_work_items?lead_id=eq.${ids.unassigned}`)).toEqual([]);
  });
  it('creates no task for a company-ineligible assignee', async () => {
    const ids = fixture('ids');
    expect(await rows('admin', `crm_work_items?lead_id=eq.${ids.foreignlead}`)).toEqual([]);
  });
  it('keeps execution logs private from the employee', async () => {
    const ids = fixture('ids');
    expect(await rows('employee', `automation_executions?lead_id=eq.${ids.lead}`)).toEqual([]);
  });
});