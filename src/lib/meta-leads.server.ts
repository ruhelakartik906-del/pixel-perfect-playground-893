import {supabaseAdmin as db} from '@/integrations/supabase/client.server';
import {decryptToken,graph} from './whatsapp-meta.server';
export async function processMetaLead(eventId:string){
 const event=await db.from('org_meta_events').select('*').eq('id',eventId).single();if(event.error)throw new Error('Lead event unavailable');if(event.data.processed_at)return;
 try{
 const source=await db.from('org_meta_sources').select('*').eq('id',event.data.source_id??'').eq('enabled',true).single();if(source.error)throw new Error('Source not connected');
 const secret=await db.from('org_meta_secrets').select('token_ciphertext').eq('connection_id',source.data.connection_id).single();if(secret.error)throw new Error('Meta authorization missing');
 const token=await decryptToken(secret.data.token_ciphertext);
 const pages=await graph<{data:{id:string;access_token:string}[]}>('/me/accounts',token,{query:{fields:'id,access_token',limit:'100'}});if(!pages.ok)throw new Error(`Meta (${pages.status}): ${pages.message}`);const page=pages.data.data.find(p=>p.id===source.data.page_id);if(!page)throw new Error('Selected Page authorization is no longer available');
 const lead=await graph<{id:string;field_data:{name:string;values:string[]}[];ad_id?:string;ad_name?:string;campaign_id?:string;campaign_name?:string;adset_id?:string;form_id?:string}>(`/${event.data.leadgen_id}`,page.access_token,{query:{fields:'id,field_data,ad_id,ad_name,campaign_id,campaign_name,adset_id,form_id'}});
 if(!lead.ok)throw new Error(`Meta (${lead.status}, code ${lead.code??'unknown'}): ${lead.message}`);
 if(lead.data.form_id&&lead.data.form_id!==source.data.form_id)throw new Error('Provider form does not match the selected source');
 const answers=Object.fromEntries(lead.data.field_data.map(f=>[f.name,f.values]));
 const field=(key:string)=>{const mapping=source.data.field_mapping as Record<string,string>;return answers[mapping[key]??key]?.join(' ')??'';};
 let accountId:string|null=null;
 if(lead.data.ad_id){const ad=await graph<{account_id?:string}>(`/${lead.data.ad_id}`,token,{query:{fields:'account_id'}});if(!ad.ok)throw new Error(`Meta ad attribution (${ad.status}): ${ad.message}`);accountId=ad.data.account_id??null;}
 const saved=await db.rpc('meta_canonical_intake',{_source:source.data.id,_payload:{meta_lead_id:lead.data.id,name:field('full_name')||field('name')||'Unnamed Meta lead',phone:field('phone_number'),email:field('email'),form_answers:answers,account_id:accountId,ad_id:lead.data.ad_id??null,ad_name:lead.data.ad_name??null,campaign_id:lead.data.campaign_id??null,campaign_name:lead.data.campaign_name??null,adset_id:lead.data.adset_id??null}});
 if(saved.error)throw new Error(saved.error.message);
 const marked=await db.from('org_meta_events').update({processed_at:new Date().toISOString(),lead_id:saved.data,last_error:null}).eq('id',eventId);if(marked.error)throw new Error('Lead saved but progress could not be recorded');
 }catch(error){const message=error instanceof Error?error.message:'Meta import failed';const updated=await db.from('org_meta_events').update({attempts:event.data.attempts+1,last_error:message.slice(0,300),next_attempt_at:new Date(Date.now()+Math.min(60,2**Math.min(event.data.attempts,5))*60000).toISOString()}).eq('id',eventId);if(updated.error)throw new Error('Lead failure could not be recorded');throw error;}
}