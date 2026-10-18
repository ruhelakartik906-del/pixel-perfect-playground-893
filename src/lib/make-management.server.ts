import { hashMakeCredential } from './make-management';
import { sourceBindingsSchema } from './make-intake';

export async function makeAdminClient() {
  return (await import('@/integrations/supabase/client.server')).supabaseAdmin;
}

/** Import legacy configuration idempotently; revoked keys and archived mappings never revive. */
export async function importMakeBootstrap() {
  const db = await makeAdminClient();
  const token = process.env['MAKE_LEAD_INTAKE_TOKEN'];
  if (token) {
    const hash = await hashMakeCredential(token);
    const result = await db.from('make_api_keys').upsert({ label: 'Legacy bootstrap key', key_hash: hash }, { onConflict: 'key_hash', ignoreDuplicates: true });
    if (result.error) throw new Error('Credential configuration unavailable');
  }
  const raw = process.env['MAKE_LEAD_INTAKE_SOURCES'];
  if (raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Legacy source configuration needs correction'); }
    const bindings = sourceBindingsSchema.safeParse(parsed);
    if (!bindings.success) throw new Error('Legacy source configuration needs correction');
    for (const binding of bindings.data) {
      const result = await db.from('make_lead_sources').upsert({ ...binding, name: 'Imported Facebook source', platform: 'Facebook' }, { onConflict: 'page_id,form_id,campaign_id,ad_id', ignoreDuplicates: true });
      if (result.error) throw new Error('Legacy source configuration unavailable');
    }
  }
  return db;
}

export async function authenticateMakeKey(supplied: string) {
  const db = await importMakeBootstrap();
  const hash = await hashMakeCredential(supplied);
  const found = await db.from('make_api_keys').select('id,revoked_at').eq('key_hash', hash).maybeSingle();
  if (found.error) throw new Error('Credential configuration unavailable');
  if (!found.data || found.data.revoked_at) return null;
  return { db, keyId: found.data.id };
}