import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable local PostgreSQL only (CRM_LICENSE_LOCAL_QA=1, 127.0.0.1:55441, user qa). Never the Cloud DB.
describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("License RLS gate (direct browser access)", () => {
  const sql = postgres({ host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false, max: 1 });
  const user = "22222222-2222-4222-8222-222222222222";
  const active = async () =>
    (await sql`SELECT public.license_active() AS a`)[0]?.["a"] as boolean;
  // Direct Data API read as the authenticated role, like supabase-js from the browser.
  const directRead = async () =>
    sql.unsafe(
      `SET ROLE authenticated; SELECT count(*) AS c FROM public.profiles; RESET ROLE;`,
    );

  beforeAll(async () => {
    await sql.unsafe(
      `DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
       DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
       DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
       CREATE SCHEMA IF NOT EXISTS auth;
       CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
       DROP TABLE IF EXISTS public.profiles, public.companies, public.crm_stages, public.crm_pipelines, public.products_services, public.sales_customers, public.contact_submissions CASCADE;
       CREATE TABLE public.profiles(id uuid, account_status text);
       CREATE TABLE public.companies(id uuid);
       CREATE TABLE public.crm_stages(id uuid);
       CREATE TABLE public.crm_pipelines(id uuid);
       CREATE TABLE public.products_services(id uuid);
       CREATE TABLE public.sales_customers(id uuid);
       CREATE TABLE public.contact_submissions(id uuid);
       INSERT INTO public.profiles VALUES('${user}','active');
       ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
       CREATE POLICY own_profile ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
       GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
       GRANT SELECT ON public.profiles TO authenticated;`,
    );
    await sql.unsafe(readFileSync("drizzle/migrations/0095_license_rls_gate.sql", "utf8"));
    await sql`SELECT set_config('qa.uid', ${user}, false)`;
  });
  afterAll(async () => {
    await sql.end();
  });

  it("fails closed before any server verification", async () => {
    expect(await active()).toBe(false);
    const rows = await directRead();
    expect(Number((rows[1] as never as { c: string }[])[0]?.["c"])).toBe(0);
  });

  it("master mode row allows direct access", async () => {
    await sql`UPDATE public.license_state SET mode = 'master', verified_until = NULL`;
    expect(await active()).toBe(true);
    const rows = await directRead();
    expect(Number((rows[1] as never as { c: string }[])[0]?.["c"])).toBe(1);
  });

  it("freshly verified customer license allows direct access", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = now() + interval '60 seconds'`;
    expect(await active()).toBe(true);
    const rows = await directRead();
    expect(Number((rows[1] as never as { c: string }[])[0]?.["c"])).toBe(1);
  });

  it("stale or suspended customer license blocks direct access again", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = '1970-01-01T00:00:00Z'`;
    expect(await active()).toBe(false);
    const rows = await directRead();
    expect(Number((rows[1] as never as { c: string }[])[0]?.["c"])).toBe(0);
  });

  it("authenticated and anon roles cannot read or write the license state", async () => {
    await expect(
      sql.unsafe(`SET ROLE authenticated; SELECT * FROM public.license_state; RESET ROLE;`),
    ).rejects.toThrow();
    await expect(
      sql.unsafe(`SET ROLE authenticated; UPDATE public.license_state SET mode = 'master'; RESET ROLE;`),
    ).rejects.toThrow();
    expect((await sql`SELECT mode FROM public.license_state`)[0]?.["mode"]).toBe("customer");
  });

  it("license gate policies exist on every browser-accessed table", async () => {
    const rows = await sql`
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public' AND policyname = 'license_gate' AND polpermissive = false
    `;
    const tables = rows.map((r) => r["tablename"]).sort();
    expect(tables).toEqual(
      ["companies", "contact_submissions", "crm_pipelines", "crm_stages", "products_services", "profiles", "sales_customers"].sort(),
    );
  });
});
