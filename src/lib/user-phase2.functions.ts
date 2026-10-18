import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { columnSchema,dealSchema,userTaskSchema } from './user-phase2';
export const loadUserPhase2=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const db=context.supabase;const access=await db.rpc('user_workspace_allowed');if(access.error||!access.data)throw new Error('Workspace access required');
 async function all<T>(fn:(offset:number)=>PromiseLike<{data:T[]|null;error:unknown}>){const rows:T[]=[];for(let o=0;;o+=1000){const r=await fn(o);if(r.error)throw new Error('Workspace records could not be loaded');rows.push(...r.data??[]);if((r.data?.length??0)<1000)return rows;}}
 const [companies,leads,deals,companyWork,personal,stages,meetings,history,personalHistory,dealHistory,tables,profile]=await Promise.all([
 all(o=>db.from('companies').select('id,name').eq('is_active',true).order('id').range(o,o+999)),
 all(o=>db.from('leads').select('id,company_id,customer_name,phone,email,business_name').eq('assigned_to',context.userId).order('id').range(o,o+999)),
 all(o=>db.from('deals').select('*').eq('assigned_to',context.userId).is('deleted_at',null).order('id').range(o,o+999)),
 all(o=>db.from('crm_work_items').select('*').eq('assigned_to',context.userId).is('deleted_at',null).order('id').range(o,o+999)),
 all(o=>db.from('personal_crm_tasks').select('*').eq('owner_id',context.userId).is('deleted_at',null).order('id').range(o,o+999)),
 all(o=>db.from('crm_stages').select('*').eq('kind','deal').eq('is_active',true).order('position').order('id').range(o,o+999)),
 all(o=>db.from('hr_meetings').select('id,title,start_at,end_at,status,details').order('id').range(o,o+999)),
 all(o=>db.from('crm_work_history').select('*').order('id').range(o,o+999)),
 all(o=>db.from('personal_task_history').select('*').order('id').range(o,o+999)),
 all(o=>db.from('deal_activity_history').select('*').order('id').range(o,o+999)),
 all(o=>db.from('user_work_tables').select('*').order('updated_at').order('id').range(o,o+999)),
 db.from('profiles').select('full_name,email').eq('id',context.userId).single()]);
 const work=[...companyWork.map(w=>({...w,origin:'company' as const})),...personal.map(w=>({...w,origin:'personal' as const,assigned_to:w.owner_id,created_by:w.owner_id,company_id:'',lead_id:null,deal_id:null}))];
 const ownWork=new Set(work.map(w=>w.id)),ownDeals=new Set(deals.map(d=>d.id));
 return {userId:context.userId,name:profile.data?.full_name||profile.data?.email||'My account',companies,leads,deals,work,stages,meetings,tables,history:[...history.filter(h=>ownWork.has(h.work_id)),...personalHistory.filter(h=>ownWork.has(h.task_id)).map(h=>({...h,work_id:h.task_id}))],dealHistory:dealHistory.filter(h=>ownDeals.has(h.deal_id))};
});
export type Phase2Data=Awaited<ReturnType<typeof loadUserPhase2>>;
export const saveUserWork=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>userTaskSchema.parse(v)).handler(async({context,data})=>{const r=await context.supabase.rpc('user_work_action',{_action:'save',_payload:data});if(r.error)throw new Error(r.error.message);return r.data;});
export const changeUserWork=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),version:z.number().int().positive(),origin:z.enum(['personal','company']),action:z.enum(['status','delete']),status:z.enum(['not_started','in_progress','scheduled','completed','skipped']).optional()}).parse(v)).handler(async({context,data})=>{const r=await context.supabase.rpc('user_work_action',{_action:data.action,_payload:data});if(r.error)throw new Error(r.error.message);return r.data;});
export const saveUserDeal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>dealSchema.parse(v)).handler(async({context,data})=>{const r=await context.supabase.rpc('user_deal_action',{_action:'save',_payload:data});if(r.error)throw new Error(r.error.message);return r.data;});
export const changeUserDeal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),updated_at:z.string(),action:z.enum(['status','note','delete']),status:z.enum(['open','won','lost']).optional(),note:z.string().trim().min(1).max(5000).optional()}).parse(v)).handler(async({context,data})=>{const r=await context.supabase.rpc('user_deal_action',{_action:data.action,_payload:data});if(r.error)throw new Error(r.error.message);return r.data;});
export const tableAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({action:z.enum(['create','configure','duplicate_table','delete_table','save_row','duplicate_row','delete_row','move_row']),table_id:z.string().uuid().optional(),id:z.string().uuid().optional(),version:z.number().int().positive().optional(),name:z.string().trim().min(1).max(200).optional(),columns:z.array(columnSchema).optional(),preferences:z.record(z.unknown()).optional(),values:z.record(z.unknown()).optional(),lead_id:z.string().uuid().nullable().optional(),deal_id:z.string().uuid().nullable().optional(),task_id:z.string().uuid().nullable().optional(),neighbor:z.string().uuid().optional()}).parse(v)).handler(async({context,data})=>{const {action,...payload}=data;const r=await context.supabase.rpc('user_table_action',{_action:action,_payload:payload as import('@/integrations/supabase/types').Json});if(r.error)throw new Error(r.error.message);return r.data;});
export const loadTableRows=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),page:z.number().int().min(1),q:z.string().max(200).default(''),sort:z.string().regex(/^[A-Za-z0-9_-]*$/).default(''),descending:z.boolean().default(false),filter:z.string().default(''),value:z.string().max(200).default('')}).parse(v)).handler(async({context,data})=>{
 const r=await context.supabase.rpc('user_table_rows_page',{_table:data.id,_page:data.page,_q:data.q,_sort:data.sort,_descending:data.descending,_filter:data.filter,_value:data.value});if(r.error)throw new Error('Table rows could not be loaded');
 const result=r.data as {rows:import('@/integrations/supabase/types').Database['public']['Tables']['user_work_rows']['Row'][];count:number};return result;
});
