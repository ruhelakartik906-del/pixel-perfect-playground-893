import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { inboxActionSchema, inboxSendSchema } from './whatsapp-inbox';

export const inboxAction = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>inboxActionSchema.parse(input)).handler(async({context,data})=>{
  const r = await context.supabase.rpc('wa_inbox_action',{_id:data.id,_action:data.action,_payload:data.payload});
  if(r.error) throw new Error(r.error.message); return {ok:true};
});
export const inboxNotes = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({context,data})=>{
  const check=await context.supabase.rpc('wa_inbox_access',{_conversation:data.id,_write:false});
  if(check.error||!check.data) throw new Error('Inbox access denied');
  const r=await context.supabase.from('whatsapp_internal_notes').select('id,body,actor_id,created_at').eq('conversation_id',data.id).order('created_at');
  if(r.error) throw new Error('Notes could not be loaded'); return r.data;
});
export const sendInboxMessage = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>inboxSendSchema.parse(input)).handler(async({context,data})=>{
  const access=await context.supabase.rpc('wa_inbox_access',{_conversation:data.id,_write:true});
  if(access.error||access.data!==true) throw new Error('Reply permission required');
  const c=await context.supabase.from('whatsapp_conversations').select('id,company_id,connection_id,provider_phone').eq('id',data.id).single();
  if(c.error||!c.data.connection_id||!c.data.company_id||!c.data.provider_phone) throw new Error('Organization connection required');
  const policy=await context.supabase.rpc('integration_provider_allowed',{_company:c.data.company_id,_provider:'whatsapp',_action:'use'});
  if(policy.error||!policy.data) throw new Error('WhatsApp usage is unavailable under your permissions or plan');
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const meta=await import('@/lib/whatsapp-meta.server');
  const [connection,secret]=await Promise.all([db.from('org_whatsapp_connections').select('phone_number_id,waba_id').eq('id',c.data.connection_id).single(),db.from('org_whatsapp_secrets').select('token_ciphertext').eq('connection_id',c.data.connection_id).single()]);
  if(connection.error||secret.error) throw new Error('Stored connection is unavailable; reconnect required');
  const token=await meta.decryptToken(secret.data.token_ciphertext);
  let payload:Record<string,unknown>={messaging_product:'whatsapp',to:c.data.provider_phone,type:'text',text:{body:data.body}};
  if(data.type==='template'&&data.template){
    const templates=await meta.graph<{data:{name:string;status:string;language:string;components:{type:string;text?:string}[]}[]}>(`/${connection.data.waba_id}/message_templates`,token,{query:{name:data.template.name,limit:'100'}});
    if(!templates.ok) throw new Error(`Template verification failed (${templates.status}): ${templates.message}`);
    const template=templates.data.data.find(t=>t.name===data.template?.name&&t.language===data.template?.language&&t.status==='APPROVED');
    if(!template) throw new Error('This template is not approved by Meta');
    if(template.components.some(t=>t.type!=='BODY'&&t.type!=='FOOTER')) throw new Error('This template requires header or button parameters; sending is not supported yet');
    const count=[...(template.components.find(t=>t.type==='BODY')?.text??'').matchAll(/\{\{\d+\}\}/g)].length;
    if(count!==data.template.parameters.length) throw new Error('Template parameter count does not match');
    payload={messaging_product:'whatsapp',to:c.data.provider_phone,type:'template',template:{name:data.template.name,language:{code:data.template.language},components:[{type:'body',parameters:data.template.parameters.map(text=>({type:'text',text}))}]}};
  }
  const reserved=await db.rpc('wa_reserve_send',{_conversation:data.id,_client:data.client_id,_actor:context.userId,_body:data.body,_type:data.type});
  if(reserved.error) throw new Error(reserved.error.message);
  const row=await db.from('whatsapp_messages').select('id,status,wa_message_id').eq('id',reserved.data).single();
  if(row.error) throw new Error('Send reservation could not be loaded');
  // Duplicate requests never resend a reserved or already accepted provider request.
  if(row.data.wa_message_id||row.data.status!=='sending') return {id:row.data.id,status:row.data.status};
  const claim=await db.from('whatsapp_messages').update({status:'dispatching'}).eq('id',row.data.id).eq('status','sending').select('id').maybeSingle();
  if(claim.error) throw new Error('Send could not be claimed');
  if(!claim.data) return {id:row.data.id,status:'dispatching'};
  let sent: Awaited<ReturnType<typeof meta.graph<{messages:{id:string}[]}>>>;
  try{sent=await meta.graph<{messages:{id:string}[]}>(`/${connection.data.phone_number_id}/messages`,token,{method:'POST',body:payload});}
  catch{const uncertain=await db.from('whatsapp_messages').update({status:'unknown',failure_reason:'Provider response unavailable; review before retrying'}).eq('id',row.data.id);if(uncertain.error)throw new Error('Uncertain send outcome could not be saved');throw new Error('Send outcome is unknown; do not resend until reviewed');}
  const providerId=sent.ok?sent.data.messages?.[0]?.id:null;
  const saved=await db.from('whatsapp_messages').update(sent.ok&&providerId?{wa_message_id:providerId,status:'accepted'}:{status:sent.ok?'unknown':'failed',failure_reason:sent.ok?'Meta response did not include a message ID':`Meta (${sent.status}): ${sent.message}`}).eq('id',row.data.id).eq('status','dispatching').select('id').maybeSingle();
  if(saved.error||!saved.data) throw new Error('Provider outcome could not be saved; do not resend');
  if(!sent.ok) throw new Error(`Meta (${sent.status}): ${sent.message}`);
  if(!providerId) throw new Error('Meta acceptance is unconfirmed; do not resend');
  const events=await db.from('org_whatsapp_webhook_events').select('id').eq('connection_id',c.data.connection_id).is('processed_at',null).order('next_attempt_at').limit(20);
  if(events.error) throw new Error('Accepted send saved, but pending delivery statuses could not be loaded');
  for(const event of events.data){const r=await db.rpc('wa_process_event',{_id:event.id});if(r.error)throw new Error('Accepted send saved, but reconciliation failed');}
  return {id:row.data.id,status:'accepted'};
});