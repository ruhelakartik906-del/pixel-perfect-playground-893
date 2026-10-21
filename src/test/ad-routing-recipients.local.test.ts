import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

describe.skipIf(process.env['LEADS_LOCAL_QA'] !== '1')('Ad routing active recipients and private source isolation', () => {
  const sql = postgres({ host: '127.0.0.1', port: 55440, database: 'postgres', username: 'qa', ssl: false, max: 1 });
  const company='11111111-1111-4111-8111-111111111111', otherCompany='22222222-2222-4222-8222-222222222222';
  const client='33333333-3333-4333-8333-333333333333', employee='44444444-4444-4444-8444-444444444444', admin='55555555-5555-4555-8555-555555555555';
  let rule: string; const leadIds: string[]=[];
  beforeAll(async () => {
    await sql.unsafe(`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public; CREATE SCHEMA auth;`);
    await sql.unsafe(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
      CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,email text,account_status text);
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE TABLE companies(id uuid PRIMARY KEY,name text,is_active boolean);
      CREATE TABLE company_members(user_id uuid,company_id uuid);
      CREATE TABLE hr_employees(profile_id uuid,company_id uuid,is_active boolean,access_status text);
      CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
      CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid,created_by uuid,private_owner_id uuid,assigned_to uuid,customer_name text,intake_source text,intake_rule_id uuid,meta_account_id text,meta_page_id text,meta_campaign_id text,meta_adset_id text,meta_ad_id text,meta_lead_id text UNIQUE);
      CREATE TABLE lead_activities(lead_id uuid);
      INSERT INTO profiles VALUES('${client}','Client','client@example.test','active'),('${employee}','Employee','employee@example.test','active'),('${admin}','Admin','admin@example.test','active');
      INSERT INTO user_roles VALUES('${client}','client'),('${employee}','employee'),('${admin}','super_admin');
      INSERT INTO companies VALUES('${company}','Source Company',true),('${otherCompany}','Other Company',true);
      INSERT INTO company_members VALUES('${employee}','${company}');`);
    await sql.unsafe(readFileSync('drizzle/migrations/0021_atomic_ad_lead_routing.sql','utf8'));
    await sql.unsafe(`CREATE FUNCTION lead_workspace_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND account_status='active') $$;
      CREATE FUNCTION user_crm_company(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM company_members WHERE user_id=auth.uid() AND company_id=$1) $$;
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Active CRM lead access" ON leads AS RESTRICTIVE FOR ALL TO authenticated USING(routing_admin() OR lead_workspace_active());
      CREATE POLICY lead_account_assignment_boundary ON leads AS RESTRICTIVE FOR ALL TO authenticated USING(routing_admin() OR assigned_to=auth.uid());
      CREATE POLICY private_lead_boundary ON leads AS RESTRICTIVE FOR ALL TO authenticated USING(private_owner_id IS NULL OR private_owner_id=auth.uid());
      CREATE POLICY company_read ON leads FOR SELECT TO authenticated USING((assigned_to=auth.uid() AND user_crm_company(company_id)) OR routing_admin());
      GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT ON leads,lead_activities TO authenticated;
      ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION lead_company_stage_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      SELECT set_config('qa.uid','${admin}',false);`);
    await sql.unsafe(readFileSync('drizzle/migrations/0084_secure_ad_routing_active_recipients.sql','utf8'));
    await sql.unsafe(readFileSync('drizzle/migrations/0085_exact_ad_routed_private_boundary.sql','utf8'));
    await sql.unsafe(readFileSync('drizzle/migrations/0086_qualify_private_routing_admin_read.sql','utf8'));
    await sql.unsafe(`ALTER POLICY "Active CRM lead access" ON leads USING(routing_admin() OR lead_record_allowed(company_id,created_by,assigned_to,private_owner_id));`);
    rule=String((await sql`SELECT routing_rule_action('save',${sql.json({company_id:company,name:'Scoped',account_id:'123',page_id:'456',status:'active',steps:[{user_id:client,quota:1},{user_id:employee,quota:1}]})}) AS id`)[0]?.['id']);
  });
  afterAll(async()=>{await sql.end();});
  async function insert(external: string, sourceCompany=company, page='456') {
    const id=crypto.randomUUID(); await sql`INSERT INTO leads(id,company_id,created_by,customer_name,meta_account_id,meta_page_id,meta_lead_id,intake_source) VALUES(${id},${sourceCompany},${admin},'Routing QA','123',${page},${external},'facebook')`; return id;
  }
  it('active Client receives first routed lead privately without changing source company',async()=>{
    const id=await insert('one');leadIds.push(id);
    expect((await sql`SELECT company_id,assigned_to,private_owner_id FROM leads WHERE id=${id}`)[0]).toMatchObject({company_id:company,assigned_to:client,private_owner_id:client});
    expect(await sql`SELECT lead_id FROM lead_assignment_events WHERE lead_id=${id} AND assignment_type='automatic'`).toHaveLength(1);
  });
  it('active Employee receives next routed lead with original company scope',async()=>{
    const id=await insert('two');leadIds.push(id);
    expect((await sql`SELECT company_id,assigned_to,private_owner_id FROM leads WHERE id=${id}`)[0]).toMatchObject({company_id:company,assigned_to:employee,private_owner_id:null});
    expect((await sql`SELECT assigned_count FROM ad_routing_steps WHERE rule_id=${rule} ORDER BY position`).map(r=>r['assigned_count'])).toEqual(['1','1']);
  });
  it('Admin reads both real assignment records including private routed delivery',async()=>{
    await sql.unsafe('SET ROLE authenticated');
    expect((await sql`SELECT id FROM leads`).map(r=>r['id']).sort()).toEqual([...leadIds].sort());
    await sql.unsafe('RESET ROLE');
  });
  it('exhausted quotas leave lead unassigned with no event or extra counters',async()=>{
    const id=await insert('three');expect((await sql`SELECT assigned_to FROM leads WHERE id=${id}`)[0]?.['assigned_to']).toBe(null);
    expect(await sql`SELECT lead_id FROM lead_routing_queue WHERE lead_id=${id}`).toHaveLength(1);expect(await sql`SELECT lead_id FROM lead_assignment_events WHERE lead_id=${id}`).toHaveLength(0);
    expect((await sql`SELECT total_leads FROM ad_routing_rules WHERE id=${rule}`)[0]?.['total_leads']).toBe('2');
  });
  it('duplicate arrivals and assignment retries preserve exactly one event and accurate quotas',async()=>{
    await expect(insert('one')).rejects.toThrow('duplicate');
    const first=leadIds[0]; if(!first) throw new Error('First lead missing');
    expect((await sql`SELECT route_lead(${first}) AS result`)[0]?.['result'].status).toBe('already_assigned');
    expect(await sql`SELECT lead_id FROM lead_assignment_events WHERE rule_id=${rule}`).toHaveLength(2);
  });
  it('source Page and company mismatches never route',async()=>{for(const id of [await insert('wrong-company',otherCompany),await insert('wrong-page',company,'789')])expect((await sql`SELECT assigned_to FROM leads WHERE id=${id}`)[0]?.['assigned_to']).toBe(null);});
  it.each([client,employee])('recipient %s reads only own lead, including fresh reread; no cross-user company access',async user=>{
    await sql`SELECT set_config('qa.uid',${user},false)`;await sql.unsafe('SET ROLE authenticated');
    const expected=user===client?leadIds[0]:leadIds[1];
    for(let i=0;i<2;i++)expect((await sql`SELECT id FROM leads ORDER BY id`).map(r=>r['id'])).toEqual([expected]);
    await sql.unsafe('RESET ROLE');await sql`SELECT set_config('qa.uid',${admin},false)`;
  });
  it.each(['pending','blocked'])('%s Client/Employee excluded and cannot read previous assignments',async status=>{
    for(const user of [client,employee]){
      await sql`UPDATE profiles SET account_status=${status} WHERE id=${user}`;
      expect((await sql`SELECT ad_routing_eligible(${user},${company}) AS allowed`)[0]?.['allowed']).toBe(false);
      expect((await sql`SELECT ad_routing_recipients()`).some(r=>r['user_id']===user)).toBe(false);
      await sql`SELECT set_config('qa.uid',${user},false)`;await sql.unsafe('SET ROLE authenticated');expect(await sql`SELECT id FROM leads`).toHaveLength(0);await sql.unsafe('RESET ROLE');
      await sql`SELECT set_config('qa.uid',${admin},false)`;await sql`UPDATE profiles SET account_status='active' WHERE id=${user}`;
    }
  });
  it('HR restricted recipients and unrelated-company members cannot receive mapped leads',async()=>{
    await sql`INSERT INTO hr_employees VALUES(${employee},${company},true,'pending')`;
    expect((await sql`SELECT ad_routing_eligible(${employee},${company}) AS allowed`)[0]?.['allowed']).toBe(false);
    expect((await sql`SELECT ad_routing_eligible(${employee},${otherCompany}) AS allowed`)[0]?.['allowed']).toBe(false);
    expect((await sql`SELECT routing_eligible(${client},${company}) AS allowed`)[0]?.['allowed']).toBe(false);
  });
  it('ordinary users cannot probe recipient directory or edit routing',async()=>{
    await sql`SELECT set_config('qa.uid',${client},false)`;
    await expect(sql`SELECT ad_routing_recipients()`).rejects.toThrow('Super Admin');
    await sql.unsafe('SET ROLE authenticated');await expect(sql`SELECT ad_routing_eligible(${employee},${company})`).rejects.toThrow('permission denied');await sql.unsafe('RESET ROLE');
  });
});