import {readFileSync} from 'node:fs';
import postgres from 'postgres';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
describe.skipIf(process.env['CRM_LICENSE_LOCAL_QA']!=='1')('Direct Meta canonical storage',()=>{
 const sql=postgres({host:'127.0.0.1',port:55441,username:'qa',database:'postgres',max:1,onnotice:()=>{}});
 const company='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';let source='';
 beforeAll(async()=>{
  await sql.unsafe(`DROP SCHEMA public CASCADE;CREATE SCHEMA public;CREATE TABLE companies(id uuid PRIMARY KEY,is_active boolean);CREATE TABLE org_whatsapp_webhook_events(delivery_key text);
  CREATE TABLE integration_platform_policies(provider text,enabled boolean);CREATE FUNCTION integration_provider_allowed(uuid,text,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;CREATE FUNCTION org_feature_allowed(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
  CREATE TABLE crm_pipelines(id uuid PRIMARY KEY,kind text,is_active boolean,is_default boolean,position int);CREATE TABLE crm_stages(id uuid PRIMARY KEY,pipeline_id uuid,kind text,is_active boolean,position int);
  CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid,pipeline_id uuid,stage_id uuid,customer_name text,phone text,email text,form_answers jsonb,intake_source text,meta_lead_id text UNIQUE,meta_page_id text,meta_form_id text,meta_account_id text,meta_campaign_id text,meta_campaign_name text,meta_ad_id text,meta_ad_name text,meta_adset_id text);
  INSERT INTO companies VALUES('${company}',true),('${second}',true);`);
  await sql.unsafe(readFileSync('drizzle/migrations/0113_meta_lead_connections_and_sources.sql','utf8'));await sql.unsafe(readFileSync('drizzle/migrations/0115_meta_source_ownership_guard.sql','utf8'));
  const connection=(await sql`INSERT INTO org_meta_connections(company_id,connected_by) VALUES(${company},${company}) RETURNING id`)[0]?.['id'];source=(await sql`INSERT INTO org_meta_sources(connection_id,company_id,page_id,form_id) VALUES(${connection},${company},'123','456') RETURNING id`)[0]?.['id'];
 });
 afterAll(async()=>{await sql.unsafe('DROP SCHEMA public CASCADE;CREATE SCHEMA public;');await sql.end();});
 it('Meta lead ID deduplication preserves all available answers',async()=>{const payload={meta_lead_id:'987',name:'Submitted name',phone:'+919876543210',form_answers:{full_name:['Submitted name'],custom_question:['Original answer']},account_id:'321',campaign_id:'654',ad_id:'765'};
 const first=(await sql`SELECT meta_canonical_intake(${source},${sql.json(payload)}) id`)[0]?.['id'];expect((await sql`SELECT meta_canonical_intake(${source},${sql.json(payload)}) id`)[0]?.['id']).toBe(first);expect(await sql`SELECT id FROM leads`).toHaveLength(1);expect((await sql`SELECT form_answers FROM leads`)[0]?.['form_answers']).toEqual(payload.form_answers);});
 it('source cannot switch organizations while retaining Page/form identity',async()=>{await expect(sql`UPDATE org_meta_sources SET company_id=${second} WHERE id=${source}`).rejects.toThrow('mismatch');});
 it('Page/form cannot attach to a connection belonging to another company',async()=>{const conn=(await sql`SELECT connection_id FROM org_meta_sources`)[0]?.['connection_id'];await expect(sql`INSERT INTO org_meta_sources(connection_id,company_id,page_id,form_id) VALUES(${conn},${second},'777','888')`).rejects.toThrow('mismatch');});
 it('stored event must match its exact source company/Page/form',async()=>{await expect(sql`INSERT INTO org_meta_events(source_id,company_id,leadgen_id,page_id,form_id,payload) VALUES(${source},${second},'999','123','456','{}')`).rejects.toThrow('source mismatch');});
 it('ordinary browser role cannot invoke privileged intake',async()=>{await sql`GRANT USAGE ON SCHEMA public TO authenticated`;await sql`SET ROLE authenticated`;try{await expect(sql`SELECT meta_canonical_intake(${source},'{}')`).rejects.toThrow('permission denied');}finally{await sql`RESET ROLE`;}});
});