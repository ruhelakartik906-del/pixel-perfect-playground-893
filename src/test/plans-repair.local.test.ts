import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Plan repair persistence and isolation", () => {
  const sql = postgres({ host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false, max: 1 });
  const actor = "11111111-1111-4111-8111-111111111111";
  const company = "22222222-2222-4222-8222-222222222222";
  let plan = "";
  beforeAll(async () => {
    await sql.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS auth; CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
      CREATE TABLE profiles(id uuid primary key,account_status text,full_name text,email text,phone text,company_name text,updated_at timestamptz);
      CREATE TABLE user_roles(user_id uuid,role text,unique(user_id,role));
      CREATE TABLE companies(id uuid primary key default gen_random_uuid(),name text,email text,phone text,contact_person text,is_active boolean default true);
      CREATE TABLE company_members(id uuid default gen_random_uuid(),company_id uuid,user_id uuid,created_at timestamptz default now());
      CREATE TABLE leads(id uuid default gen_random_uuid(),company_id uuid);
      CREATE FUNCTION routing_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid()='${actor}'::uuid $$;
      CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${actor}'::uuid $$;
      CREATE FUNCTION is_company_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE FUNCTION license_active() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      INSERT INTO profiles(id,account_status) VALUES('${actor}','active'); INSERT INTO companies(id,name) VALUES('${company}','Isolated test');
      SELECT set_config('qa.uid','${actor}',false);`);
    for (const name of ["0097_multi_tenant_core", "0098_master_save_plan_text_id", "0103_plan_limits_overrides_and_canonical_save"])
      await sql.unsafe(readFileSync(`drizzle/migrations/${name}.sql`, "utf8"));
  });
  afterAll(async () => { await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"); await sql.end(); });
  it("leaves one unambiguous plan signature", async () => {
    expect(await sql`SELECT oid FROM pg_proc WHERE proname='master_save_plan'`).toHaveLength(1);
  });
  it("creates and edits a plan with zero and unlimited", async () => {
    const rows = await sql`SELECT master_save_plan(${actor},'', 'Plan A','',${sql.json({ max_employees: 0, max_leads: null })},${sql.json({ leads: true })}) id`;
    plan = String(rows[0]?.["id"]);
    await sql`SELECT master_save_plan(${actor},${plan},'Plan edited','',${sql.json({ max_employees: 2, max_leads: null })},${sql.json({ leads: true })})`;
    expect((await sql`SELECT name,limits FROM plans WHERE id=${plan}`)[0]).toMatchObject({ name: "Plan edited", limits: { max_employees: 2, max_leads: null } });
  });
  it("assignment retains overrides and subscription dates", async () => {
    await sql`SELECT master_save_customer_limits(${actor},${company},${sql.json({ max_employees: 0 })})`;
    await sql`INSERT INTO org_subscriptions(company_id,starts_at,expires_at) VALUES(${company},'2026-01-01','2027-01-01')`;
    await sql`SELECT master_assign_plan(${actor},${company},${plan})`;
    expect((await sql`SELECT max_employees,max_leads FROM org_usage_limits WHERE company_id=${company}`)[0]).toMatchObject({ max_employees: 0, max_leads: null });
    expect((await sql`SELECT starts_at::text,expires_at::text FROM org_subscriptions WHERE company_id=${company}`)[0]?.["expires_at"]).toContain("2027-01-01");
    await expect(sql`INSERT INTO company_members(company_id,user_id) VALUES(${company},${actor})`).rejects.toThrow("Employee limit reached");
  });
  it("resetting overrides uses plan defaults", async () => {
    await sql`SELECT master_save_customer_limits(${actor},${company},${sql.json({})})`;
    expect((await sql`SELECT max_employees FROM org_usage_limits WHERE company_id=${company}`)[0]?.["max_employees"]).toBe(2);
  });
  it("lead zero blocks every insert and null permits inserts", async () => {
    await sql`SELECT master_save_customer_limits(${actor},${company},${sql.json({ max_leads: 0 })})`;
    await expect(sql`INSERT INTO leads(company_id) VALUES(${company})`).rejects.toThrow("Lead limit reached");
    await sql`SELECT master_save_customer_limits(${actor},${company},${sql.json({ max_leads: null })})`;
    await sql`INSERT INTO leads(company_id) VALUES(${company})`;
    expect(await sql`SELECT id FROM leads WHERE company_id=${company}`).toHaveLength(1);
  });
  it("rejects negative limits and forged actor", async () => {
    await expect(sql`SELECT master_save_customer_limits(${actor},${company},${sql.json({ max_leads: -1 })})`).rejects.toThrow("non-negative");
    await sql`SELECT set_config('qa.uid','33333333-3333-4333-8333-333333333333',false)`;
    await expect(sql`SELECT master_assign_plan(${actor},${company},${plan})`).rejects.toThrow("Invalid actor");
    await sql`SELECT set_config('qa.uid',${actor},false)`;
  });
  it("assigned plans cannot be deleted and retirement preserves assignments", async () => {
    await expect(sql`DELETE FROM plans WHERE id=${plan}`).rejects.toThrow("retired");
    await sql`SELECT master_retire_plan(${plan})`;
    expect((await sql`SELECT is_active FROM plans WHERE id=${plan}`)[0]?.["is_active"]).toBe(false);
    expect((await sql`SELECT plan_id::text FROM org_subscriptions WHERE company_id=${company}`)[0]?.["plan_id"]).toBe(plan);
  });
});