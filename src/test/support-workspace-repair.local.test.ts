import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Support workspace write boundary", () => {
  const db = { host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false as const, max: 1, onnotice: () => {} };
  const sql = postgres(db);
  const master = "00000000-0000-4000-8000-000000000001", customer = "00000000-0000-4000-8000-000000000002";
  const company = "00000000-0000-4000-8000-000000000010", other = "00000000-0000-4000-8000-000000000011";
  const lead = "00000000-0000-4000-8000-000000000030", foreignLead = "00000000-0000-4000-8000-000000000031";
  let session = "";
  beforeAll(async () => {
    await sql.unsafe(readFileSync("src/test/fixtures/security-live-rls.sql", "utf8"));
    await sql.unsafe(`ALTER TABLE companies ADD PRIMARY KEY(id);
      CREATE TABLE org_support_sessions(id uuid primary key default gen_random_uuid(),company_id uuid references companies(id),master_user_id uuid,mode text,started_at timestamptz default now(),ended_at timestamptz,revoked boolean default false);
      GRANT ALL ON org_support_sessions TO authenticated; ALTER TABLE org_support_sessions ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION org_feature_allowed(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`);
    await sql.unsafe(`CREATE TABLE deals(id uuid,title text,status text,created_at timestamptz,company_id uuid,assigned_to uuid,deleted_at timestamptz);
      CREATE TABLE crm_stages(id uuid,kind text,company_id uuid,owner_id uuid,position int);
      CREATE TABLE crm_options(id uuid,name text,is_active boolean,category text);
      CREATE TABLE lead_activities(id uuid,lead_id uuid,created_at timestamptz);
      CREATE TABLE org_feature_permissions(company_id uuid,feature_key text,enabled boolean);`);
    await sql.unsafe(readFileSync("drizzle/migrations/0101_support_workspace_access.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0104_support_workspace_crm_adapter.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0107_support_crm_projection_resolution.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0105_support_mutation_boundary.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0108_support_existing_action_compatibility.sql", "utf8"));
    await sql.unsafe(`INSERT INTO license_state(id,mode) VALUES(true,'master');
      INSERT INTO companies(id,name,is_active) VALUES('${company}','Isolated X',true),('${other}','Isolated Y',true);
      INSERT INTO profiles(id,account_status,full_name) VALUES('${master}','active','Master'),('${customer}','active','Customer');
      INSERT INTO user_roles(id,user_id,role) VALUES(gen_random_uuid(),'${master}','super_admin'),(gen_random_uuid(),'${customer}','client');
      INSERT INTO company_members(id,company_id,user_id,created_at) VALUES(gen_random_uuid(),'${company}','${customer}',now());
      INSERT INTO leads(id,company_id,assigned_to,customer_name,updated_at) VALUES('${lead}','${company}','${customer}','Original',now()),('${foreignLead}','${other}',null,'Foreign',now());
      SELECT set_config('request.jwt.claim.sub','${master}',false);`);
  });
  afterAll(async () => { await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"); await sql.end(); });
  async function start(mode: string) {
    const r = await sql`SELECT support_session_start(${company},${mode},'Isolated verification',15) id`;
    session = String(r[0]?.["id"]);
  }
  it("View Only blocks direct writes on every guarded application table", async () => {
    await start("view");
    await expect(sql`UPDATE leads SET customer_name='Blocked' WHERE id=${lead}`).rejects.toThrow("View Only");
    await expect(sql`UPDATE profiles SET full_name='Blocked' WHERE id=${customer}`).rejects.toThrow("View Only");
    await expect(sql`DELETE FROM leads WHERE id=${lead}`).rejects.toThrow("View Only");
    const r = await sql`SELECT support_workspace_lead_action(${session},${lead},(SELECT updated_at FROM leads WHERE id=${lead}),${sql.json({ customer_name: "Blocked" })}) r`;
    expect((r[0]?.["r"] as { error: string }).error).toContain("View Only");
    expect((await sql`SELECT customer_name FROM leads WHERE id=${lead}`)[0]?.["customer_name"]).toBe("Original");
  });
  it("Full Support permits validated details and denies direct mutation bypass", async () => {
    await start("support");
    const r = await sql`SELECT support_workspace_lead_action(${session},${lead},(SELECT updated_at FROM leads WHERE id=${lead}),${sql.json({ customer_name: "Updated" })}) r`;
    expect(r[0]?.["r"]).toEqual({ ok: true });
    await expect(sql`UPDATE leads SET customer_name='Bypass' WHERE id=${lead}`).rejects.toThrow("authorized session");
    expect((await sql`SELECT customer_name FROM leads WHERE id=${lead}`)[0]?.["customer_name"]).toBe("Updated");
    expect(await sql`SELECT id FROM org_support_audit WHERE session_id=${session} AND action='lead.details'`).toHaveLength(1);
  });
  it("CRM adapter returns canonical customer identity and only their organization", async () => {
    const rows = await sql`SELECT support_workspace_crm(${session}) r`;
    const out = rows[0]?.["r"] as { data: { userId: string; leads: { id: string }[]; companies: { id: string }[] } };
    expect(out.data.userId).toBe(customer);
    expect(out.data.leads.map(l => l.id)).toEqual([lead]);
    expect(out.data.companies.map(c => c.id)).toEqual([company]);
  });
  it("Full Support rejects another organization and ownership edits", async () => {
    await expect(sql`SELECT support_workspace_lead_action(${session},${foreignLead},now(),${sql.json({ customer_name: "Wrong" })})`).rejects.toThrow("not available");
    await expect(sql`SELECT support_workspace_lead_action(${session},${lead},(SELECT updated_at FROM leads WHERE id=${lead}),${sql.json({ assigned_to: master })})`).rejects.toThrow("Invalid lead details");
  });
  it("revocation denies the very next support request", async () => {
    await sql`SELECT support_session_end(${session},'Complete')`;
    await expect(sql`SELECT support_workspace_lead_action(${session},${lead},now(),${sql.json({ customer_name: "No" })})`).rejects.toThrow("ended");
  });
  it("expiry stops the next action and records expiry", async () => {
    await start("support");
    await sql`SELECT set_config('request.jwt.claim.sub','',false)`;
    await sql`UPDATE org_support_sessions SET expires_at=now()-interval '1 second' WHERE id=${session}`;
    await sql`SELECT set_config('request.jwt.claim.sub',${master},false)`;
    const r = await sql`SELECT support_workspace_lead_action(${session},${lead},now(),${sql.json({ customer_name: "No" })}) r`;
    expect((r[0]?.["r"] as { error: string }).error).toContain("expired");
    expect(await sql`SELECT id FROM org_support_audit WHERE session_id=${session} AND action='session.expired'`).toHaveLength(1);
  });
});