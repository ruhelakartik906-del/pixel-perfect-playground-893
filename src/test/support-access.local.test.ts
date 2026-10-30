import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { remaining, sessionState } from "@/lib/support-access";

// Disposable local PostgreSQL only (CRM_LICENSE_LOCAL_QA=1, 127.0.0.1:55441, user qa). Never the Cloud DB.
describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Master Admin support access", () => {
  const db = { host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false as const, max: 1, onnotice: () => {} };
  const admin = postgres(db);
  const conns: postgres.Sql[] = [];
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const [SA, SA2, CA, CA_Y, CO_X, CO_Y] = [1, 2, 3, 4, 10, 11].map(id) as [string, string, string, string, string, string];
  const LEAD_X = id(30), LEAD_Y = id(31);

  async function as(uid: string) {
    const s = postgres(db); conns.push(s);
    await s.unsafe(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false)`);
    return s;
  }
  const start = (s: postgres.Sql, company: string, mode: string, minutes = 15) =>
    s`SELECT public.support_session_start(${company}::uuid, ${mode}, 'QA support ticket', ${minutes}) AS id`.then((r) => r[0]!["id"] as string);
  const read = (s: postgres.Sql, sess: string, res: string) => s`SELECT public.support_read(${sess}::uuid, ${res}) AS r`.then((r) => r[0]!["r"] as { data?: unknown; error?: string });
  const write = (s: postgres.Sql, sess: string, lead: string, status: string) =>
    s`SELECT public.support_write(${sess}::uuid, 'lead.update', ${s.json({ lead_id: lead, status })}) AS r`.then((r) => r[0]!["r"] as { ok?: boolean; error?: string });
  const audit = (sess: string) => admin`SELECT action FROM org_support_audit WHERE session_id=${sess} ORDER BY created_at, action`.then((r) => r.map((x) => x["action"]));
  const rejects = async (p: Promise<unknown>) => { try { await p; return false; } catch { return true; } };

  beforeAll(async () => {
    await admin.unsafe(readFileSync("src/test/fixtures/security-live-rls.sql", "utf8"));
    await admin.unsafe(`
      ALTER TABLE companies ADD PRIMARY KEY (id);
      CREATE TABLE public.org_support_sessions (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
        master_user_id uuid not null, mode text not null check (mode in ('view','support')), started_at timestamptz not null default now(), ended_at timestamptz, revoked boolean not null default false);
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_support_sessions TO authenticated; ALTER TABLE public.org_support_sessions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Admins manage support sessions" ON public.org_support_sessions FOR ALL TO authenticated USING (public.routing_admin()) WITH CHECK (public.routing_admin());
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await admin.unsafe(readFileSync("drizzle/migrations/0101_support_workspace_access.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
    await admin.unsafe(`
      INSERT INTO license_state(id,mode) VALUES (true,'master');
      INSERT INTO companies(id,name,is_active) VALUES ('${CO_X}','QA Customer X',true),('${CO_Y}','QA Customer Y',true);
      INSERT INTO profiles(id,account_status,full_name) VALUES ('${SA}','active','Master'),('${SA2}','active','Master 2'),('${CA}','active','Cust Admin X'),('${CA_Y}','active','Cust Admin Y');
      INSERT INTO user_roles(id,user_id,role) VALUES (gen_random_uuid(),'${SA}','super_admin'),(gen_random_uuid(),'${SA2}','super_admin'),(gen_random_uuid(),'${CA}','client'),(gen_random_uuid(),'${CA_Y}','client');
      INSERT INTO company_members(id,company_id,user_id) VALUES (gen_random_uuid(),'${CO_X}','${CA}'),(gen_random_uuid(),'${CO_Y}','${CA_Y}');
      INSERT INTO leads(id,company_id,customer_name,status,requirements,created_at) VALUES ('${LEAD_X}','${CO_X}','Lead X','new','',now()),('${LEAD_Y}','${CO_Y}','Lead Y','new','',now());`);
  });

  afterAll(async () => {
    await Promise.all(conns.map((c) => c.end()));
    await admin.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.end();
  });

  it("only an active Super Admin can start a session, with valid mode/duration/reason", async () => {
    expect(await rejects(as(CA).then((s) => start(s, CO_X, "view")))).toBe(true);
    const sa = await as(SA);
    expect(await rejects(start(sa, CO_X, "admin"))).toBe(true);
    expect(await rejects(start(sa, CO_X, "view", 120))).toBe(true);
    expect(await rejects(sa`SELECT public.support_session_start(${CO_X}::uuid,'view','x',15)`)).toBe(true);
  });

  it("sessions cannot be created or edited directly through the Data API", async () => {
    const sa = await as(SA);
    expect(await rejects(sa`INSERT INTO org_support_sessions(company_id,master_user_id,mode,expires_at) VALUES (${CO_X},${SA},'support',now()+interval '9 days')`)).toBe(true);
    expect(await rejects(sa`INSERT INTO org_support_audit(session_id,company_id,actor_id,action) VALUES (gen_random_uuid(),${CO_X},${SA},'fake')`)).toBe(true);
  });

  it("View Only reads the bound organization but cannot write", async () => {
    const sa = await as(SA);
    const sess = await start(sa, CO_X, "view");
    const leads = (await read(sa, sess, "leads")).data as { id: string }[];
    expect(leads.map((l) => l.id)).toEqual([LEAD_X]);
    expect((await write(sa, sess, LEAD_X, "won")).error).toMatch(/View Only/);
    expect((await admin`SELECT status FROM leads WHERE id=${LEAD_X}`)[0]!["status"]).toBe("new");
    expect(await audit(sess)).toEqual(expect.arrayContaining(["session.start", "view.leads", "denied.write_in_view_mode"]));
  });

  it("Full Support writes are organization-bound and audited with before/after", async () => {
    const sa = await as(SA);
    const sess = await start(sa, CO_X, "support");
    expect((await write(sa, sess, LEAD_X, "contacted")).ok).toBe(true);
    expect((await admin`SELECT status FROM leads WHERE id=${LEAD_X}`)[0]!["status"]).toBe("contacted");
    expect(await rejects(write(sa, sess, LEAD_Y, "won"))).toBe(true);
    expect((await admin`SELECT status FROM leads WHERE id=${LEAD_Y}`)[0]!["status"]).toBe("new");
    const row = (await admin`SELECT detail FROM org_support_audit WHERE session_id=${sess} AND action='lead.update'`)[0]!["detail"] as { before: { status: string }; after: { status: string } };
    expect(row.before.status).toBe("new");
    expect(row.after.status).toBe("contacted");
  });

  it("another Super Admin cannot use someone else's session", async () => {
    const sess = await start(await as(SA), CO_X, "support");
    const other = await as(SA2);
    expect(await rejects(read(other, sess, "leads"))).toBe(true);
  });

  it("starting a new session closes the previous one", async () => {
    const sa = await as(SA);
    const first = await start(sa, CO_X, "view");
    await start(sa, CO_Y, "view");
    expect(await rejects(read(sa, first, "leads"))).toBe(true);
    expect(await audit(first)).toContain("session.replaced");
  });

  it("expired sessions are refused, closed and audited", async () => {
    const sa = await as(SA);
    const sess = await start(sa, CO_X, "support");
    await admin`UPDATE org_support_sessions SET expires_at = now() - interval '1 second' WHERE id=${sess}`;
    expect((await read(sa, sess, "leads")).error).toMatch(/expired/);
    expect(await rejects(write(sa, sess, LEAD_X, "won"))).toBe(true);
    expect((await admin`SELECT end_reason FROM org_support_sessions WHERE id=${sess}`)[0]!["end_reason"]).toBe("expired");
    expect(await audit(sess)).toContain("session.expired");
  });

  it("Customer Admin can revoke a live session of their own organization only", async () => {
    const sa = await as(SA);
    const sess = await start(sa, CO_X, "support");
    expect(await rejects(as(CA_Y).then((s) => s`SELECT public.support_session_end(${sess}::uuid,'not mine')`))).toBe(true);
    const ca = await as(CA);
    expect((await ca`SELECT id FROM org_support_sessions WHERE id=${sess}`).length).toBe(1);
    expect((await (await as(CA_Y))`SELECT id FROM org_support_sessions WHERE id=${sess}`).length).toBe(0);
    await ca`SELECT public.support_session_end(${sess}::uuid,'customer revoked')`;
    expect(await rejects(read(sa, sess, "leads"))).toBe(true);
    expect(await audit(sess)).toContain("session.revoked");
    expect((await ca`SELECT count(*)::int c FROM org_support_audit WHERE session_id=${sess}`)[0]!["c"]).toBeGreaterThan(0);
  });

  it("secure exit ends the session immediately", async () => {
    const sa = await as(SA);
    const sess = await start(sa, CO_X, "view");
    await sa`SELECT public.support_session_end(${sess}::uuid,'done')`;
    expect(await rejects(read(sa, sess, "overview"))).toBe(true);
    expect(await audit(sess)).toContain("session.exit");
  });

  it("a Super Admin suspended mid-session loses access immediately", async () => {
    const sa = await as(SA2);
    const sess = await start(sa, CO_X, "support");
    await admin`UPDATE profiles SET account_status='blocked' WHERE id=${SA2}`;
    expect(await rejects(read(sa, sess, "leads"))).toBe(true);
    await admin`UPDATE profiles SET account_status='active' WHERE id=${SA2}`;
  });

  it("display helpers reflect state and countdown", () => {
    const now = Date.parse("2026-10-30T12:00:00Z");
    expect(sessionState({ ended_at: null, revoked: false, expires_at: "2026-10-30T12:01:00Z" }, now)).toBe("live");
    expect(sessionState({ ended_at: null, revoked: false, expires_at: "2026-10-30T11:59:00Z" }, now)).toBe("expired");
    expect(sessionState({ ended_at: "x", revoked: true, expires_at: "2026-10-30T12:01:00Z" }, now)).toBe("revoked");
    expect(remaining("2026-10-30T12:01:05Z", now).label).toBe("1:05");
  });
});
