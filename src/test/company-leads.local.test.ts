import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import postgres from 'postgres';
const enabled=process.env['LEADS_LOCAL_QA']==='1';
describe.skipIf(!enabled)('Company User Leads RPC authorization',()=>{
 const sql=postgres({host:'127.0.0.1',port:55440,database:'postgres',username:'qa',ssl:false,max:1});
 const p='11111111-1111-4111-8111-111111111111',lead='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333';
 let initial:string,closed:string,contacted:string;
 beforeAll(async()=>{
  await sql.unsafe(`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public; CREATE SCHEMA auth;
  DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
  CREATE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('qa.admin',true)='true' AND current_setting('qa.active',true)='true' $$;
  CREATE FUNCTION public.user_crm_company(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1::text=current_setting('qa.company_id',true) AND current_setting('qa.company',true)='true' AND current_setting('qa.active',true)='true' $$;
  CREATE FUNCTION public.user_workspace_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('qa.active',true)='true' $$;
  CREATE TABLE crm_pipelines(id uuid PRIMARY KEY,name text,is_active boolean DEFAULT true);
  CREATE TABLE crm_stages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pipeline_id uuid,kind text,name text,color text,position integer,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now());
  CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pipeline_id uuid,stage_id uuid,assigned_to uuid,company_id uuid,status text DEFAULT 'open',updated_at timestamptz DEFAULT now(),source_id uuid,customer_name text,phone text,email text,business_name text,form_answers jsonb,created_by uuid);
  CREATE TABLE deals(stage_id uuid,company_id uuid,lead_id uuid);
 CREATE TABLE crm_options(id uuid,category text,is_active boolean);
 CREATE TABLE crm_work_items(lead_id uuid);CREATE TABLE sales_proposals(lead_id uuid);CREATE TABLE lead_assignment_events(lead_id uuid);CREATE TABLE automation_executions(lead_id uuid);CREATE TABLE whatsapp_conversations(lead_id uuid);
  CREATE TABLE automation_workflows(conditions jsonb,actions jsonb);
  CREATE TABLE profiles(id uuid,account_status text);
  CREATE TABLE user_roles(user_id uuid,role text);
  CREATE TABLE companies(id uuid PRIMARY KEY,is_active boolean);
  CREATE TABLE company_members(user_id uuid,company_id uuid);
  CREATE TABLE access_roles(id uuid,permissions text[]);
  CREATE TABLE user_access_roles(user_id uuid,role_id uuid);
  INSERT INTO profiles VALUES('${user}','active');
  INSERT INTO user_roles VALUES('${user}','employee');
  INSERT INTO companies VALUES('${p}',true);
  INSERT INTO company_members VALUES('${user}','${p}');
  INSERT INTO access_roles VALUES('${p}',ARRAY['lead.edit']);
  INSERT INTO user_access_roles VALUES('${user}','${p}');
  INSERT INTO crm_pipelines(id,name) VALUES('${p}','Sales');
  INSERT INTO crm_stages(pipeline_id,kind,name,color,position) VALUES('${p}','lead','New','#2684FF',0),('${p}','lead','Contacted','#F59E0B',1),('${p}','lead','Qualified','#22C55E',2);`);
  await sql.unsafe(readFileSync('drizzle/migrations/0070_canonical_leads_board.sql','utf8'));
  await sql.unsafe(readFileSync('drizzle/migrations/0071_lead_stage_reference_guard.sql','utf8'));
  await sql.unsafe(readFileSync('drizzle/migrations/0072_lead_board_fail_closed_access.sql','utf8'));
  await sql.unsafe(readFileSync('drizzle/migrations/0073_authorized_user_lead_status.sql','utf8'));
  await sql.unsafe(readFileSync('drizzle/migrations/0074_company_user_leads.sql','utf8'));
 await sql.unsafe(readFileSync('drizzle/migrations/0075_lock_global_status_management.sql','utf8'));
 const stages=await sql`SELECT id,name FROM crm_stages`;
  initial=String(stages.find(s=>s['name']==='New')?.['id']);closed=String(stages.find(s=>s['name']==='Deal Closed')?.['id']);contacted=String(stages.find(s=>s['name']==='Contacted')?.['id']);
  await sql`INSERT INTO leads(id,pipeline_id,stage_id,assigned_to,company_id) VALUES(${lead},${p},${initial},${user},${p})`;
  await sql`SELECT set_config('qa.company_id',${p},false),set_config('qa.uid',${user},false),set_config('qa.admin','false',false),set_config('qa.active','true',false),set_config('qa.company','true',false)`;
 });
 afterAll(async()=>{await sql.end();});
 async function version(){return String((await sql`SELECT updated_at::text AS stamp FROM leads WHERE id=${lead}`)[0]?.['stamp']);}
 async function move(stage:string,outcome:string|null){return sql`SELECT lead_board_move(${lead},(SELECT updated_at FROM leads WHERE id=${lead}),${stage}::uuid,${outcome})`;}

 const other='44444444-4444-4444-8444-444444444444';let custom:string,created:string;
 async function status(action:string,payload:Record<string,unknown>){return sql`SELECT lead_company_status_action(${action},${sql.json({company_id:p,pipeline_id:p,...payload})}) AS id`;}
 async function stages(){return (await sql`SELECT lead_company_stages(${p}) AS data`)[0]?.['data'] as Array<Record<string,unknown>>;}
 it('active Employee creates permanent company-owned status without changing global defaults',async()=>{const r=await status('create',{name:'Company Custom',color:'#123456',is_default:true});custom=String(r[0]?.['id']);expect((await stages()).find(s=>s['id']===custom)).toMatchObject({board_label:'Company Custom',color:'#123456',is_default:true,company_id:p});expect((await sql`SELECT position,board_label FROM crm_stages WHERE id=${initial}`)[0]).toMatchObject({position:0,board_label:'All Leads'});});
 it('saves edited name/color for this company only',async()=>{await status('edit',{id:contacted,name:'Company Contacted',color:'#654321',is_default:false});expect((await stages()).find(s=>s['id']===contacted)).toMatchObject({board_label:'Company Contacted',color:'#654321'});expect((await sql`SELECT board_label FROM crm_stages WHERE id=${contacted}`)[0]?.['board_label']).toBe('Contacted');});
 it('persists order shared by status list and Board',async()=>{const ids=(await stages()).map(s=>String(s['id']));ids.splice(ids.indexOf(custom),1);ids.splice(1,0,custom);await status('reorder',{ids});expect((await stages())[1]?.['id']).toBe(custom);expect((await stages())[1]?.['is_default']).toBe(true);});
 it('denies other-company status writes and reads',async()=>{await sql`INSERT INTO companies VALUES(${other},true)`;await expect(status('create',{company_id:other,name:'Denied',color:'#123456'})).rejects.toThrow('access denied');await expect(sql`SELECT lead_company_stages(${other})`).rejects.toThrow('access denied');});
 it('custom status never appears in another company',async()=>{await sql`SELECT set_config('qa.company_id',${other},false)`;const r=await sql`SELECT lead_company_stages(${other}) AS data`;expect(r[0]?.['data'].some((v:Record<string,unknown>)=>v['id']===custom)).toBe(false);await sql`SELECT set_config('qa.company_id',${p},false)`;});
 it('denies PENDING and BLOCKED status/create/delete actions',async()=>{for(const state of ['pending','blocked']){await sql`UPDATE profiles SET account_status=${state}`;await expect(status('create',{name:'Denied',color:'#123456'})).rejects.toThrow('access denied');await expect(sql`SELECT user_board_lead_create(${sql.json({company_id:p,stage_id:initial})})`).rejects.toThrow('access denied');await expect(sql`SELECT user_board_lead_delete(${lead},(SELECT updated_at FROM leads WHERE id=${lead}))`).rejects.toThrow('access denied');}await sql`UPDATE profiles SET account_status='active'`;});
 it('denies missing permitted membership and clients',async()=>{await sql`SELECT set_config('qa.company','false',false)`;await expect(status('edit',{id:contacted,name:'Denied',color:'#123456'})).rejects.toThrow('access denied');await sql`SELECT set_config('qa.company','true',false)`;await sql`UPDATE user_roles SET role='client'`;await expect(status('create',{name:'Denied',color:'#123456'})).rejects.toThrow('access denied');await sql`UPDATE user_roles SET role='employee'`;});
 it('old explicitly granted global RPC cannot bypass company isolation',async()=>{await sql`UPDATE access_roles SET permissions=ARRAY['lead_status.create','lead_status.edit','lead_status.delete']`;await expect(sql`SELECT lead_status_action('edit',${sql.json({pipeline_id:p,id:contacted,name:'Global denied',color:'#123456'})})`).rejects.toThrow('permission required');});
 it('creates canonical self-assigned lead with all optional fields retained',async()=>{const payload={company_id:p,stage_id:custom,customer_name:'Scoped QA',phone:'+919876543210',email:'qa@example.test',business_name:'QA',status:'open',form_answers:{Date:'2026-10-21',Label:'QA','Estimate Amount':42,Reference:'Ref',Address:'Address','Lead From':'Manual'}};const r=await sql`SELECT user_board_lead_create(${sql.json({...payload,assigned_to:other,created_by:other})}) AS id`;created=String(r[0]?.['id']);expect((await sql`SELECT assigned_to,created_by,company_id,stage_id,form_answers FROM leads WHERE id=${created}`)[0]).toMatchObject({assigned_to:user,created_by:user,company_id:p,stage_id:custom,form_answers:payload.form_answers});});
 it('rejects cross-company creation and move to another company custom status',async()=>{await expect(sql`SELECT user_board_lead_create(${sql.json({company_id:other,stage_id:initial})})`).rejects.toThrow('access denied');await sql`SELECT set_config('qa.company_id',${other},false)`;const r=await sql`SELECT lead_company_status_action('create',${sql.json({company_id:other,pipeline_id:p,name:'Other custom',color:'#123456'})}) AS id`;await sql`SELECT set_config('qa.company_id',${p},false)`;await expect(move(String(r[0]?.['id']),null)).rejects.toThrow('unavailable');});
 it('moves assigned real lead between stages and preserves protected stages',async()=>{await move(custom,null);expect((await sql`SELECT stage_id FROM leads WHERE id=${lead}`)[0]?.['stage_id']).toBe(custom);await move(contacted,null);await expect(status('delete',{id:initial})).rejects.toThrow('Protected');await expect(status('delete',{id:closed})).rejects.toThrow('Protected');await expect(status('delete',{id:custom})).rejects.toThrow('in use');});
 it('rejects deleting another assignee or stale lead',async()=>{await sql`SELECT set_config('qa.uid',${other},false)`;await expect(sql`SELECT user_board_lead_delete(${created},(SELECT updated_at FROM leads WHERE id=${created}))`).rejects.toThrow('access denied');await sql`SELECT set_config('qa.uid',${user},false)`;await expect(sql`SELECT user_board_lead_delete(${created},'2000-01-01'::timestamptz)`).rejects.toThrow('Refresh');});
 it('linked history blocks deletion',async()=>{await sql`INSERT INTO crm_work_items VALUES(${created})`;await expect(sql`SELECT user_board_lead_delete(${created},(SELECT updated_at FROM leads WHERE id=${created}))`).rejects.toThrow('linked history');await sql`DELETE FROM crm_work_items WHERE lead_id=${created}`;});
 it('deletes unused own lead and removes company status from both read surfaces',async()=>{await sql`SELECT user_board_lead_delete(${created},(SELECT updated_at FROM leads WHERE id=${created}))`;expect(await sql`SELECT id FROM leads WHERE id=${created}`).toHaveLength(0);await status('delete',{id:custom});expect((await stages()).some(s=>s['id']===custom)).toBe(false);expect(await sql`SELECT id FROM crm_stages WHERE id=${custom}`).toHaveLength(1);});
});
