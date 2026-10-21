import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { leadCreateSchema, leadCreateRecord } from './lead-create';
import { readAllPages } from './backend-read';
export const loadLeadCreateAccess = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const result = await context.supabase.rpc('routing_admin');
  if (result.error) throw new Error('Lead creation permission could not be verified');
  if(result.data === true)return true;
  const memberships=await readAllPages((o,e)=>context.supabase.from('company_members').select('company_id').eq('user_id',context.userId).order('id').range(o,e));
  const allowed=await Promise.all(memberships.map(async m=>{const r=await context.supabase.rpc('lead_company_allowed',{_company:m.company_id});if(r.error)throw new Error('Lead access could not be verified');return r.data===true;}));
  return allowed.some(Boolean);
});
export const createBoardLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => leadCreateSchema.parse(v)).handler(async ({ context, data }) => {
  const access = await context.supabase.rpc('routing_admin');
  if(access.error)throw new Error('Lead access could not be verified');
  if(access.data!==true){
    if(!data.company_id)throw new Error('Choose your CRM company');
    const result=await context.supabase.rpc('user_board_lead_create',{_payload:leadCreateRecord(data,'',context.userId)});
    if(result.error)throw new Error(result.error.message);return result.data;
  }
  const stage = await context.supabase.from('crm_stages').select('pipeline_id,board_closed').eq('id', data.stage_id).eq('kind', 'lead').eq('is_active', true).single();
  if (stage.error || !stage.data) throw new Error('Select an active lead status');
  if (stage.data.board_closed ? data.outcome === 'open' : data.outcome !== 'open') throw new Error('Choose Won or Lost only for Deal Closed');
  if (data.source_id) {
    const source = await context.supabase.from('crm_options').select('id').eq('id', data.source_id).eq('category', 'source').eq('is_active', true).single();
    if (source.error) throw new Error('Select an active source');
  }
  const result = await context.supabase.from('leads').insert(leadCreateRecord(data, stage.data.pipeline_id, context.userId)).select('id').single();
  if (result.error) throw new Error(result.error.message);
  return result.data.id;
});