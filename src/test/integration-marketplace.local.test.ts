import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe.skipIf(process.env['CRM_LICENSE_LOCAL_QA'] !== '1')('Marketplace database authorization', () => {
  const sql = postgres({ host: '127.0.0.1', port: 55441, username: 'qa', database: 'postgres', ssl: false, max: 1 });
  const owner = '11111111-1111-4111-8111-111111111111', employee = '22222222-2222-4222-8222-222222222222', company = '33333333-3333-4333-8333-333333333333';
  beforeAll(async () => {
    await sql.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
      CREATE TABLE companies(id uuid PRIMARY KEY,is_active boolean); CREATE TABLE plans(id uuid PRIMARY KEY);
      CREATE TABLE org_subscriptions(company_id uuid,plan_id uuid); CREATE TABLE access_roles(id uuid,permissions text[]); CREATE TABLE user_access_roles(user_id uuid,role_id uuid);
      CREATE TABLE org_whatsapp_connections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid,status text);
      CREATE FUNCTION routing_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid()='${owner}'::uuid $$;
      CREATE FUNCTION license_active() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE FUNCTION lead_workspace_active() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() IS NOT NULL $$;
      CREATE FUNCTION is_company_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IN ('${owner}'::uuid,'${employee}'::uuid) AND $2='${company}'::uuid $$;
      CREATE FUNCTION org_customer_admin(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${owner}'::uuid AND $2='${company}'::uuid $$;
      CREATE FUNCTION org_feature_allowed(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      INSERT INTO companies VALUES('${company}',true); SELECT set_config('qa.uid','${owner}',false);`);
    await sql.unsafe(readFileSync('drizzle/migrations/0109_integration_marketplace_controls.sql', 'utf8'));
  });
  afterAll(async () => { await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); await sql.end(); });
  it('customer manages own organization but never another', async () => {
    expect((await sql`SELECT integration_provider_allowed(${company},'whatsapp','manage') ok`)[0]?.['ok']).toBe(true);
    expect((await sql`SELECT integration_provider_allowed('44444444-4444-4444-8444-444444444444','whatsapp','manage') ok`)[0]?.['ok']).toBe(false);
  });
  it('employee cannot manage or use without required grants', async () => {
    await sql`SELECT set_config('qa.uid',${employee},false)`;
    expect((await sql`SELECT integration_provider_allowed(${company},'whatsapp','manage') ok`)[0]?.['ok']).toBe(false);
    expect((await sql`SELECT integration_provider_allowed(${company},'whatsapp','use') ok`)[0]?.['ok']).toBe(false);
    await expect(sql`SELECT master_save_integration_policy('whatsapp',true,NULL,NULL,'{}')`).rejects.toThrow('Super Admin');
    await sql`SELECT set_config('qa.uid',${owner},false)`;
  });
  it('global disable blocks management and saves audit', async () => {
    await sql`SELECT master_save_integration_policy('whatsapp',false,NULL,NULL,'{}')`;
    expect((await sql`SELECT integration_provider_allowed(${company},'whatsapp','manage') ok`)[0]?.['ok']).toBe(false);
    expect(await sql`SELECT id FROM integration_platform_audit`).toHaveLength(1);
  });
  it('zero connection cap denies insertion while null permits it', async () => {
    await sql`SELECT master_save_integration_policy('whatsapp',true,NULL,0,'{}')`;
    await expect(sql`INSERT INTO org_whatsapp_connections(company_id,status) VALUES(${company},'pending')`).rejects.toThrow('connection limit');
    await sql`SELECT master_save_integration_policy('whatsapp',true,NULL,NULL,'{}')`;
    await sql`INSERT INTO org_whatsapp_connections(company_id,status) VALUES(${company},'pending')`;
    expect(await sql`SELECT id FROM org_whatsapp_connections`).toHaveLength(1);
  });
  it('explicit empty plan access denies a legacy organization', async () => {
    await sql`SELECT master_save_integration_policy('whatsapp',true,'{}',NULL,'{}')`;
    expect((await sql`SELECT integration_provider_allowed(${company},'whatsapp','view') ok`)[0]?.['ok']).toBe(false);
  });
  it('OAuth attempts reject other users, expire and cannot replay', async () => {
    await sql`INSERT INTO integration_oauth_attempts(user_id,company_id,provider,nonce_hash) VALUES(${owner},${company},'whatsapp','hash')`;
    expect((await sql`SELECT integration_consume_attempt(${employee},${company},'whatsapp','hash') ok`)[0]?.['ok']).toBe(false);
    expect((await sql`SELECT integration_consume_attempt(${owner},${company},'whatsapp','hash') ok`)[0]?.['ok']).toBe(true);
    expect((await sql`SELECT integration_consume_attempt(${owner},${company},'whatsapp','hash') ok`)[0]?.['ok']).toBe(false);
    await sql`INSERT INTO integration_oauth_attempts(user_id,company_id,provider,nonce_hash,expires_at) VALUES(${owner},${company},'whatsapp','expired',now()-interval '1 second')`;
    expect((await sql`SELECT integration_consume_attempt(${owner},${company},'whatsapp','expired') ok`)[0]?.['ok']).toBe(false);
  });
});