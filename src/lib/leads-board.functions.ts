import { z } from 'zod';
import { parseCompanyStages } from './leads-board';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { boardMoveSchema, statusActionSchema } from './leads-board';
export const loadLeadStatusAccess = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const allowed = async(action:string)=>{const result=await context.supabase.rpc('lead_status_allowed',{_action:action});if(result.error)throw new Error('Status permissions could not be verified');return result.data===true;};
  const [create,edit,remove]=await Promise.all(['create','edit','delete'].map(allowed));
  return {create:!!create,edit:!!edit,delete:!!remove};
});
export const moveBoardLead = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>boardMoveSchema.parse(input)).handler(async({data,context})=>{
  const result=await context.supabase.rpc('lead_board_move',{_id:data.id,_updated_at:data.updated_at,_stage:data.stage_id,...(data.outcome ? {_outcome:data.outcome} : {})});
  if(result.error) throw new Error(result.error.message); return result.data;
});
export const manageLeadStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>statusActionSchema.parse(input)).handler(async({data,context})=>{
  const result=data.company_id ? await context.supabase.rpc('lead_company_status_action',{_action:data.action,_payload:data}) : await context.supabase.rpc('lead_status_action',{_action:data.action,_payload:data});
  if(result.error) throw new Error(result.error.message); return result.data;
});
export const loadCompanyLeadStages=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({company_id:z.string().uuid()}).parse(v)).handler(async({data,context})=>{const result=await context.supabase.rpc('lead_company_stages',{_company:data.company_id});if(result.error)throw new Error(result.error.message);return parseCompanyStages(result.data);});
export const deleteUserBoardLead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),updated_at:z.string().datetime({offset:true})}).parse(v)).handler(async({data,context})=>{const result=await context.supabase.rpc('user_board_lead_delete',{_id:data.id,_updated_at:data.updated_at});if(result.error)throw new Error(result.error.message);return result.data;});
