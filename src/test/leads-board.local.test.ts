import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import postgres from 'postgres';
const enabled=process.env['LEADS_LOCAL_QA']==='1';
describe.skipIf(!enabled)('Actual lead RPCs in disposable local database',()=>{
 const sql=postgres({host:'127.0.0.1',port:55440,database:'postgres',username:'qa',ssl:false,max:1});
 const p='11111111-1111-4111-8111-111111111111',lead='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333';
 let initial:string,closed:string,contacted:string;
 beforeAll(async()=>{
  await sql.unsafe(`CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
  CREATE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('qa.admin',true)='true' AND current_setting('qa.active',true)='true' $$;
  CREATE FUNCTION public.user_crm_company(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('qa.company',true)='true' AND current_setting('qa.active',true)='true' $$;
  CREATE TABLE crm_pipelines(id uuid PRIMARY KEY,name text);
  CREATE TABLE crm_stages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pipeline_id uuid,kind text,name text,color text,position integer,is_active boolean DEFAULT true);
  CREATE TABLE leads(id uuid PRIMARY KEY,pipeline_id uuid,stage_id uuid,assigned_to uuid,company_id uuid,status text DEFAULT 'open',updated_at timestamptz DEFAULT now());
  CREATE TABLE deals(stage_id uuid);
  CREATE TABLE automation_workflows(conditions jsonb,actions jsonb);
  INSERT INTO crm_pipelines VALUES('${p}','Sales');
  INSERT INTO crm_stages(pipeline_id,kind,name,color,position) VALUES('${p}','lead','New','#2684FF',0),('${p}','lead','Contacted','#F59E0B',1),('${p}','lead','Qualified','#22C55E',2);`);
  await sql.unsafe(readFileSync('drizzle/migrations/0070_canonical_leads_board.sql','utf8'));
  await sql.unsafe(readFileSync('drizzle/migrations/0071_lead_stage_reference_guard.sql','utf8'));
  const stages=await sql`SELECT id,name FROM crm_stages`;
  initial=String(stages.find(s=>s['name']==='New')?.['id']);closed=String(stages.find(s=>s['name']==='Deal Closed')?.['id']);contacted=String(stages.find(s=>s['name']==='Contacted')?.['id']);
  await sql`INSERT INTO leads(id,pipeline_id,stage_id,assigned_to,company_id) VALUES(${lead},${p},${initial},${user},${p})`;
  await sql`SELECT set_config('qa.uid',${user},false),set_config('qa.admin','false',false),set_config('qa.active','true',false),set_config('qa.company','true',false)`;
 });
 afterAll(async()=>{await sql.end();});
 async function version(){return String((await sql`SELECT updated_at::text AS stamp FROM leads WHERE id=${lead}`)[0]?.['stamp']);}
 async function move(stage:string,outcome:string|null){return sql`SELECT lead_board_move(${lead},${await version()}::timestamptz,${stage}::uuid,${outcome})`;}
 it('creates the six requested default labels without replacing legacy names',async()=>{const rows=await sql`SELECT name,board_label FROM crm_stages ORDER BY position`;expect(rows.map(r=>r['board_label'])).toEqual(['All Leads','Contacted','Interested','Follow-up','Negotiation','Deal Closed']);expect(rows[0]?.['name']).toBe('New');expect(rows[2]?.['name']).toBe('Qualified');});
 it('saves Won with Deal Closed in one update',async()=>{await move(closed,'won');expect((await sql`SELECT stage_id,status FROM leads`)[0]).toMatchObject({stage_id:closed,status:'won'});});
 it('saves Lost in the same closed stage',async()=>{await move(closed,'lost');expect((await sql`SELECT stage_id,status FROM leads`)[0]).toMatchObject({stage_id:closed,status:'lost'});});
 it('reopening clears the closed outcome',async()=>{await move(contacted,null);expect((await sql`SELECT stage_id,status FROM leads`)[0]).toMatchObject({stage_id:contacted,status:'open'});});
 it('requires explicit closed outcome and rejects stale updates',async()=>{await expect(move(closed,null)).rejects.toThrow('Choose Won or Lost');await expect(sql`SELECT lead_board_move(${lead},'2000-01-01'::timestamptz,${contacted}::uuid,NULL)`).rejects.toThrow('Refresh');});
 it('denies another user’s lead',async()=>{await sql`SELECT set_config('qa.uid',${p},false)`;await expect(move(contacted,null)).rejects.toThrow('access denied');await sql`SELECT set_config('qa.uid',${user},false)`;});
 it('denies wrong-company and inactive callers',async()=>{await sql`SELECT set_config('qa.company','false',false)`;await expect(move(contacted,null)).rejects.toThrow('access denied');await sql`SELECT set_config('qa.company','true',false),set_config('qa.active','false',false)`;await expect(move(contacted,null)).rejects.toThrow('access denied');await sql`SELECT set_config('qa.active','true',false)`;});
 it('denies Employee status management',async()=>{await expect(sql`SELECT lead_status_action('create',${sql.json({pipeline_id:p,name:'QA',color:'#123456'})})`).rejects.toThrow('Only authorized Admins');});
 it('protects initial and closed stages and referenced stages',async()=>{await expect(sql`DELETE FROM crm_stages WHERE id=${initial}`).rejects.toThrow('cannot be deleted');await expect(sql`DELETE FROM crm_stages WHERE id=${closed}`).rejects.toThrow('cannot be deleted');await expect(sql`DELETE FROM crm_stages WHERE id=${contacted}`).rejects.toThrow('in use');await expect(sql`UPDATE crm_stages SET position=1 WHERE id=${initial}`).rejects.toThrow('first');});
 it('Admin can create edit reorder and delete an unused status',async()=>{await sql`SELECT set_config('qa.admin','true',false)`;const result=await sql`SELECT lead_status_action('create',${sql.json({pipeline_id:p,name:'QA custom',color:'#123456'})}) AS id`;const id=String(result[0]?.['id']);await sql`SELECT lead_status_action('edit',${sql.json({pipeline_id:p,id,name:'QA updated',color:'#654321'})})`;expect((await sql`SELECT board_label,color FROM crm_stages WHERE id=${id}`)[0]).toMatchObject({board_label:'QA updated',color:'#654321'});const ids=(await sql`SELECT id FROM crm_stages ORDER BY position`).map(r=>String(r['id']));const last=ids.pop();if(!last)throw new Error('Missing stage');ids.splice(2,0,last);await sql`SELECT lead_status_action('reorder',${sql.json({pipeline_id:p,ids})})`;expect((await sql`SELECT position FROM crm_stages WHERE id=${id}`)[0]?.['position']).toBe(2);await sql`SELECT lead_status_action('delete',${sql.json({pipeline_id:p,id})})`;expect(await sql`SELECT id FROM crm_stages WHERE id=${id}`).toHaveLength(0);});
});