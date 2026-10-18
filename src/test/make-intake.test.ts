import { beforeEach, describe, expect, it, vi } from 'vitest';
import { intakeSchema, resolveIntakeSource, sourceBindingsSchema } from '@/lib/make-intake';
import { handleMakeIntake } from '@/lib/make-intake.server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock('@/lib/make-intake', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/make-intake')>();
  return { ...actual, verifyIntakeToken: async (supplied: string, expected: string) => supplied === expected };
});
const binding = { page_id: '11', form_id: '22', campaign_id: '33', company_id: '00000000-0000-4000-8000-000000000001', account_id: '66' };
const lead = { facebook_lead_id: '77', name: 'Test enquiry', phone: '+46000000000', email: 'test@example.test', source: 'Facebook', page_id: '11', form_id: '22', campaign_id: '33', ad_id: '44', form_answers: { service: 'Consultation', multi: ['A', 'B'], nested: { approved: false } } };
function request(body: unknown = lead, authorized = true, type = 'application/json') {
  return new Request('https://routiva.test/api/public/make-leads', { method: 'POST', headers: { 'content-type': type, ...(authorized ? { authorization: 'Bearer test-only-credential' } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
describe('Make lead intake security and saves', () => {
  beforeEach(() => {
    vi.stubEnv('MAKE_LEAD_INTAKE_TOKEN', 'test-only-credential');
    vi.stubEnv('MAKE_LEAD_INTAKE_SOURCES', JSON.stringify([binding]));
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { status: 'created', lead_id: 'new-lead', routing_status: 'assigned' }, error: null });
  });
  it('denies unauthenticated requests before saving', async () => {
    expect((await handleMakeIntake(request(lead, false))).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects invalid authorization before saving', async () => {
    vi.stubEnv('MAKE_LEAD_INTAKE_TOKEN', 'different-test-only-credential');
    expect((await handleMakeIntake(request())).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('fails closed without configuration', async () => {
    vi.stubEnv('MAKE_LEAD_INTAKE_TOKEN', '');
    expect((await handleMakeIntake(request())).status).toBe(503); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON', async () => { expect((await handleMakeIntake(request('{'))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it('rejects non-JSON content', async () => { expect((await handleMakeIntake(request(lead, true, 'text/plain'))).status).toBe(415); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it('rejects requests larger than 64 KiB', async () => { expect((await handleMakeIntake(request({ ...lead, form_answers: { huge: 'a'.repeat(65536) } }))).status).toBe(413); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it.each(['name', 'phone', 'source', 'facebook_lead_id', 'page_id', 'form_id', 'campaign_id', 'ad_id'])('requires %s', field => {
    const body: Record<string, unknown> = { ...lead }; delete body[field]; expect(intakeSchema.safeParse(body).success).toBe(false);
  });
  it('allows leads without email', () => { const { email, ...body } = lead; expect(intakeSchema.parse(body).email).toBe(''); });
  it('keeps all unknown form answers', () => { expect(intakeSchema.parse(lead).form_answers).toEqual(lead.form_answers); });
  it.each(['company_id', 'assigned_to', 'account_id'])('rejects caller-controlled %s', async field => {
    expect((await handleMakeIntake(request({ ...lead, [field]: binding.company_id }))).status).toBe(422); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not accept an unauthorized campaign', async () => { expect((await handleMakeIntake(request({ ...lead, campaign_id: '99' }))).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it('does not accept ambiguous source mappings', () => { expect(resolveIntakeSource([binding, binding], intakeSchema.parse(lead))).toBeUndefined(); });
  it('supports separate client campaigns with server-selected companies', () => {
    const second = { ...binding, campaign_id: '88', company_id: '00000000-0000-4000-8000-000000000002' };
    const bindings = sourceBindingsSchema.parse([binding, second]);
    expect(resolveIntakeSource(bindings, intakeSchema.parse({ ...lead, campaign_id: '88' }))?.company_id).toBe(second.company_id);
  });
  it('saves through the single transactional RPC using trusted source fields', async () => {
    const response = await handleMakeIntake(request()); expect(response.status).toBe(201); expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('make_lead_intake', { _company: binding.company_id, _account: '66', _payload: lead, _dry_run: false });
    expect(await response.json()).toEqual({ success: true, status: 'created', lead_id: 'new-lead', routing_status: 'assigned' });
  });
  it('returns idempotent duplicate results without another routing call', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'duplicate', lead_id: 'existing', routing_status: 'assigned' }, error: null });
    const response = await handleMakeIntake(request()); expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('duplicate'); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('passes dry run to the no-write database branch', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'validated', dry_run: true }, error: null });
    const response = await handleMakeIntake(request({ ...lead, dry_run: true })); expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls[0]?.[1]._dry_run).toBe(true);
  });
  it('does not expose internal failure details', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'internal', message: 'private database detail' } });
    const response = await handleMakeIntake(request()); expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private database detail');
  });
  it('reports duplicate source conflicts without returning another client record', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505' } });
    const response = await handleMakeIntake(request()); expect(response.status).toBe(409); expect(await response.json()).not.toHaveProperty('lead_id');
  });
});