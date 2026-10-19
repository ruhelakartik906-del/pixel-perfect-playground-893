import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Opt-in, authorized QA only. Credentials and removable IDs remain outside the project.
const directory = process.env['AUTOMATION_STAGE_QA_DIR'];
describe.skipIf(!directory)('Stage Changed → Create Task: isolated authorized flow', () => {
  const ids = { company: randomUUID(), pipeline: randomUUID(), first: randomUUID(), next: randomUUID(), lead: randomUUID(), workflow: randomUUID(), paused: randomUUID(), admin: 'aa31bae5-79f6-497e-9df5-ba7ebda42fc1', user: '079d6dd9-e476-4aa5-8aaf-f61e737fa510' };
  const title = `QA Stage Task ${ids.workflow}`;
  let initial: any[], tasks: any[], logs: any[], unchanged: any[], repeated: any[], finalTasks: any[], paused: any[], privateLogs: any[], history: any[];
  let blockedCall = 0;
  async function request(account: string, path: string, method = 'GET', body?: unknown) {
    const session = JSON.parse(readFileSync(`${directory}/${account}-session.json`, 'utf8')).session;
    const response = await fetch(`${process.env['VITE_SUPABASE_URL']}/rest/v1/${path}`, {
      method, headers: { apikey: process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '', Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path.split('?')[0]} failed: ${response.status} ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }
  async function stage(stage_id: string) {
    const [lead] = await request('employee', `leads?id=eq.${ids.lead}`);
    await request('employee', 'rpc/user_lead_action', 'POST', { _id: ids.lead, _updated_at: lead.updated_at, _action: 'stage', _payload: { stage_id } });
  }
  beforeAll(async () => {
    writeFileSync(`${directory}/ids.json`, JSON.stringify(ids));
    const [profile] = await request('admin', `profiles?id=eq.${ids.user}`);
    writeFileSync(`${directory}/original-profile.json`, JSON.stringify({ account_status: profile.account_status }));
    await request('admin', `profiles?id=eq.${ids.user}`, 'PATCH', { account_status: 'active' });
    await request('admin', 'companies', 'POST', { id: ids.company, name: `QA Automation Stage ${ids.company}` });
    await request('admin', 'company_members', 'POST', { company_id: ids.company, user_id: ids.user });
    await request('admin', 'crm_pipelines', 'POST', { id: ids.pipeline, name: `QA Stage ${ids.pipeline}`, kind: 'lead' });
    await request('admin', 'crm_stages', 'POST', [{ id: ids.first, pipeline_id: ids.pipeline, kind: 'lead', name: 'QA Initial' }, { id: ids.next, pipeline_id: ids.pipeline, kind: 'lead', name: 'QA Next' }]);
    const workflow = { trigger: 'stage_changed', conditions: [{ field: 'stage', op: 'equals', value: ids.next }, { field: 'assigned_user', op: 'equals', value: ids.user }], actions: [{ type: 'create_task', delayHours: 0, note: title }], created_by: ids.admin };
    await request('admin', 'automation_workflows', 'POST', [{ ...workflow, id: ids.workflow, name: `QA Stage ${ids.workflow}`, status: 'active' }, { ...workflow, id: ids.paused, name: `QA Paused ${ids.paused}`, status: 'paused' }]);
    await request('admin', 'leads', 'POST', { id: ids.lead, company_id: ids.company, pipeline_id: ids.pipeline, stage_id: ids.first, assigned_to: ids.user, customer_name: `QA Stage Lead ${ids.lead}`, created_by: ids.admin });
    initial = await request('admin', `automation_executions?workflow_id=eq.${ids.workflow}&lead_id=eq.${ids.lead}`);
    await stage(ids.next);
    tasks = await request('employee', `crm_work_items?lead_id=eq.${ids.lead}&title=eq.${encodeURIComponent(title)}`);
    logs = await request('admin', `automation_executions?workflow_id=eq.${ids.workflow}&lead_id=eq.${ids.lead}`);
    history = await request('employee', `crm_work_history?work_id=eq.${tasks[0]?.id}`);
    const [lead] = await request('employee', `leads?id=eq.${ids.lead}`);
    await request('employee', 'rpc/user_lead_action', 'POST', { _id: ids.lead, _updated_at: lead.updated_at, _action: 'note', _payload: { note: 'QA note-only save' } });
    await request('admin', `leads?id=eq.${ids.lead}`, 'PATCH', { requirements: 'QA unrelated field', automation_stage_revision: 900 });
    await stage(ids.next);
    unchanged = await request('admin', `automation_executions?workflow_id=eq.${ids.workflow}&lead_id=eq.${ids.lead}`);
    await stage(ids.first);
    await stage(ids.next);
    repeated = await request('admin', `automation_executions?workflow_id=eq.${ids.workflow}&lead_id=eq.${ids.lead}&order=event_key`);
    finalTasks = await request('employee', `crm_work_items?lead_id=eq.${ids.lead}&title=eq.${encodeURIComponent(title)}`);
    paused = await request('admin', `automation_executions?workflow_id=eq.${ids.paused}`);
    privateLogs = await request('employee', `automation_executions?lead_id=eq.${ids.lead}`);
    const session = JSON.parse(readFileSync(`${directory}/employee-session.json`, 'utf8')).session;
    blockedCall = (await fetch(`${process.env['VITE_SUPABASE_URL']}/rest/v1/rpc/automation_execute_lead_event`, { method: 'POST', headers: { apikey: process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '', Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ _lead: ids.lead, _trigger: 'stage_changed', _event_key: 'stage_changed:1' }) })).status;
  }, 60000);
  it('does not execute stage workflows on lead creation', () => expect(initial).toEqual([]));
  it('creates one task for the assigned eligible company user', () => {
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ assigned_to: ids.user, company_id: ids.company, lead_id: ids.lead, created_by: ids.admin, kind: 'task' });
  });
  it('persists success and the actual task in the existing log', () => {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'success', event_key: 'stage_changed:1', task_ids: [tasks[0].id] });
  });
  it('saves creator history visible to the assignee', () => expect(history[0]).toMatchObject({ work_id: tasks[0].id, actor_id: ids.admin, action: 'created' }));
  it('notes, unrelated edits and same-stage saves create no extra event', () => expect(unchanged).toEqual(logs));
  it('distinct return-to-stage events execute once each and reuse conditions', () => {
    expect(repeated.map(log => [log.event_key, log.status])).toEqual([['stage_changed:1', 'success'], ['stage_changed:2', 'skipped'], ['stage_changed:3', 'success']]);
    expect(finalTasks).toHaveLength(2);
  });
  it('never executes paused workflows', () => expect(paused).toEqual([]));
  it('keeps execution logs private from standard users', () => expect(privateLogs).toEqual([]));
  it('rejects direct executor calls', () => expect([401, 403, 404]).toContain(blockedCall));
});