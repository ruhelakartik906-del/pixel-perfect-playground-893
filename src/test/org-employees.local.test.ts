import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable local PostgreSQL only (CRM_LICENSE_LOCAL_QA=1, 127.0.0.1:55441, user qa). Never the Cloud DB.
describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Org employee management", () => {
  const sql = postgres({ host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false, max: 1 });
  const admin = "11111111-1111-4111-8111-111111111111";
  const employee = "22222222-2222-4222-8222-222222222222";
  const outsider = "33333333-3333-4333-8333-333333333333";
  const company = "55555555-5555-4555-8555-555555555555";
  const otherCompany = "66666666-6666-4666-8666-666666666666";
  const accessRole = "77777777-7777-4777-8777-777777777777";
  const as = (uid: string) => sql`SELECT set_config('qa.uid', ${uid}, false)`;
  const act = async (action: string, payload: object) =>
    (await sql`SELECT org_employee_action(${action}, ${sql.json(payload as never)}) AS r`)[0]?.["r"] as string;

  beforeAll(async () => {
    await sql.unsafe(
      `DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
       CREATE SCHEMA IF NOT EXISTS auth;
       CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
       DROP TABLE IF EXISTS public.profiles, public.user_roles, public.companies, public.company_members, public.leads, public.access_roles, public.user_access_roles CASCADE;
       DROP TYPE IF EXISTS public.account_status CASCADE;
       CREATE TYPE public.account_status AS ENUM ('pending','active','blocked');
       CREATE TABLE public.profiles(id uuid primary key, account_status public.account_status not null default 'pending', full_name text not null default '', email text not null default '', phone text not null default '', company_name text not null default '', updated_at timestamptz not null default now());
       CREATE TABLE public.user_roles(user_id uuid not null, role text not null, unique(user_id, role));
       CREATE TABLE public.companies(id uuid primary key default gen_random_uuid(), name text not null, email text not null default '', phone text not null default '', contact_person text not null default '', is_active boolean not null default true, created_at timestamptz not null default now());
       CREATE TABLE public.company_members(id uuid primary key default gen_random_uuid(), company_id uuid not null, user_id uuid not null, created_at timestamptz not null default now());
       CREATE TABLE public.leads(id uuid primary key default gen_random_uuid(), company_id uuid);
       CREATE TABLE public.access_roles(id uuid primary key default gen_random_uuid(), name text not null, description text not null default '', permissions text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
       CREATE TABLE public.user_access_roles(user_id uuid not null, role_id uuid not null, created_at timestamptz not null default now());
       CREATE OR REPLACE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles p JOIN user_roles r ON r.user_id=p.id WHERE p.id=auth.uid() AND p.account_status='active' AND r.role='super_admin') $$;
       CREATE OR REPLACE FUNCTION public.is_company_member(_user uuid, _company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM company_members WHERE user_id=_user AND company_id=_company) $$;
       INSERT INTO companies(id, name) VALUES ('${company}','QA Org'),('${otherCompany}','Other Org');
       INSERT INTO profiles(id, account_status, full_name, email) VALUES ('${admin}','active','Admin','admin@qa.test'),('${employee}','pending','Emp','emp@qa.test'),('${outsider}','active','Out','out@qa.test');
       INSERT INTO user_roles VALUES ('${admin}','client'),('${outsider}','client');
       INSERT INTO company_members(company_id, user_id) VALUES ('${company}','${admin}'),('${otherCompany}','${outsider}');
       INSERT INTO access_roles(id, name) VALUES ('${accessRole}','Sales Executive');
       GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;`,
    );
    for (const f of ["0097_multi_tenant_core", "0098_master_save_plan_text_id", "0099_org_employee_management"])
      await sql.unsafe(readFileSync(`drizzle/migrations/${f}.sql`, "utf8"));
    await as(admin);
  });
  afterAll(async () => { await sql.end(); });

  it("rejects employee actions from a non-member", async () => {
    await as(outsider);
    await expect(act("attach", { company_id: company, user_id: employee })).rejects.toThrow("Customer Admin authorization required");
    await as(admin);
  });

  it("attaches an employee with the employee role and audits it", async () => {
    const id = await act("attach", { company_id: company, user_id: employee });
    expect(id).toBe(employee);
    const members = await sql`SELECT 1 FROM company_members WHERE company_id=${company} AND user_id=${employee}`;
    expect(members.length).toBe(1);
    const roles = await sql`SELECT role FROM user_roles WHERE user_id=${employee}`;
    expect(roles.map((r) => r["role"])).toContain("employee");
    const audit = await sql`SELECT action FROM org_employee_audit WHERE company_id=${company} AND employee_id=${employee}`;
    expect(audit.map((a) => a["action"])).toContain("attach");
  });

  it("updates employee details inside the organization only", async () => {
    await act("update", { company_id: company, user_id: employee, full_name: "Updated Name", phone: "999" });
    const p = await sql`SELECT full_name, phone FROM profiles WHERE id=${employee}`;
    expect(p[0]).toMatchObject({ full_name: "Updated Name", phone: "999" });
    await expect(act("update", { company_id: otherCompany, user_id: employee, full_name: "X" })).rejects.toThrow("Customer Admin authorization required");
  });

  it("assigns and replaces the permission role", async () => {
    await act("assign_role", { company_id: company, user_id: employee, access_role: accessRole });
    let rows = await sql`SELECT role_id FROM user_access_roles WHERE user_id=${employee}`;
    expect(rows[0]?.["role_id"]).toBe(accessRole);
    await act("assign_role", { company_id: company, user_id: employee, access_role: null });
    rows = await sql`SELECT role_id FROM user_access_roles WHERE user_id=${employee}`;
    expect(rows.length).toBe(0);
  });

  it("blocks and reactivates an employee, but never the admin themself", async () => {
    await act("set_status", { company_id: company, user_id: employee, status: "blocked" });
    let p = await sql`SELECT account_status FROM profiles WHERE id=${employee}`;
    expect(p[0]?.["account_status"]).toBe("blocked");
    await act("set_status", { company_id: company, user_id: employee, status: "active" });
    p = await sql`SELECT account_status FROM profiles WHERE id=${employee}`;
    expect(p[0]?.["account_status"]).toBe("active");
    await expect(act("set_status", { company_id: company, user_id: admin, status: "blocked" })).rejects.toThrow("own account status");
  });

  it("enforces the employee limit at the database level", async () => {
    await sql`INSERT INTO org_usage_limits(company_id, max_employees) VALUES (${company}, 2)`;
    const extra = "88888888-8888-4888-8888-888888888888";
    await sql`INSERT INTO profiles(id, account_status) VALUES (${extra},'pending')`;
    await expect(act("attach", { company_id: company, user_id: extra })).rejects.toThrow("Employee limit reached");
    await sql`DELETE FROM org_usage_limits WHERE company_id=${company}`;
  });

  it("removes an employee with membership, role and access role cleanup", async () => {
    await act("assign_role", { company_id: company, user_id: employee, access_role: accessRole });
    await act("remove", { company_id: company, user_id: employee });
    const members = await sql`SELECT 1 FROM company_members WHERE company_id=${company} AND user_id=${employee}`;
    const roles = await sql`SELECT 1 FROM user_roles WHERE user_id=${employee} AND role='employee'`;
    const access = await sql`SELECT 1 FROM user_access_roles WHERE user_id=${employee}`;
    expect(members.length + roles.length + access.length).toBe(0);
    await expect(act("remove", { company_id: company, user_id: admin })).rejects.toThrow("own account");
  });
});
