import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { userTaskSchema } from './user-phase2';
import type { Json } from '@/integrations/supabase/types';

export const commitSpreadsheet=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({page:z.enum(['task','follow_up','admin_task','admin_follow_up']),draft:z.string().uuid(),payload:userTaskSchema}).parse(v)).handler(async({context,data})=>{const r=await context.supabase.rpc('spreadsheet_commit',{_page:data.page,_draft:data.draft,_payload:data.payload});if(r.error)throw new Error(r.error.message);return r.data;});
export const saveTableCell=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({table:z.string().uuid(),row:z.string().uuid(),field:z.string(),value:z.unknown()}).parse(v)).handler(async({context,data})=>{const r=await context.supabase.rpc('spreadsheet_table_cell',{_table:data.table,_row:data.row,_field:data.field,_value:data.value as Json});if(r.error)throw new Error(r.error.message);return r.data;});

export const gridAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({page:z.enum(['task','follow_up','admin_task','admin_follow_up']),action:z.enum(['columns','add','draft_cell','delete_draft','custom']),id:z.string().uuid().optional(),field:z.string().max(200).optional(),value:z.unknown().optional()}).parse(v)).handler(async({context,data})=>{
 const r=await context.supabase.rpc('spreadsheet_grid_action',{_page:data.page,_action:data.action,...(data.id?{_id:data.id}:{}),...(data.field?{_field:data.field}:{}),...(data.value!==undefined?{_value:data.value as Json}:{})});if(r.error)throw new Error(r.error.message);return r.data;
});
export const saveSpreadsheetCell=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),origin:z.enum(['personal','company']),field:z.string(),value:z.unknown()}).parse(v)).handler(async({context,data})=>{
 const r=await context.supabase.rpc('spreadsheet_work_cell',{_id:data.id,_origin:data.origin,_field:data.field,_value:data.value as Json});if(r.error)throw new Error(r.error.message);return r.data;
});
export const assignSpreadsheetWork=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>userTaskSchema.parse(v)).handler(async({context,data})=>{
 const admin=await context.supabase.rpc('routing_admin');if(admin.error||!admin.data)throw new Error('Administrator access required');
 const r=await context.supabase.rpc('user_work_action',{_action:'save',_payload:data});if(r.error)throw new Error(r.error.message);return r.data;
});