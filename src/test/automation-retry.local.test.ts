import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';

// Opt-in disposable LOCAL PostgreSQL only. Never connect this harness to Cloud.
const enabled = process.env['AUTOMATION_LOCAL_RETRY_QA'] === '1';
describe.skipIf(!enabled)('actual SQL retry executor in a disposable local database', () => {
  const sql = postgres({ host: '127.0.0.1', port: 55439, database: 'postgres', username: 'qa', ssl: false, max: 4 });
  const admin = '00000000-0000-4000-8000-000000000001';
  const user = '00000000-0000-4000-8000-000000000002';
  const lead = '00000000-0000-4000-8000-000000000003';
  const company = '00000000-0000-4000-8000-000000000004';
  const workflow = '00000000-0000-4000-8000-000000000005';
  beforeEach(async () => {
    await sql`TRUNCATE automation_executions,automation_workflows,crm_work_history,crm_work_items,qa_fault,profiles,leads,cron.calls`;
    await sql`ALTER SEQUENCE qa_failure_attempt RESTART WITH 1`;
    await sql`INSERT INTO profiles VALUES (${admin},'active','QA Admin'),(${user},'active','QA User')`;
    await sql`INSERT INTO leads(id,company_id,assigned_to) VALUES (${lead},${company},${user})`;
  });
  afterAll(async () => { await sql.end(); });
  async function setup(failures: number, code = '40001', partial = false) {
    const actions = partial ? [
      { type: 'create_task', delayHours: 0, note: 'Already successful' },
      { type: 'create_follow_up', delayHours: 0.01, note: 'QA fault' },
    ] : [
      { type: 'create_task', delayHours: 0, note: 'Rollback task' },
      { type: 'create_follow_up', delayHours: 0, note: 'QA fault' },
    ];
    await sql`INSERT INTO automation_workflows VALUES (${workflow},'lead_created','active',${admin},'[]',${sql.json(actions)})`;
    await sql`INSERT INTO qa_fault VALUES ('QA fault',${failures},${code})`;
    await sql`SELECT automation_run_record_event(${lead},'lead_created','lead_created',NULL)`;
  }
  async function log() { const rows = await sql`SELECT * FROM automation_executions`; expect(rows).toHaveLength(1); return rows[0]; }
  async function tick() {
    // Advance only the disposable queue clock; call the real scheduler processor.
    await sql`UPDATE automation_executions SET due_at=now()-interval '1 second' WHERE status='queued'`;
    await sql`SELECT automation_process_delays()`;
  }
  it('one transient failure recovers on attempt 2, with rollback, backoff and final timestamps', async () => {
    await setup(1);
    const queued = await log();
    expect(queued.status).toBe('queued'); expect(queued.attempts).toBe(2);
    expect(queued.last_error).toContain('40001'); expect(queued.last_attempt_at).toBeTruthy();
    expect(queued.finished_at).toBeNull();
    expect(new Date(queued.due_at).getTime()-new Date(queued.last_attempt_at).getTime()).toBe(60000);
    expect(await sql`SELECT * FROM crm_work_items`).toHaveLength(0);
    await tick(); const final = await log();
    expect(final.status).toBe('success'); expect(final.attempts).toBe(2);
    expect(final.finished_at).toBeTruthy(); expect(final.due_at).toBeNull();
    expect(final.task_ids).toHaveLength(1); expect(final.follow_up_ids).toHaveLength(1);
  });
  it('three transient failures exhaust at exactly 3 attempts, then processing never tries again', async () => {
    await setup(99); await tick(); const queued = await log();
    expect(queued.attempts).toBe(3); expect(queued.status).toBe('queued');
    expect(new Date(queued.due_at).getTime()-new Date(queued.last_attempt_at).getTime()).toBe(180000);
    await tick(); const final = await log();
    expect(final.status).toBe('failed'); expect(final.attempts).toBe(3);
    expect(final.detail).toContain('Permanently failed after 3');
    expect(final.last_error).toContain('40001'); expect(final.finished_at).toBeTruthy(); expect(final.due_at).toBeNull();
    await tick(); expect((await sql`SELECT last_value FROM qa_failure_attempt`)[0].last_value).toBe('3');
    expect(await sql`SELECT * FROM crm_work_items`).toHaveLength(0);
  });
  it('permanent errors terminate at one attempt without queueing', async () => {
    await setup(99,'23514'); const final = await log();
    expect(final.status).toBe('failed'); expect(final.attempts).toBe(1);
    expect(final.last_error).toContain('23514'); expect(final.finished_at).toBeTruthy(); expect(final.due_at).toBeNull();
  });
  it('partial success survives retries and concurrent/repeated processing creates no duplicate work', async () => {
    await setup(1,'40001',true); const first = await log();
    expect(first.task_ids).toHaveLength(1); const taskId = first.task_ids[0];
    await tick(); expect((await log()).status).toBe('queued');
    expect((await log()).task_ids).toEqual([taskId]);
    await sql`UPDATE automation_executions SET due_at=now()-interval '1 second' WHERE status='queued'`;
    await Promise.all([sql`SELECT automation_process_delays()`,sql`SELECT automation_process_delays()`]);
    await sql`SELECT automation_run_record_event(${lead},'lead_created','lead_created',NULL)`;
    await tick(); const final = await log();
    expect(final.status).toBe('success'); expect(final.task_ids).toEqual([taskId]);
    expect(final.follow_up_ids).toHaveLength(1);
    expect(await sql`SELECT * FROM crm_work_items WHERE kind='task'`).toHaveLength(1);
    expect(await sql`SELECT * FROM crm_work_items WHERE kind='follow_up'`).toHaveLength(1);
    expect(await sql`SELECT * FROM crm_work_history`).toHaveLength(2);
    expect((await sql`SELECT action FROM cron.calls ORDER BY ctid DESC LIMIT 1`)[0].action).toBe('stop');
  });
});