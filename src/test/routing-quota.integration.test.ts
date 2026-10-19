import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Opt-in only: uses an authorized Admin session and pre-approved disposable QA company/users.
const directory = process.env['ROUTING_QA_DIR'];
describe.skipIf(!directory)('existing routing: isolated quota, overflow and duplicate arrivals', () => {
  let state: any;
  let sequential: any[], concurrent: any[], steps: any[], events: any[], independent: any[];
  let duplicateStatus: number, racingStatuses: number[], retry: any;
  async function request(path: string, method = 'GET', body?: unknown, allowFailure = false) {
    const session = JSON.parse(readFileSync(`${directory}/admin-session.json`, 'utf8')).session;
    const response = await fetch(`${process.env['VITE_SUPABASE_URL']}/rest/v1/${path}`, {
      method, headers: { apikey: process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '', Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (allowFailure) return response.status;
    if (!response.ok) throw new Error(`${method} ${path.split('?')[0]} failed (${response.status}): ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }
  function persist() { writeFileSync(`${directory}/state.json`, JSON.stringify(state)); }
  async function rule(campaign: string, ad = '') {
    const id = await request('rpc/routing_rule_action', 'POST', { _action: 'save', _payload: {
      company_id: state.company, name: `${state.tag}-${campaign}-${ad}`, account_id: state.tag,
      campaign_id: campaign, ad_id: ad, status: 'active', steps: [{ user_id: state.a, quota: 5 }, { user_id: state.b, quota: null }],
    } });
    state.rules.push(id); persist(); return id;
  }
  function lead(campaign: string, ad = '', external: string = randomUUID()) {
    const row = { id: randomUUID(), company_id: state.company, customer_name: `${state.tag}-${state.leads.length}`, meta_account_id: state.tag, meta_campaign_id: campaign, meta_ad_id: ad, meta_lead_id: `${state.tag}-${external}`, created_by: state.admin };
    state.leads.push(row.id); persist(); return row;
  }
  beforeAll(async () => {
    state = JSON.parse(readFileSync(`${directory}/state.json`, 'utf8'));
    state.admin = JSON.parse(readFileSync(`${directory}/admin-session.json`, 'utf8')).user_id; persist();
    expect(await request('rpc/routing_admin', 'POST', {})).toBe(true);
    for (const user of [state.a, state.b]) expect(await request('rpc/routing_eligible', 'POST', { _user: user, _company: state.company })).toBe(true);
    const main = await rule('sequential'), parallel = await rule('parallel'), campaign = await rule('independent'), ad1 = await rule('independent', 'ad-one'), ad2 = await rule('independent', 'ad-two');
    const first = [];
    for (let i = 0; i < 5; i++) { const row = lead('sequential'); first.push(row); await request('leads', 'POST', row); }
    duplicateStatus = await request('leads', 'POST', { ...first[0], id: randomUUID() }, true);
    for (let i = 0; i < 2; i++) await request('leads', 'POST', lead('sequential'));
    sequential = await request(`leads?company_id=eq.${state.company}&meta_campaign_id=eq.sequential&order=created_at,id`);
    // Start independent HTTP transactions together: fixed quota must never exceed five.
    const arrivals = Array.from({ length: 12 }, () => lead('parallel'));
    await Promise.all(arrivals.map(row => request('leads', 'POST', row)));
    const same = lead('parallel', '', 'simultaneous-duplicate');
    racingStatuses = await Promise.all([request('leads', 'POST', same, true), request('leads', 'POST', { ...same, id: randomUUID() }, true)]);
    concurrent = await request(`leads?company_id=eq.${state.company}&meta_campaign_id=eq.parallel`);
    for (const ad of ['', 'ad-one', 'ad-two']) await request('leads', 'POST', lead('independent', ad));
    independent = await request(`lead_assignment_events?company_id=eq.${state.company}&rule_id=in.(${campaign},${ad1},${ad2})`);
    retry = await request('rpc/route_lead', 'POST', { _lead: first[0]?.id });
    steps = await request(`ad_routing_steps?rule_id=in.(${state.rules.join(',')})&order=position`);
    events = await request(`lead_assignment_events?company_id=eq.${state.company}`);
    state.main = main; state.parallel = parallel; state.campaign = campaign; state.ad1 = ad1; state.ad2 = ad2; persist();
  }, 120000);
  it('first five eligible leads go to A', () => {
    expect(sequential.slice(0, 5).map(l => l.assigned_to)).toEqual(Array(5).fill(state.a));
  });
  it('sixth and seventh go to configured overflow B', () => {
    expect(sequential.slice(5).map(l => l.assigned_to)).toEqual([state.b, state.b]);
  });
  it('duplicate ingestion is rejected and consumes no extra quota', () => {
    expect(duplicateStatus).toBe(409);
    expect(sequential).toHaveLength(7);
    expect(steps.filter(s => s.rule_id === state.main).map(s => s.assigned_count)).toEqual([5, 2]);
  });
  it('concurrent arrivals cannot bypass the quota of five', () => {
    expect(concurrent.filter(l => l.assigned_to === state.a)).toHaveLength(5);
    expect(concurrent.filter(l => l.assigned_to === state.b)).toHaveLength(8);
    expect(steps.filter(s => s.rule_id === state.parallel).map(s => s.assigned_count)).toEqual([5, 8]);
  });
  it('simultaneous copies of one external lead create exactly one assignment', () => {
    expect([...racingStatuses].sort()).toEqual([201, 409]);
    expect(concurrent).toHaveLength(13);
    expect(events.filter(e => e.rule_id === state.parallel)).toHaveLength(13);
  });
  it('specific ads and campaign retain independent counters', () => {
    for (const id of [state.campaign, state.ad1, state.ad2]) {
      expect(independent.filter(e => e.rule_id === id && e.user_id === state.a)).toHaveLength(1);
      expect(steps.filter(s => s.rule_id === id).map(s => s.assigned_count)).toEqual([1, 0]);
    }
  });
  it('retrying an assigned lead preserves assignment and counts', () => {
    expect(retry).toMatchObject({ status: 'already_assigned', user_id: state.a });
    expect(events.filter(e => e.rule_id === state.main)).toHaveLength(7);
  });
});