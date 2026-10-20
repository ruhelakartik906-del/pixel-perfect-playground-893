import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Explicit opt-in only; private sessions and removable fixture IDs stay outside the project.
const directory = process.env['AUTOMATION_DEAL_QA_DIR'];
describe.skipIf(!directory)('Deal Created → Create Task: isolated authorized flow', () => {
  const ids = { company: randomUUID(), pipeline: randomUUID(), stage: randomUUID(), workflow: randomUUID(), paused: randomUUID(), mismatch: randomUUID(), deal: '', admin: 'aa31bae5-79f6-497e-9df5-ba7ebda42fc1', user: '079d6dd9-e476-4aa5-8aaf-f61e737fa510' };
  const title = `QA Deal Task ${ids.workflow}`;
  type Row = { id: string; [key: string]: unknown };
  let tasks: Row[], adminTasks: Row[], logs: Row[], paused: Row[], mismatch: Row[], privateLogs: Row[], history: Row[];
  let denied = 0;
  async function request(account: string, path: string, method = 'GET', body?: unknown) {
    const session = JSON.parse(readFileSync(`${directory}/${account}-session.json`, 'utf8')).session;
    const response = await fetch(`${process.env['VITE_SUPABASE_URL']}/rest/v1/${path}`, {
      method, headers: { apikey: process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '', Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`QA ${method} ${path.split('?')[0]} failed (${response.status})`);
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }
  beforeAll(async () => {
    writeFileSync(`${directory}/ids.json`, JSON.stringify({ ...ids, title }));
    expect((await request('admin', 'rpc/routing_admin', 'POST', {}))).toBe(true);
    expect((await request('employee', `profiles?id=eq.${ids.user}`))[0].account_status).toBe('active');
    await request('admin', 'companies', 'POST', { id: ids.company, name: `QA Deal Automation ${ids.company}` });
    await request('admin', 'company_members', 'POST', { company_id: ids.company, user_id: ids.user });
    await request('admin', 'crm_pipelines', 'POST', { id: ids.pipeline, name: `QA Deal ${ids.pipeline}`, kind: 'deal' });
    await request('admin', 'crm_stages', 'POST', { id: ids.stage, pipeline_id: ids.pipeline, kind: 'deal', name: `QA Deal Stage ${ids.stage}` });
    const workflow = { trigger: 'deal_created', conditions: [{ field: 'stage', op: 'equals', value: ids.stage }, { field: 'assigned_user', op: 'equals', value: ids.user }], actions: [{ type: 'create_task', delayHours: 0, note: title }], created_by: ids.admin };
    await request('admin', 'automation_workflows', 'POST', [
      { ...workflow, id: ids.workflow, name: `QA Deal ${ids.workflow}`, status: 'active' },
      { ...workflow, id: ids.paused, name: `QA Paused ${ids.paused}`, status: 'paused' },
      { ...workflow, id: ids.mismatch, name: `QA Mismatch ${ids.mismatch}`, status: 'active', conditions: [{ field: 'stage', op: 'not equals', value: ids.stage }] },
    ]);
    ids.deal = await request('employee', 'rpc/user_deal_action', 'POST', { _action: 'save', _payload: { company_id: ids.company, lead_id: null, stage_id: ids.stage, title: `QA Created Deal ${ids.workflow}`, amount: 100, currency: 'INR', status: 'open', notes: 'QA final submitted note' } });
    writeFileSync(`${directory}/ids.json`, JSON.stringify({ ...ids, title }));
    tasks = await request('employee', `crm_work_items?deal_id=eq.${ids.deal}`);
    adminTasks = await request('admin', `crm_work_items?deal_id=eq.${ids.deal}`);
    logs = await request('admin', `automation_executions?workflow_id=eq.${ids.workflow}&deal_id=eq.${ids.deal}`);
    history = await request('employee', `crm_work_history?work_id=eq.${tasks[0]?.id}`);
    paused = await request('admin', `automation_executions?workflow_id=eq.${ids.paused}`);
    mismatch = await request('admin', `automation_executions?workflow_id=eq.${ids.mismatch}&deal_id=eq.${ids.deal}`);
    privateLogs = await request('employee', `automation_executions?deal_id=eq.${ids.deal}`);
    const [deal] = await request('employee', `deals?id=eq.${ids.deal}`);
    await request('employee', 'rpc/user_deal_action', 'POST', { _action: 'note', _payload: { id: ids.deal, updated_at: deal.updated_at, note: 'QA update must not create another task' } });
    expect(await request('employee', `crm_work_items?deal_id=eq.${ids.deal}`)).toEqual(tasks);
    const session = JSON.parse(readFileSync(`${directory}/employee-session.json`, 'utf8')).session;
    denied = (await fetch(`${process.env['VITE_SUPABASE_URL']}/rest/v1/rpc/automation_execute_record_event`, { method: 'POST', headers: { apikey: process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '', Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ _record: ids.deal, _trigger: 'deal_created', _event_key: 'deal_created' }) })).status;
  }, 60000);
  it('creates exactly one canonical task for the eligible Deal employee', () => {
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ kind: 'task', company_id: ids.company, assigned_to: ids.user, deal_id: ids.deal, lead_id: null, created_by: ids.admin });
  });
  it('exposes the same task to authorized Admin', () => expect(adminTasks).toEqual(tasks));
  it('logs one successful Deal creation event with the real task identifier', () => {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'success', event_key: 'deal_created', deal_id: ids.deal, lead_id: null, task_ids: [tasks[0]?.id] });
  });
  it('records task creator history', () => expect(history[0]).toMatchObject({ work_id: tasks[0]?.id, actor_id: ids.admin, action: 'created' }));
  it('never executes paused workflows', () => expect(paused).toEqual([]));
  it('reuses conditions and skips mismatched workflows without tasks', () => expect(mismatch[0]).toMatchObject({ status: 'skipped', task_ids: [] }));
  it('keeps Admin execution logs private from employees', () => expect(privateLogs).toEqual([]));
  it('denies direct executor replay by a user', () => expect([401, 403, 404]).toContain(denied));
});