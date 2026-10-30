import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable local PostgreSQL only (CRM_LICENSE_LOCAL_QA=1, 127.0.0.1:55441, user qa). Never the Cloud DB.
describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Multi-tenant core", () => {
  const sql = postgres({ host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false, max: 1 });
  const admin = "11111111-1111-4111-8111-111111111111";
  const outsider = "33333333-3333-4333-8333-333333333333";
  const newCustomer = "44444444-4444-4444-8444-444444444444";
  let companyId = "";

  beforeAll(async () => {
    await sql.unsafe(
      `DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
       CREATE SCHEMA IF NOT EXISTS auth;
       CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
       DROP TABLE IF EXISTS public.profiles, public.user_roles, public.companies, public.company_members, public.leads CASCADE;
       CREATE TABLE public.profiles(id uuid primary key, account_status text not null default 'pending', full_name text not null default '', email text not null default '', phone text not null default '', company_name text not null default '', updated_at timestamptz not null default now());
       CREATE TABLE public.user_roles(user_id uuid not null, role text not null, unique(user_id, role));
       CREATE TABLE public.companies(id uuid primary key default gen_random_uuid(), name text not null, email text not null default '', phone text not null default '', contact_person text not null default '', is_active boolean not null default true, created_at timestamptz not null default now());
       CREATE TABLE public.company_members(id uuid primary key default gen_random_uuid(), company_id uuid not null, user_id uuid not null, created_at timestamptz not null default now());
       CREATE TABLE public.leads(id uuid primary key default gen_random_uuid(), company_id uuid);
       CREATE OR REPLACE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles p JOIN user_roles r ON r.user_id=p.id WHERE p.id=auth.uid() AND p.account_status='active' AND r.role='super_admin') $$;
       CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role=_role) $$;
       CREATE OR REPLACE FUNCTION public.is_company_member(_user uuid, _company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM company_members WHERE user_id=_user AND company_id=_company) $$;
       INSERT INTO profiles(id, account_status) VALUES ('${admin}','active'),('${outsider}','active'),('${newCustomer}','pending');
       INSERT INTO user_roles VALUES ('${admin}','super_admin'),('${outsider}','client');
       GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;`,
    );
    for (const f of ["0097_multi_tenant_core", "0098_master_save_plan_text_id"])
      await sql.unsafe(readFileSync(`drizzle/migrations/${f}.sql`, "utf8"));
  });
  afterAll(async () => { await sql.end(); });

  it("rejects customer creation by a non-admin", async () => {
    await expect(
      sql`SELECT master_create_customer(${outsider}, ${newCustomer}, 'c@test.dev', 'Cust', '', 'Co')`,
    ).rejects.toThrow("Super Admin");
  });

  it("creates company, membership, client role and active 1-year subscription atomically", async () => {
    const rows = await sql`SELECT master_create_customer(${admin}, ${newCustomer}, 'c@test.dev', 'Cust Name', '123', 'Acme Co') AS id`;
    companyId = rows[0]!["id"] as string;
    const company = await sql`SELECT * FROM companies WHERE id=${companyId}`;
    expect(company[0]).toMatchObject({ name: "Acme Co", email: "c@test.dev", contact_person: "Cust Name", is_active: true });
    expect(await sql`SELECT 1 FROM company_members WHERE company_id=${companyId} AND user_id=${newCustomer}`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM user_roles WHERE user_id=${newCustomer} AND role='client'`).toHaveLength(1);
    const profile = await sql`SELECT account_status, company_name FROM profiles WHERE id=${newCustomer}`;
    expect(profile[0]).toMatchObject({ account_status: "active", company_name: "Acme Co" });
    const sub = await sql`SELECT status, term_months, expires_at FROM org_subscriptions WHERE company_id=${companyId}`;
    expect(sub[0]).toMatchObject({ status: "active", term_months: 12 });
    expect(new Date(sub[0]!["expires_at"] as string).getUTCFullYear()).toBe(new Date().getUTCFullYear() + 1);
  });

  it("allows all features by default and blocks every feature when suspended", async () => {
    expect((await sql`SELECT org_feature_allowed(${companyId}, 'leads') AS v`)[0]!["v"]).toBe(true);
    await sql`SELECT master_set_customer_status(${admin}, ${companyId}, 'suspended')`;
    expect((await sql`SELECT org_feature_allowed(${companyId}, 'leads') AS v`)[0]!["v"]).toBe(false);
    const profile = await sql`SELECT account_status FROM profiles WHERE id=${newCustomer}`;
    expect(profile[0]!["account_status"]).toBe("blocked");
    await sql`SELECT master_set_customer_status(${admin}, ${companyId}, 'active')`;
    expect((await sql`SELECT account_status FROM profiles WHERE id=${newCustomer}`)[0]!["account_status"]).toBe("active");
    expect((await sql`SELECT org_feature_allowed(${companyId}, 'leads') AS v`)[0]!["v"]).toBe(true);
  });

  it("honours a per-customer feature override", async () => {
    await sql`SELECT master_save_customer_features(${admin}, ${companyId}, ${sql.json({ chatbots: false } as never)})`;
    expect((await sql`SELECT org_feature_allowed(${companyId}, 'chatbots') AS v`)[0]!["v"]).toBe(false);
    expect((await sql`SELECT org_feature_allowed(${companyId}, 'leads') AS v`)[0]!["v"]).toBe(true);
  });

  it("enforces the employee limit on membership inserts", async () => {
    await sql`SELECT master_save_customer_limits(${admin}, ${companyId}, ${sql.json({ max_employees: 2 } as never)})`;
    expect((await sql`SELECT org_limit_available(${companyId}, 'employees') AS v`)[0]!["v"]).toBe(true);
    await sql`INSERT INTO company_members (company_id, user_id) VALUES (${companyId}, ${outsider})`;
    expect((await sql`SELECT org_limit_available(${companyId}, 'employees') AS v`)[0]!["v"]).toBe(false);
    await expect(
      sql`INSERT INTO company_members (company_id, user_id) VALUES (${companyId}, ${admin})`,
    ).rejects.toThrow("Employee limit reached");
  });

  it("applies a plan's features and limits to a customer", async () => {
    const plan = await sql`SELECT master_save_plan(${admin}, '', 'Starter', 'Test plan', ${sql.json({ max_employees: 5 } as never)}, ${sql.json({ leads: true, chatbots: false } as never)}) AS id`;
    await sql`SELECT master_assign_plan(${admin}, ${companyId}, ${plan[0]!["id"]})`;
    expect((await sql`SELECT org_feature_allowed(${companyId}, 'chatbots') AS v`)[0]!["v"]).toBe(false);
    const limits = await sql`SELECT max_employees FROM org_usage_limits WHERE company_id=${companyId}`;
    expect(limits[0]!["max_employees"]).toBe(5);
    const sub = await sql`SELECT plan_id FROM org_subscriptions WHERE company_id=${companyId}`;
    expect(sub[0]!["plan_id"]).toBe(plan[0]!["id"]);
  });

  it("archives a customer by deactivating the company and suspending access", async () => {
    await sql`SELECT master_archive_customer(${admin}, ${companyId})`;
    expect((await sql`SELECT is_active FROM companies WHERE id=${companyId}`)[0]!["is_active"]).toBe(false);
    expect((await sql`SELECT status FROM org_subscriptions WHERE company_id=${companyId}`)[0]!["status"]).toBe("suspended");
  });
});
