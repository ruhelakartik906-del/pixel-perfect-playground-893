import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable local PostgreSQL only (CRM_LICENSE_LOCAL_QA=1, 127.0.0.1:55441, user qa). Never the Cloud DB.
describe.skipIf(process.env["CRM_LICENSE_LOCAL_QA"] !== "1")("Client license lifecycle", () => {
  const sql = postgres({ host: "127.0.0.1", port: 55441, username: "qa", database: "postgres", ssl: false, max: 1 });
  const admin = "11111111-1111-4111-8111-111111111111";
  const client = "22222222-2222-4222-8222-222222222222";
  const hashA = "a".repeat(64), hashB = "b".repeat(64);
  const base = { client_name: "QA", company_name: "QA Co", admin_phone: "", notes: "" };
  type Row = Record<string, string>;
  const act = async (action: string, payload: object): Promise<Row> =>
    (await sql`SELECT crm_installation_action(${action},${sql.json(payload as never)}) AS r`)[0]?.["r"];
  const verify = async (inst: string, hash: string): Promise<Row> =>
    (await sql`SELECT crm_license_verify(${inst},${hash}) AS r`)[0]?.["r"];
  const year = (v: string) => new Date(v).getUTCFullYear();
  let one: Row, two: Row;

  beforeAll(async () => {
    await sql.unsafe(
      `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$; CREATE TABLE public.profiles(id uuid,account_status text); CREATE TABLE public.user_roles(user_id uuid,role text); CREATE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles p JOIN user_roles r ON r.user_id=p.id WHERE p.id=auth.uid() AND p.account_status='active' AND r.role='super_admin') $$; INSERT INTO profiles VALUES('${admin}','active'),('${client}','active'); INSERT INTO user_roles VALUES('${admin}','super_admin'),('${client}','client'); GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;`,
    );
    for (const f of ["0089_sold_crm_installation_registry", "0090_validate_independent_crm_url", "0091_fix_license_action_timestamp", "0092_restrict_license_registry_grants", "0093_client_license_lifecycle", "0094_license_rate_limit_invalid_only"])
      await sql.unsafe(readFileSync(`drizzle/migrations/${f}.sql`, "utf8"));
    await sql`SELECT set_config('qa.uid',${admin},false)`;
  });
  afterAll(async () => { await sql.end(); });

  it("registers as pending without starting validity", async () => {
    one = await act("create", { ...base, admin_email: "one@example.test", crm_url: "https://one.example.test", validity_years: 1, credential_hash: hashA });
    two = await act("create", { ...base, admin_email: "two@example.test", crm_url: "https://two.example.test", validity_years: 2, credential_hash: hashB });
    expect(one).toMatchObject({ license_status: "pending", activated_at: null, valid_until: null });
    expect(one).not.toHaveProperty("credential_hash");
    expect((await verify(one["installation_id"]!, hashA))).toMatchObject({ status: "pending", access_allowed: false });
  });
  it("rejects duplicate registration", async () =>
    await expect(act("create", { ...base, admin_email: "one@example.test", crm_url: "https://x.example.test", validity_years: 1, credential_hash: hashA })).rejects.toThrow());
  it("activates 1-year and 2-year terms with calendar years", async () => {
    one = await act("activate", { id: one["id"], expected_updated_at: one["updated_at"] });
    two = await act("activate", { id: two["id"], expected_updated_at: two["updated_at"] });
    expect(year(one["valid_until"]!) - year(one["activated_at"]!)).toBe(1);
    expect(year(two["valid_until"]!) - year(two["activated_at"]!)).toBe(2);
    expect((await verify(one["installation_id"]!, hashA))).toMatchObject({ status: "active", access_allowed: true });
  });
  it("rejects invalid credentials and cross-installation credentials", async () => {
    expect(await verify(one["installation_id"]!, "c".repeat(64))).toMatchObject({ ok: false });
    expect(await verify(one["installation_id"]!, hashB)).toMatchObject({ ok: false });
    expect(await verify("RCRM-NOPE", hashA)).toMatchObject({ ok: false });
  });
  it("renewing before expiry keeps remaining time", async () => {
    const before = one["valid_until"]!;
    one = await act("renew", { id: one["id"], validity_years: 1, expected_updated_at: one["updated_at"] });
    expect(year(one["valid_until"]!)).toBe(year(before) + 1);
    await expect(act("renew", { id: one["id"], validity_years: 1, expected_updated_at: "2000-01-01T00:00:00Z" })).rejects.toThrow("License changed");
  });
  it("suspends without changing expiry and blocks verification, then resumes", async () => {
    const expiry = one["valid_until"];
    one = await act("suspend", { id: one["id"], expected_updated_at: one["updated_at"] });
    expect(one["valid_until"]).toBe(expiry);
    expect(await verify(one["installation_id"]!, hashA)).toMatchObject({ status: "suspended", access_allowed: false });
    one = await act("resume", { id: one["id"], expected_updated_at: one["updated_at"] });
    expect(await verify(one["installation_id"]!, hashA)).toMatchObject({ status: "active", access_allowed: true });
  });
  it("expired license is denied, cannot be resumed, and renews from today", async () => {
    await sql`UPDATE crm_installations SET activated_at=now()-interval '3 years', valid_until=now()-interval '1 second', license_status='suspended' WHERE id=${two["id"]!}`;
    two = (await sql`SELECT to_jsonb(c) - 'credential_hash' AS r FROM crm_installations c WHERE id=${two["id"]!}`)[0]?.["r"];
    expect(await verify(two["installation_id"]!, hashB)).toMatchObject({ status: "expired", access_allowed: false });
    await expect(act("resume", { id: two["id"], expected_updated_at: two["updated_at"] })).rejects.toThrow("Renew it");
    await sql`UPDATE crm_installations SET license_status='active' WHERE id=${two["id"]!}`;
    expect(await verify(two["installation_id"]!, hashB)).toMatchObject({ status: "expired", access_allowed: false });
    two = (await sql`SELECT to_jsonb(c) - 'credential_hash' AS r FROM crm_installations c WHERE id=${two["id"]!}`)[0]?.["r"];
    two = await act("renew", { id: two["id"], validity_years: 1, expected_updated_at: two["updated_at"] });
    expect(year(two["valid_until"]!)).toBe(new Date().getUTCFullYear() + 1);
  });
  it("rotation revokes the old credential", async () => {
    one = await act("rotate", { id: one["id"], credential_hash: "d".repeat(64), expected_updated_at: one["updated_at"] });
    expect(await verify(one["installation_id"]!, hashA)).toMatchObject({ ok: false });
    expect(await verify(one["installation_id"]!, "d".repeat(64))).toMatchObject({ access_allowed: true });
  });
  it("rate limits repeated invalid attempts", async () => {
    for (let i = 0; i < 10; i++) await verify(two["installation_id"]!, "e".repeat(64));
    expect(await verify(two["installation_id"]!, hashB)).toMatchObject({ code: "RATE_LIMITED" });
  });
  it("audits every change and never stores the credential hash in history", async () => {
    const rows = await sql`SELECT action, after_values FROM crm_installation_audit WHERE installation_id=${one["id"]!}`;
    expect(rows.map((r) => r["action"]).sort()).toEqual(["activate", "create", "renew", "resume", "rotate", "suspend"]);
    expect(JSON.stringify(rows)).not.toContain("credential_hash");
  });
  it("non-admins cannot manage, verify or read hashes", async () => {
    await sql`SELECT set_config('qa.uid',${client},false)`;
    await expect(act("suspend", { id: one["id"], expected_updated_at: one["updated_at"] })).rejects.toThrow("Super Admin");
    await sql.unsafe("SET ROLE authenticated");
    await expect(sql`SELECT crm_license_verify('x','y')`).rejects.toThrow("permission denied");
    await expect(sql`SELECT credential_hash FROM crm_installations`).rejects.toThrow("permission denied");
    await sql.unsafe("RESET ROLE; SET ROLE anon");
    await expect(sql`SELECT crm_license_verify('x','y')`).rejects.toThrow("permission denied");
    await sql.unsafe("RESET ROLE");
  });
});
