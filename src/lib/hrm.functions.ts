import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { hrModules,hrTables,validateRecord,attendanceSchema,leaveSchema,payrollSchema,validateFile,type HrRow } from './hrm-model';
import type { Json } from '@/integrations/supabase/types';
const moduleSchema=z.enum(hrModules);
export const getHrmWorkspace=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({module:moduleSchema,month:z.string().regex(/^\d{4}-\d{2}$/).optional()}).parse(v)).handler(async({context,data})=>{
 const db=context.supabase as any;
 const tables=[hrTables[data.module],'companies','hr_branches','hr_designations','hr_departments','access_roles'];
 const readRows=async(table:string,order='created_at')=>{const all:HrRow[]=[];for(let offset=0;;offset+=1000){const r=await db.from(table).select('*').order(order,{ascending:false}).order('id').range(offset,offset+999);if(r.error)throw new Error(r.error.message);all.push(...(r.data||[]));if(r.data.length<1000)return all;}};
 const result=await Promise.all(tables.map(table=>readRows(table,table==='access_roles'?'name':'created_at')));
 const people=await context.supabase.rpc('hrm_people');if(people.error)throw new Error(people.error.message);
 const perms=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'super_admin'});
 const extra:Record<string,HrRow[]>={};
 const extraTables=data.module==='calendar'?{holidays:'hr_holidays',leaves:'hr_leave_requests',meetings:'hr_meetings',schedules:'hr_schedules'}:['attendance','payroll'].includes(data.module)?{attendance:'hr_attendance',holidays:'hr_holidays',leaves:'hr_leave_requests'}:{};
 for(const [key,table] of Object.entries(extraTables))extra[key]=await readRows(table);
 if(data.module==='leave'){const r=await context.supabase.from('hr_leave_balances').select('*');if(r.error)throw new Error(r.error.message);extra['balances']=r.data;}
 if(data.module==='document'){const r=await context.supabase.from('hr_document_versions').select('*').order('created_at',{ascending:false});if(r.error)throw new Error(r.error.message);extra['versions']=r.data;}
 return {rows:result[0]||[],companies:result[1]||[],branches:result[2]||[],designations:result[3]||[],departments:result[4]||[],roles:result[5]||[],people:(people.data||[]) as HrRow[],userId:context.userId,isAdmin:perms.data===true,extra};
});
export const mutateHrm=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({module:moduleSchema,action:z.enum(['save','delete']),id:z.string().uuid().optional(),payload:z.record(z.unknown()).optional()}).parse(v)).handler(async({context,data})=>{
 if(['attendance','leave','payroll'].includes(data.module))throw new Error('Use the audited action');
 const db=context.supabase as any;const table=hrTables[data.module];
 if(data.action==='delete') {if(!data.id)throw new Error('Record required'); const old=await db.from(table).select('*').eq('id',data.id).single();if(old.error)throw new Error('Record not found or access denied');
 if(data.module==='document'){const permission=await context.supabase.rpc('hrm_allowed',{_module:'hr_document',_action:'delete',_company:old.data.company_id});if(!permission.data)throw new Error('Document delete permission required');const r=await db.from(table).update({status:'archived'}).eq('id',data.id).select('id').single();if(r.error)throw new Error(r.error.message);return r.data.id as string;}
 const r=await db.from(table).delete().eq('id',data.id).select('id').single();if(r.error)throw new Error(r.error.message);return r.data.id as string;}
 const payload=validateRecord(data.module,data.payload);
 const r=data.id?await db.from(table).update(payload).eq('id',data.id).select('id').single():await db.from(table).insert({...payload,...(['branch','designation'].includes(data.module)?{}:{created_by:context.userId})}).select('id').single();
 if(r.error)throw new Error(r.error.message.includes('duplicate')?'A matching record already exists':r.error.message);return r.data.id as string;
});
export const hrmControlledAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({module:z.enum(['attendance','leave','payroll','meeting']),action:z.string().max(30),payload:z.record(z.unknown())}).parse(v)).handler(async({context,data})=>{
 let p:Record<string,unknown>=data.payload;
 if(data.module==='attendance'){if(data.action==='manual')p=attendanceSchema.parse(p);else if(['check_in','check_out'].includes(data.action))p={};else throw new Error('Invalid attendance action');}
 if(data.module==='leave'){if(data.action==='request')p=leaveSchema.parse(p);else if(data.action==='balance')p=z.object({employee_id:z.string().uuid(),kind:z.enum(['casual','sick','earned','other']),year:z.coerce.number().int().min(2000).max(2200),entitlement:z.coerce.number().min(0).max(366),reason:z.string().trim().min(3).max(2000)}).strict().parse(p);else{if(!['approve','reject','correction','cancel'].includes(data.action))throw new Error('Invalid leave action');p=z.object({id:z.string().uuid(),reason:z.string().max(2000).optional()}).strict().parse(p);}}
 if(data.module==='payroll'){if(data.action==='save')p=payrollSchema.parse(p);else if(data.action==='paid')p=z.object({id:z.string().uuid(),reference:z.string().trim().min(3).max(200),confirmed:z.literal(true)}).strict().parse(p);else if(data.action==='correct')p=z.object({id:z.string().uuid(),reason:z.string().trim().min(10).max(2000),confirmed:z.literal(true)}).strict().parse(p);else throw new Error('Invalid payroll action');}
 if(data.module==='meeting'){const v=z.object({id:z.string().uuid(),response:z.enum(['accepted','declined','tentative'])}).strict().parse(p);const r=await context.supabase.rpc('hrm_meeting_response',{_meeting:v.id,_response:v.response});if(r.error)throw new Error(r.error.message);return v.id;}
 const r=await (context.supabase as any).rpc(`hrm_${data.module}_action`,{_action:data.action,_payload:p as Json});if(r.error)throw new Error(r.error.message);return r.data as string;
});
export const getHrmHistory=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid()}).parse(v)).handler(async({context,data})=>{const r=await context.supabase.from('hr_audit_logs').select('*').eq('entity_id',data.id).order('created_at',{ascending:false});if(r.error)throw new Error(r.error.message);return r.data;});
export const uploadHrmFile=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),filename:z.string().min(1).max(200),mime:z.string().max(150),base64:z.string().max(14000000)}).parse(v)).handler(async({context,data})=>{
 const doc=await context.supabase.from('hr_documents').select('*').eq('id',data.id).single();if(doc.error)throw new Error('Document not found or access denied');
 const permission=await context.supabase.rpc('hrm_allowed',{_module:'hr_document',_action:'edit',_company:doc.data.company_id});const create=await context.supabase.rpc('hrm_allowed',{_module:'hr_document',_action:'create',_company:doc.data.company_id});if(!permission.data&&!(create.data&&doc.data.created_by===context.userId))throw new Error('Document write permission required');
 const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));validateFile(bytes.length,data.mime);
 const prefix=Array.from(bytes.slice(0,8));if(data.mime==='application/pdf'&&String.fromCharCode(...prefix.slice(0,5))!=='%PDF-')throw new Error('Invalid PDF');if(data.mime==='image/png'&&prefix.slice(0,4).join(',')!=='137,80,78,71')throw new Error('Invalid PNG');if(data.mime==='image/jpeg'&&(prefix[0]!==255||prefix[1]!==216))throw new Error('Invalid JPEG');if(data.mime.includes('openxmlformats')&&(prefix[0]!==80||prefix[1]!==75))throw new Error('Invalid Office file');if(data.mime==='text/plain'&&bytes.includes(0))throw new Error('Invalid text file');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const path=`${doc.data.company_id}/${data.id}/${crypto.randomUUID()}/${data.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const upload=await supabaseAdmin.storage.from('hrm-private-files').upload(path,bytes,{contentType:data.mime,upsert:false});if(upload.error)throw new Error('Private upload failed');
 const version=await context.supabase.rpc('hrm_document_version',{_document:data.id,_path:path,_filename:data.filename,_mime:data.mime,_size:bytes.length});if(version.error){await supabaseAdmin.storage.from('hrm-private-files').remove([path]);throw new Error(version.error.message);}return version.data;
});
export const downloadHrmFile=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid(),versionId:z.string().uuid().optional()}).parse(v)).handler(async({context,data})=>{
 const access=await context.supabase.rpc('hrm_document_access',{_document:data.id});if(access.error)throw new Error('Document access denied');
 let q=context.supabase.from('hr_document_versions').select('*').eq('document_id',data.id).order('created_at',{ascending:false}).limit(1);if(data.versionId)q=q.eq('id',data.versionId);const v=await q.single();if(v.error)throw new Error('No file version is available');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const result=await supabaseAdmin.storage.from('hrm-private-files').createSignedUrl(v.data.path,60,{download:v.data.filename});if(result.error)throw new Error('Download could not be authorized');
 const publicOrigin=new URL(import.meta.env['VITE_SUPABASE_URL']).origin;const url=new URL(result.data.signedUrl);url.protocol=new URL(publicOrigin).protocol;url.host=new URL(publicOrigin).host;return {url:url.toString(),filename:v.data.filename};
});
