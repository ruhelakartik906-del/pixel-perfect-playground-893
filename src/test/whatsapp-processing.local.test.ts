import {readFileSync} from 'node:fs';
import postgres from 'postgres';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
describe.skipIf(process.env['CRM_LICENSE_LOCAL_QA']!=='1')('WhatsApp durable inbox SQL',()=>{
 const sql=postgres({host:'127.0.0.1',port:55441,username:'qa',database:'postgres',max:1});
 const company='11111111-1111-4111-8111-111111111111',connection='22222222-2222-4222-8222-222222222222';
 beforeAll(async()=>{
  await sql.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE SCHEMA IF NOT EXISTS auth; CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${company}'::uuid$$;
  CREATE TABLE companies(id uuid PRIMARY KEY); CREATE TABLE org_whatsapp_connections(id uuid PRIMARY KEY,company_id uuid,status text,token_ok boolean,webhook_subscribed boolean);
  CREATE TABLE profiles(id uuid PRIMARY KEY,account_status text);CREATE TABLE user_roles(user_id uuid,role text);
  CREATE TABLE whatsapp_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wa_phone text UNIQUE,contact_name text,lead_id uuid,unread_count int DEFAULT 0,last_message_at timestamptz,last_inbound_at timestamptz,company_id uuid,assigned_to uuid);
  CREATE TABLE whatsapp_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid,direction text,body text,wa_message_id text UNIQUE,status text,created_at timestamptz DEFAULT now(),sent_at timestamptz,delivered_at timestamptz,read_at timestamptz,failure_reason text);
  CREATE TABLE org_whatsapp_webhook_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid,connection_id uuid,payload jsonb,processed_at timestamptz,processing_error text);
  CREATE TABLE org_whatsapp_audit(company_id uuid,connection_id uuid,actor uuid,action text,detail jsonb);
  CREATE TABLE org_usage_limits(company_id uuid,monthly_whatsapp_messages bigint); CREATE TABLE integration_platform_policies(provider text,enabled boolean);
  CREATE TABLE access_roles(id uuid,permissions text[]); CREATE TABLE user_access_roles(user_id uuid,role_id uuid);
  CREATE FUNCTION license_active() RETURNS boolean LANGUAGE sql AS $$SELECT true$$; CREATE FUNCTION lead_workspace_active() RETURNS boolean LANGUAGE sql AS $$SELECT true$$; CREATE FUNCTION is_company_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$; CREATE FUNCTION org_feature_allowed(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$; CREATE FUNCTION org_customer_admin(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$; CREATE FUNCTION messaging_allowed(text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$; CREATE FUNCTION ad_routing_eligible(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
  INSERT INTO companies VALUES('${company}'); INSERT INTO org_whatsapp_connections VALUES('${connection}','${company}','connected',true,true);`);
  for(const path of ['0110_org_whatsapp_inbox_processing','0111_wa_tenant_contact_and_usage'])await sql.unsafe(readFileSync(`drizzle/migrations/${path}.sql`,'utf8'));
  await sql.unsafe(readFileSync('drizzle/migrations/0114_wa_message_boundary_and_live_updates.sql','utf8').split('ALTER PUBLICATION')[0]??'');
 });
 afterAll(async()=>{await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');await sql.end();});
 it('persists exact inbound ID and replay increments unread once',async()=>{
  const payload={value:{messages:[{id:'wamid.inbound',from:'919876543210',timestamp:'1793448000',type:'text',text:{body:'Hello'}}]}};
  const rows=await sql`INSERT INTO org_whatsapp_webhook_events(company_id,connection_id,payload) VALUES(${company},${connection},${sql.json(payload)}) RETURNING id`;
  const id=rows[0]?.['id'];expect((await sql`SELECT wa_process_event(${id}) ok`)[0]?.['ok']).toBe(true);expect((await sql`SELECT wa_process_event(${id}) ok`)[0]?.['ok']).toBe(true);
  expect((await sql`SELECT wa_message_id FROM whatsapp_messages`)[0]?.['wa_message_id']).toBe('wamid.inbound');expect((await sql`SELECT unread_count FROM whatsapp_conversations`)[0]?.['unread_count']).toBe(1);
 });
 it('status-before-send remains pending then read is never downgraded',async()=>{
  const c=(await sql`SELECT id FROM whatsapp_conversations`)[0]?.['id'];
  const event=(await sql`INSERT INTO org_whatsapp_webhook_events(company_id,connection_id,payload) VALUES(${company},${connection},${sql.json({value:{statuses:[{id:'wamid.out',timestamp:'1793448001',status:'read'}]}})}) RETURNING id`)[0]?.['id'];
  expect((await sql`SELECT wa_process_event(${event}) ok`)[0]?.['ok']).toBe(false);
  await sql`INSERT INTO whatsapp_messages(conversation_id,direction,wa_message_id,status) VALUES(${c},'outbound','wamid.out','accepted')`;
  expect((await sql`SELECT wa_process_event(${event}) ok`)[0]?.['ok']).toBe(true);
  const old=(await sql`INSERT INTO org_whatsapp_webhook_events(company_id,connection_id,payload) VALUES(${company},${connection},${sql.json({value:{statuses:[{id:'wamid.out',timestamp:'1793448000',status:'sent'}]}})}) RETURNING id`)[0]?.['id'];await sql`SELECT wa_process_event(${old})`;
  expect((await sql`SELECT status,sent_at IS NOT NULL AS stamped FROM whatsapp_messages WHERE wa_message_id='wamid.out'`)[0]).toMatchObject({status:'read',stamped:true});
 });
 it('takeover is persisted and status validates exact allowed values',async()=>{const id=(await sql`SELECT id FROM whatsapp_conversations`)[0]?.['id'];await sql`SELECT wa_inbox_action(${id},'takeover','{}')`;expect((await sql`SELECT human_takeover FROM whatsapp_conversations`)[0]?.['human_takeover']).toBe(true);await expect(sql`SELECT wa_inbox_action(${id},'status','{"status":"invalid"}')`).rejects.toThrow('Invalid status');});
 it('same customer phone on two numbers remains separate by organization',async()=>{
  const second='33333333-3333-4333-8333-333333333333';await sql`INSERT INTO org_whatsapp_connections VALUES(${second},${second},'connected',true,true)`;
  const id=(await sql`INSERT INTO org_whatsapp_webhook_events(company_id,connection_id,payload) VALUES(${second},${second},${sql.json({value:{messages:[{id:'wamid.second',from:'919876543210',timestamp:'1793448001',type:'text',text:{body:'Private second organization'}}]}})}) RETURNING id`)[0]?.['id'];await sql`SELECT wa_process_event(${id})`;
  expect(await sql`SELECT id FROM whatsapp_conversations WHERE provider_phone='919876543210'`).toHaveLength(2);expect((await sql`SELECT company_id FROM whatsapp_conversations WHERE connection_id=${second}`)[0]?.['company_id']).toBe(second);
 });
 it('restrictive message boundary blocks another organization even with permissive legacy read',async()=>{
  await sql.unsafe(`CREATE OR REPLACE FUNCTION public.is_company_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT $2='${company}'::uuid$$;GRANT USAGE ON SCHEMA public,auth TO authenticated;GRANT SELECT ON whatsapp_messages,whatsapp_conversations TO authenticated;ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;CREATE POLICY legacy_broad_read ON whatsapp_messages FOR SELECT TO authenticated USING(true);`);
  await sql`SET ROLE authenticated`;try{expect((await sql`SELECT count(*)::int n FROM whatsapp_messages WHERE wa_message_id='wamid.second'`)[0]?.['n']).toBe(0);expect((await sql`SELECT count(*)::int n FROM whatsapp_messages WHERE wa_message_id='wamid.inbound'`)[0]?.['n']).toBe(1);}finally{await sql`RESET ROLE`;}
 });
});