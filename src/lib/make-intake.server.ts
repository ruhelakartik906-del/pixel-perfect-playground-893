import { intakeSchema } from './make-intake';
import { selectManagedSource, type ManagedSource } from './make-management';
import { authenticateMakeKey, makeAdminClient } from './make-management.server';
import type { Json } from '@/integrations/supabase/types';

const MAX_BYTES = 65536;
function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function error(status: number, code: string, message: string) {
  return reply(status, { success: false, error: { code, message } });
}

export async function handleMakeIntake(request: Request) {
  let keyId: string | null = null;
  let sourceId: string | null = null;
  let isTest = false;
  async function loggedError(status: number, code: string, message: string) {
    try {
      const db = await makeAdminClient();
      await db.from('make_intake_logs').insert({ key_id: keyId, source_id: sourceId, status: status >= 500 ? 'error' : 'rejected', http_status: status, code, is_test: isTest });
    } catch { /* No payloads or credentials are logged. */ }
    return error(status, code, message);
  }
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 1024) {
    return loggedError(401, 'UNAUTHORIZED', 'Valid Bearer authorization required');
  }
  let authenticated;
  try { authenticated = await authenticateMakeKey(authorization.slice(7)); }
  catch { return loggedError(503, 'SETUP_REQUIRED', 'Lead intake configuration unavailable'); }
  if (!authenticated) return loggedError(401, 'UNAUTHORIZED', 'Valid Bearer authorization required');
  const { db, keyId: authenticatedKeyId } = authenticated;
  keyId = authenticatedKeyId;
  await db.from('make_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId).is('revoked_at', null);
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return loggedError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_BYTES) return loggedError(413, 'PAYLOAD_TOO_LARGE', 'Request exceeds 64 KiB');
  let text = '';
  const reader = request.body?.getReader();
  if (!reader) return loggedError(400, 'INVALID_JSON', 'JSON request body required');
  try {
    const decoder = new TextDecoder();
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); return loggedError(413, 'PAYLOAD_TOO_LARGE', 'Request exceeds 64 KiB'); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } catch { return loggedError(400, 'INVALID_JSON', 'Request body could not be read'); }
  let input: unknown;
  try { input = JSON.parse(text); } catch { return loggedError(400, 'INVALID_JSON', 'Malformed JSON request body'); }
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) return loggedError(422, 'INVALID_INPUT', 'Invalid or unexpected lead fields');
  const lead = parsed.data;
  isTest = lead.dry_run;
  const sources = await db.from('make_lead_sources').select('*').eq('page_id', lead.page_id).eq('form_id', lead.form_id);
  if (sources.error) return loggedError(503, 'SETUP_REQUIRED', 'Source configuration unavailable');
  const binding = selectManagedSource(sources.data as ManagedSource[], lead);
  if (!binding) return loggedError(403, 'SOURCE_NOT_ALLOWED', 'Source is disabled, unknown or ambiguous');
  sourceId = binding.id;
  const { dry_run, ...payload } = lead;
  try {
    // No privileged client is loaded until the caller and its configured source have been verified.
    const { data, error: failure } = await db.rpc('make_lead_intake', {
      _company: binding.company_id, _account: binding.account_id, _payload: payload as Json, _dry_run: dry_run, _source: binding.id,
    });
    if (failure) {
      if (failure.code === '42501') return loggedError(403, 'SOURCE_NOT_ALLOWED', 'Configured source or company is unavailable');
      if (failure.code === '23505') return loggedError(409, 'LEAD_SOURCE_CONFLICT', 'Lead ID conflicts with existing source data');
      if (failure.code === '22023') return loggedError(422, 'INVALID_INPUT', 'Lead payload was rejected');
      return loggedError(503, 'SAVE_UNAVAILABLE', 'Lead was not confirmed saved; retry with the same Facebook lead ID');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return loggedError(503, 'SAVE_UNAVAILABLE', 'Lead save could not be confirmed');
    const resultStatus = data['status'];
    await db.from('make_intake_logs').insert({ key_id: keyId, source_id: sourceId, status: resultStatus === 'created' ? 'created' : resultStatus === 'duplicate' ? 'duplicate' : 'validated', http_status: resultStatus === 'created' ? 201 : 200, code: 'OK', lead_id: typeof data['lead_id'] === 'string' ? data['lead_id'] : null, is_test: dry_run });
    return reply(data['status'] === 'created' ? 201 : 200, { success: true, ...data });
  } catch { return loggedError(503, 'SAVE_UNAVAILABLE', 'Lead intake temporarily unavailable; retry with the same Facebook lead ID'); }
}