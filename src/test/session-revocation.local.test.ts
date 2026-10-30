import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable local PostgreSQL only (CRM_LICENSE_LOCAL_QA=1, 127.0.0.1:55441, user qa). Never the Cloud DB.
// Loads a schema-only snapshot of the LIVE RLS policies/functions, then revokes access mid-session.
describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Mid-session revocation (live RLS snapshot)", () => {
  const db = { host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false as const, max: 1 };
  const admin = postgres(db);
  const sessions: postgres.Sql[] = [];
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const [SA, SA2, CA, EMP, OTHER, CO_X, CO_Y] = [1, 2, 3, 4, 5, 10, 11].map(id);

  // An "active session": one long-lived connection holding the user's JWT subject, like a cached browser session.
  async function session(uid: string) {
    const s = postgres(db);
    sessions.push(s);
    await s.unsafe(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false)`);
    return s;
  }
  const count = async (s: postgres.Sql, table: string) => Number((await s.unsafe(`SELECT count(*) c FROM public.${table}`))[0]!["c"]);
  const fails = async (p: Promise<unknown>) => { try { await p; return false; } catch { return true; } };
  const insertTemplate = (s: postgres.Sql, uid: string, company: string | null) =>
    s`INSERT INTO public.whatsapp_templates(id,name,status,sync_status,company_id,created_by) VALUES (gen_random_uuid(),'qa','draft','not_synced',${company},${uid})`;

  beforeAll(async () => {
    await admin.unsafe(readFileSync("src/test/fixtures/security-live-rls.sql", "utf8"));
    await admin.unsafe(`
      INSERT INTO license_state(id,mode) VALUES (true,'master');
      INSERT INTO companies(id,name,is_active) VALUES ('${CO_X}','QA X',true),('${CO_Y}','QA Y',true);
      INSERT INTO profiles(id,account_status) VALUES ('${SA}','active'),('${SA2}','active'),('${CA}','active'),('${EMP}','active'),('${OTHER}','active');
      INSERT INTO user_roles(id,user_id,role) VALUES (gen_random_uuid(),'${SA}','super_admin'),(gen_random_uuid(),'${SA2}','super_admin'),(gen_random_uuid(),'${CA}','client'),(gen_random_uuid(),'${EMP}','employee'),(gen_random_uuid(),'${OTHER}','client');
      INSERT INTO company_members(id,company_id,user_id) VALUES (gen_random_uuid(),'${CO_X}','${CA}'),(gen_random_uuid(),'${CO_X}','${EMP}'),(gen_random_uuid(),'${CO_Y}','${OTHER}');
      INSERT INTO access_roles(id,name,permissions) VALUES ('${id(20)}','Templates','{template.view,template.create}');
      INSERT INTO user_access_roles(user_id,role_id) VALUES ('${EMP}','${id(20)}');
      INSERT INTO leads(id,company_id,assigned_to,created_by,customer_name) VALUES
        ('${id(30)}','${CO_X}','${CA}','${SA}','QA lead CA'),('${id(31)}','${CO_X}','${EMP}','${SA}','QA lead EMP'),('${id(32)}','${CO_Y}','${OTHER}','${SA}','QA lead OTHER');
      INSERT INTO whatsapp_templates(id,name,status,sync_status,company_id,created_by) VALUES ('${id(40)}','QA tpl','approved','synced','${CO_X}','${SA}');`);
  });

  afterAll(async () => {
    await Promise.all(sessions.map((s) => s.end()));
    await admin.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.end();
  });

  it("Super Admin suspended mid-session loses leads, WhatsApp admin data and writes immediately", async () => {
    const s = await session(SA);
    expect(await count(s, "leads")).toBe(3);
    expect(await count(s, "whatsapp_templates")).toBe(1);
    await admin`UPDATE profiles SET account_status='blocked' WHERE id=${SA}`;
    expect(await count(s, "leads")).toBe(0);
    expect(await count(s, "whatsapp_templates")).toBe(0);
    expect(await count(s, "company_members")).toBe(0);
    expect(await fails(insertTemplate(s, SA, CO_X))).toBe(true);
    expect(await fails(s`INSERT INTO leads(id,company_id,created_by) VALUES (gen_random_uuid(),${CO_X},${SA})`)).toBe(true);
    const peer = await session(SA2);
    expect(await count(peer, "leads")).toBe(3);
    expect(await count(peer, "whatsapp_templates")).toBe(1);
  });

  it("Customer Admin whose role is removed mid-session loses admin rights and company data", async () => {
    const s = await session(CA);
    const isAdmin = async () => (await s`SELECT public.org_customer_admin(${CA}::uuid, ${CO_X}::uuid) a`)[0]!["a"];
    expect(await isAdmin()).toBe(true);
    expect(await count(s, "leads")).toBe(1);
    await admin`DELETE FROM user_roles WHERE user_id=${CA} AND role='client'`;
    expect(await isAdmin()).toBe(false);
    expect(await count(s, "leads")).toBe(0);
    const other = await session(OTHER);
    expect(await count(other, "leads")).toBe(1);
  });

  it("Employee permission revocation and deactivation apply immediately", async () => {
    const s = await session(EMP);
    expect(await fails(insertTemplate(s, EMP, CO_X))).toBe(false);
    await admin`DELETE FROM user_access_roles WHERE user_id=${EMP}`;
    expect(await fails(insertTemplate(s, EMP, CO_X))).toBe(true);
    expect(await count(s, "leads")).toBe(1);
    await admin`UPDATE profiles SET account_status='blocked' WHERE id=${EMP}`;
    expect(await count(s, "leads")).toBe(0);
    expect(await fails(s`UPDATE leads SET customer_name='x' WHERE id=${id(31)} RETURNING id`.then((r) => { if (!r.length) throw new Error("no rows"); }))).toBe(true);
  });

  it("other organizations stay isolated and unaffected", async () => {
    const other = await session(OTHER);
    const names = (await other`SELECT customer_name FROM leads`).map((r) => r["customer_name"]);
    expect(names).toEqual(["QA lead OTHER"]);
    expect(await count(other, "whatsapp_templates")).toBe(0);
  });

  it("a stale cached identity with no server-side profile gets nothing", async () => {
    const ghost = await session(id(99));
    expect(await count(ghost, "leads")).toBe(0);
    expect(await count(ghost, "whatsapp_templates")).toBe(0);
  });
});
