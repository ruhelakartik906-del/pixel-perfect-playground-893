import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
describe.skipIf(process.env['CRM_LICENSE_LOCAL_QA']!=='1')('Independent CRM registry authorization and persistence',()=>{
  const sql=postgres({host:'127.0.0.1',port:55441,username:'qa',database:'postgres',ssl:false,max:1});
  const admin='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222';
  let id:string; let expiry:string;
  const payload={client_name:'Isolated QA',company_name:'QA Company',admin_email:'qa@example.test',admin_phone:'',crm_url:'https://qa.example.test',validity_years:1};
  beforeAll(async()=>{
    await sql.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$; CREATE TABLE public.profiles(id uuid,account_status text); CREATE TABLE public.user_roles(user_id uuid,role text); CREATE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles p JOIN user_roles r ON r.user_id=p.id WHERE p.id=auth.uid() AND p.account_status='active' AND r.role='super_admin') $$; INSERT INTO profiles VALUES('${admin}','active'),('${client}','active'); INSERT INTO user_roles VALUES('${admin}','super_admin'),('${client}','client'); GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`);
    await sql.unsafe(readFileSync('drizzle/migrations/0089_sold_crm_installation_registry.sql','utf8'));
    await sql.unsafe(readFileSync('drizzle/migrations/0090_validate_independent_crm_url.sql','utf8'));
    await sql.unsafe(readFileSync('drizzle/migrations/0091_fix_license_action_timestamp.sql','utf8'));
    await sql.unsafe(readFileSync('drizzle/migrations/0092_restrict_license_registry_grants.sql','utf8'));
    await sql`SELECT set_config('qa.uid',${admin},false)`;
  });
  afterAll(async()=>{await sql.end();});
  it('creates a real isolated installation but no local admin account',async()=>{
    const result=(await sql`SELECT crm_installation_action('create',${sql.json(payload)}) AS r`)[0]?.['r'];id=result.id;expiry=result.expires_at;
    expect(result).toMatchObject({license_status:'setup_required',configuration_verified:false,admin_provisioned:false,enforcement_verified:false});
    expect(result.installation_id).toMatch(/^RCRM-[A-F0-9]{32}$/);expect(await sql`SELECT * FROM user_roles`).toHaveLength(2);
    expect(await sql`SELECT * FROM crm_installation_audit WHERE installation_id=${id} AND actor_id=${admin} AND action='create'`).toHaveLength(1);
  });
  it.each([1,2])('SQL calculates %s year validity',async years=>expect((await sql`SELECT crm_license_add_years('2026-10-24T06:00:00Z',${years})::text AS expiry`)[0]?.['expiry']).toBe(`${2026+years}-10-24 06:00:00+00`));
  it('SQL handles Kolkata leap day',async()=>expect((await sql`SELECT crm_license_add_years('2024-02-28T20:00:00Z',1)::text AS expiry`)[0]?.['expiry']).toBe('2025-02-27 20:00:00+00'));
  it('duplicate creation produces no second installation or event',async()=>{await expect(sql`SELECT crm_installation_action('create',${sql.json(payload)})`).rejects.toThrow('duplicate');expect(await sql`SELECT * FROM crm_installations`).toHaveLength(1);expect(await sql`SELECT * FROM crm_installation_audit`).toHaveLength(1);});
  it.each(['https://pixel-perfect-playground-893.lovable.app','https://app.hatflow.in','https://a..example.test'])('direct RPC rejects nonindependent or invalid URL %s',async crm_url=>await expect(sql`SELECT crm_installation_action('create',${sql.json({...payload,admin_email:'different@example.test',crm_url})})`).rejects.toThrow('independent'));
  it('extends once from valid expiry and rejects stale duplicate confirmation',async()=>{const p={id,validity_years:2,expected_expiry:expiry};const r=(await sql`SELECT crm_installation_action('extend',${sql.json(p)}) AS r`)[0]?.['r'];expect(new Date(r.expires_at).getUTCFullYear()).toBe(new Date(expiry).getUTCFullYear()+2);await expect(sql`SELECT crm_installation_action('extend',${sql.json(p)})`).rejects.toThrow('License changed');expect(await sql`SELECT * FROM crm_installation_audit`).toHaveLength(2);});
  it('concurrent renewals commit once with one accurate audit entry',async()=>{
    const peer=postgres({host:'127.0.0.1',port:55441,username:'qa',database:'postgres',ssl:false,max:1});
    try {
      await peer`SELECT set_config('qa.uid',${admin},false)`;
      const before=(await sql`SELECT * FROM crm_installations WHERE id=${id}`)[0];
      const auditBefore=await sql`SELECT * FROM crm_installation_audit WHERE installation_id=${id}`;
      const p={id,validity_years:1,expected_expiry:new Date(before?.['expires_at']).toISOString()};
      const results=await Promise.allSettled([sql`SELECT crm_installation_action('extend',${sql.json(p)})`,peer`SELECT crm_installation_action('extend',${peer.json(p)})`]);
      expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      const failure=results.find(r=>r.status==='rejected');
      expect(failure?.status==='rejected' ? failure.reason.message : '').toContain('License changed');
      const after=(await sql`SELECT * FROM crm_installations WHERE id=${id}`)[0];
      expect(new Date(after?.['expires_at']).getUTCFullYear()).toBe(new Date(before?.['expires_at']).getUTCFullYear()+1);
      expect(await sql`SELECT * FROM crm_installation_audit WHERE installation_id=${id}`).toHaveLength(auditBefore.length+1);
    } finally {await peer.end();}
  });
  it.each(['active','suspended'])('unverified %s state fails the database constraint',async license_status=>await expect(sql`UPDATE crm_installations SET license_status=${license_status} WHERE id=${id}`).rejects.toThrow('check constraint'));
  it('invalid installation lookup does not produce an allowed license',async()=>expect((await sql`SELECT crm_installation_license_state('33333333-3333-4333-8333-333333333333') AS r`)[0]?.['r']).toBeNull());
  it('expired license is denied server-side',async()=>{
    const r=(await sql`SELECT crm_installation_action('create',${sql.json({...payload,admin_email:'expired@example.test',crm_url:'https://expired.example.test'})}) AS r`)[0]?.['r'];
    await sql`UPDATE crm_installations SET starts_at=now()-interval '2 years',expires_at=now()-interval '1 second' WHERE id=${r.id}`;
    expect((await sql`SELECT crm_installation_license_state(${r.id}) AS r`)[0]?.['r']).toMatchObject({status:'expired',access_allowed:false});
  });
  it.each(['activate','suspend','reset'])('unconfigured %s cannot claim success',async action=>await expect(sql`SELECT crm_installation_action(${action},${sql.json({id})})`).rejects.toThrow('Setup Required'));
  it('setup required license denies actual access',async()=>expect((await sql`SELECT crm_installation_license_state(${id}) AS r`)[0]?.['r'].access_allowed).toBe(false));
  it('active Admin can read and ordinary users cannot read/write licenses or audit',async()=>{
    await sql.unsafe('SET ROLE authenticated');expect(await sql`SELECT * FROM crm_installations`).toHaveLength(2);
    await sql`SELECT set_config('qa.uid',${client},false)`;expect(await sql`SELECT * FROM crm_installations`).toHaveLength(0);expect(await sql`SELECT * FROM crm_installation_audit`).toHaveLength(0);
    await expect(sql`SELECT crm_installation_action('create',${sql.json({...payload,admin_email:'other@example.test'})})`).rejects.toThrow('Super Admin');
    await expect(sql`UPDATE crm_installations SET license_status='active' WHERE id=${id}`).rejects.toThrow('permission denied');
    await expect(sql`INSERT INTO crm_installation_audit(installation_id,actor_id,action,after_values) VALUES(${id},${client},'activate','{}')`).rejects.toThrow('permission denied');
    await expect(sql`UPDATE crm_installation_audit SET action='activate' WHERE installation_id=${id}`).rejects.toThrow('permission denied');
    await expect(sql`DELETE FROM crm_installation_audit WHERE installation_id=${id}`).rejects.toThrow('permission denied');
    await expect(sql`SELECT crm_installation_license_state(${id})`).rejects.toThrow('permission denied');await sql.unsafe('RESET ROLE');
  });
  it.each(['pending','blocked'])('%s Super Admin cannot manage licenses',async status=>{await sql`UPDATE profiles SET account_status=${status} WHERE id=${admin}`;await sql`SELECT set_config('qa.uid',${admin},false)`;await expect(sql`SELECT crm_installation_action('extend',${sql.json({id,validity_years:1,expected_expiry:expiry})})`).rejects.toThrow('Super Admin');});
  it('public cannot execute management or licensing probes',async()=>{await sql.unsafe('SET ROLE anon');await expect(sql`SELECT crm_installation_action('create',${sql.json(payload)})`).rejects.toThrow('permission denied');await expect(sql`SELECT * FROM crm_installations`).rejects.toThrow('permission denied');await sql.unsafe('RESET ROLE');});
});