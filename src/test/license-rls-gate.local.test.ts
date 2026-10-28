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
  const directRead = async (table = "profiles") =>
    sql.unsafe(`SET ROLE authenticated; SELECT count(*) AS c FROM public.${table}; RESET ROLE;`);
  const count = (rows: unknown) => {
    const results = rows as { c: string }[][];
    const select = results.find((r) => Array.isArray(r) && r[0] && "c" in r[0]);
    return Number(select?.[0]?.["c"] ?? 0);
  };

  // Tables gated by 0096 (every remaining customer-data table with an authenticated/anon access path).
  const gated0096 = [
    "ad_routing_audit", "ad_routing_rules", "ad_routing_steps", "attendance_roster_exclusions",
    "automation_executions", "automation_workflows",
    "chat_attachments", "chat_group_members", "chat_groups", "chat_messages", "chat_stars",
    "company_lead_status", "company_members", "contacts", "credit_notes",
    "crm_list_views", "crm_options", "crm_work_history", "crm_work_items", "custom_forms",
    "deal_activity_history", "deals", "financial_audit_logs",
    "hr_access_audit", "hr_announcement_attachments", "hr_announcement_reads", "hr_announcements",
    "hr_attendance", "hr_attendance_events", "hr_audit_logs", "hr_branches", "hr_departments",
    "hr_designations", "hr_document_versions", "hr_documents", "hr_employees", "hr_holidays",
    "hr_leave_balances", "hr_leave_requests", "hr_meetings", "hr_payroll", "hr_schedules",
    "integration_settings", "invoices",
    "lead_activities", "lead_assignment_events", "lead_routing_queue", "leads",
    "mail_messages", "mailbox_settings", "make_lead_sources",
    "payments", "personal_attendance", "personal_crm_tasks", "personal_lead_status", "personal_task_history",
    "proposal_events", "revenue_entries", "sales_proposals", "sales_settings",
    "support_attachments", "support_messages", "support_ticket_events", "support_tickets",
    "user_work_grid_settings", "user_work_rows", "user_work_tables",
    "wa_broadcast_recipients", "wa_broadcasts", "wa_suppression", "wa_workflows",
    "whatsapp_conversations", "whatsapp_messages", "whatsapp_templates",
  ];
  const gated0095 = ["companies", "contact_submissions", "crm_pipelines", "crm_stages", "products_services", "profiles", "sales_customers"];
  // Representative customer-data tables exercised for real read behavior.
  const probed = ["leads", "deals", "invoices", "hr_payroll", "chat_messages"];

  beforeAll(async () => {
    await sql.unsafe(
      `DROP TABLE IF EXISTS public.license_state CASCADE;
       DROP FUNCTION IF EXISTS public.license_active() CASCADE;
       DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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
    // Stub every 0096-gated table; the probed ones get RLS + a permissive policy + a row + grant.
    for (const t of gated0096) {
      await sql.unsafe(`DROP TABLE IF EXISTS public.${t} CASCADE; CREATE TABLE public.${t}(id uuid);`);
      if (probed.includes(t)) {
        await sql.unsafe(
          `INSERT INTO public.${t} VALUES('${user}');
           ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;
           CREATE POLICY allow_all ON public.${t} FOR SELECT TO authenticated USING (true);
           GRANT SELECT ON public.${t} TO authenticated;`,
        );
      }
    }
    await sql.unsafe(readFileSync("drizzle/migrations/0095_license_rls_gate.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0096_license_rls_gate_all_crm_tables.sql", "utf8"));
    await sql`SELECT set_config('qa.uid', ${user}, false)`;
  });
  afterAll(async () => {
    await sql.end();
  });

  it("fails closed before any server verification", async () => {
    expect(await active()).toBe(false);
    expect(count(await directRead())).toBe(0);
  });

  it("master mode row allows direct access", async () => {
    await sql`UPDATE public.license_state SET mode = 'master', verified_until = NULL`;
    expect(await active()).toBe(true);
    expect(count(await directRead())).toBe(1);
  });

  it("freshly verified customer license allows direct access", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = now() + interval '60 seconds'`;
    expect(await active()).toBe(true);
    expect(count(await directRead())).toBe(1);
  });

  it("stale or suspended customer license blocks direct access again", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = '1970-01-01T00:00:00Z'`;
    expect(await active()).toBe(false);
    expect(count(await directRead())).toBe(0);
  });

  it("blocks direct reads of leads, deals, invoices, payroll and chat when the license is stale", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = '1970-01-01T00:00:00Z'`;
    for (const t of probed) expect(count(await directRead(t)), t).toBe(0);
  });

  it("allows those reads again only after a fresh server verification", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = now() + interval '60 seconds'`;
    for (const t of probed) expect(count(await directRead(t)), t).toBe(1);
  });

  it("blocks direct writes when the license is stale", async () => {
    await sql`UPDATE public.license_state SET mode = 'customer', verified_until = '1970-01-01T00:00:00Z'`;
    await sql.unsafe(`GRANT INSERT ON public.leads TO authenticated; CREATE POLICY allow_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (true);`);
    await expect(
      sql.unsafe(`SET ROLE authenticated; INSERT INTO public.leads VALUES('${user}') RETURNING id; RESET ROLE;`),
    ).rejects.toThrow(/license_gate/);
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

  it("license gate policies exist on every browser-accessible customer-data table", async () => {
    const rows = await sql`
      SELECT c.relname AS tablename FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND p.polname = 'license_gate' AND p.polpermissive = false
    `;
    const tables = rows.map((r) => r["tablename"]).sort();
    expect(tables).toEqual([...gated0095, ...gated0096].sort());
  });
});
