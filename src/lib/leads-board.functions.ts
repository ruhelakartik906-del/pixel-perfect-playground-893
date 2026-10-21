import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { boardMoveSchema, statusActionSchema } from './leads-board';
export const moveBoardLead = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>boardMoveSchema.parse(input)).handler(async({data,context})=>{
  const result=await context.supabase.rpc('lead_board_move',{_id:data.id,_updated_at:data.updated_at,_stage:data.stage_id,_outcome:data.outcome ?? undefined});
  if(result.error) throw new Error(result.error.message); return result.data;
});
export const manageLeadStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>statusActionSchema.parse(input)).handler(async({data,context})=>{
  const result=await context.supabase.rpc('lead_status_action',{_action:data.action,_payload:data});
  if(result.error) throw new Error(result.error.message); return result.data;
});