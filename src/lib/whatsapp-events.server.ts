import { supabaseAdmin as db } from '@/integrations/supabase/client.server';
export async function recoverWhatsAppEvents(connectionId?: string) {
  let query = db.from('org_whatsapp_webhook_events').select('id').is('processed_at',null).lte('next_attempt_at',new Date().toISOString()).order('next_attempt_at').limit(10);
  if (connectionId) query = query.eq('connection_id',connectionId);
  const rows = await query;
  if (rows.error) throw new Error('Pending webhook events could not be read');
  for (const row of rows.data) {
    const processed = await db.rpc('wa_process_event',{_id:row.id});
    if (processed.error) throw new Error('Webhook processing could not be saved');
  }
}