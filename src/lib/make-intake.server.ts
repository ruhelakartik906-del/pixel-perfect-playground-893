import { intakeSchema, resolveIntakeSource, sourceBindingsSchema, verifyIntakeToken } from './make-intake';
import type { Json } from '@/integrations/supabase/types';

const MAX_BYTES = 65536;
function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function error(status: number, code: string, message: string) {
  return reply(status, { success: false, error: { code, message } });
}

export async function handleMakeIntake(request: Request) {
  const token = process.env['MAKE_LEAD_INTAKE_TOKEN'];
  if (!token) return error(503, 'SETUP_REQUIRED', 'Lead intake is not configured');
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 1024 || !await verifyIntakeToken(authorization.slice(7), token)) {
    return error(401, 'UNAUTHORIZED', 'Valid Bearer authorization required');
  }
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_BYTES) return error(413, 'PAYLOAD_TOO_LARGE', 'Request exceeds 64 KiB');
  let text = '';
  const reader = request.body?.getReader();
  if (!reader) return error(400, 'INVALID_JSON', 'JSON request body required');
  try {
    const decoder = new TextDecoder();
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); return error(413, 'PAYLOAD_TOO_LARGE', 'Request exceeds 64 KiB'); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } catch { return error(400, 'INVALID_JSON', 'Request body could not be read'); }
  let input: unknown;
  try { input = JSON.parse(text); } catch { return error(400, 'INVALID_JSON', 'Malformed JSON request body'); }
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) return reply(422, { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid or unexpected lead fields', fields: parsed.error.issues.map(i => i.path.join('.')) } });
  let config: unknown;
  try { config = JSON.parse(process.env['MAKE_LEAD_INTAKE_SOURCES'] ?? 'null'); } catch { return error(503, 'SETUP_REQUIRED', 'Source bindings are not configured'); }
  const bindings = sourceBindingsSchema.safeParse(config);
  if (!bindings.success) return error(503, 'SETUP_REQUIRED', 'Source bindings are not configured');
  const lead = parsed.data;
  const binding = resolveIntakeSource(bindings.data, lead);
  if (!binding) return error(403, 'SOURCE_NOT_ALLOWED', 'Page, form and campaign are not uniquely authorized');
  const { dry_run, ...payload } = lead;
  try {
    // No privileged client is loaded until the caller and its configured source have been verified.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error: failure } = await supabaseAdmin.rpc('make_lead_intake', {
      _company: binding.company_id, _account: binding.account_id, _payload: payload as Json, _dry_run: dry_run,
    });
    if (failure) {
      if (failure.code === '42501') return error(403, 'SOURCE_NOT_ALLOWED', 'Configured company is unavailable');
      if (failure.code === '23505') return error(409, 'LEAD_SOURCE_CONFLICT', 'Facebook lead ID already belongs to another source');
      if (failure.code === '22023') return error(422, 'INVALID_INPUT', 'Lead payload was rejected');
      return error(503, 'SAVE_UNAVAILABLE', 'Lead was not confirmed saved; retry with the same Facebook lead ID');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return error(503, 'SAVE_UNAVAILABLE', 'Lead save could not be confirmed');
    return reply(data['status'] === 'created' ? 201 : 200, { success: true, ...data });
  } catch { return error(503, 'SAVE_UNAVAILABLE', 'Lead intake temporarily unavailable; retry with the same Facebook lead ID'); }
}