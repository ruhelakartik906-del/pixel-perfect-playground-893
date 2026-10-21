import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { userLeadActionSchema } from '@/lib/user-crm';
import { parseCompanyStages } from './leads-board';

export const loadUserCrm = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const [profileResult, roleResult] = await Promise.all([
    db.from('profiles').select('id,full_name,email,account_status').eq('id', context.userId).single(),
    db.from('user_roles').select('role').eq('user_id', context.userId),
  ]);
  if (profileResult.error || roleResult.error) throw new Error('Account could not be loaded');
  const profile = profileResult.data, roles = roleResult.data.map(r => r.role);
  const allowed = profile.account_status === 'active' && roles.some(r => ['employee', 'manager', 'client', 'super_admin'].includes(r));
  async function all<T>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await fetchPage(offset);
      if (result.error) throw new Error('Your CRM records could not be loaded');
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) return rows;
    }
  }
  const memberships = allowed ? await all(o => db.from('company_members').select('company_id').eq('user_id', context.userId).order('id').range(o, o + 999)) : [];
  const companyIds = memberships.map(m => m.company_id);
  const companies = companyIds.length ? await all(o => db.from('companies').select('id,name,is_active').in('id', companyIds).eq('is_active', true).order('id').range(o, o + 999)) : [];
  const authorizedIds = new Set(companies.map(c => c.id));
  const ids = [...authorizedIds];
  const [leads, deals, work, stages, sources] = await Promise.all([
    ids.length ? all(o => db.from('leads').select('*').eq('assigned_to', context.userId).in('company_id', ids).order('id').range(o, o + 999)) : [],
    ids.length ? all(o => db.from('deals').select('id,title,status,created_at,company_id').eq('assigned_to', context.userId).in('company_id', ids).order('id').range(o, o + 999)) : [],
    ids.length && !roles.includes('client') ? all(o => db.from('crm_work_items').select('*').eq('assigned_to', context.userId).in('company_id', ids).is('deleted_at', null).order('id').range(o, o + 999)) : [],
    all(o => db.from('crm_stages').select('*').eq('kind', 'lead').order('position').order('id').range(o, o + 999)),
    all(o => db.from('crm_options').select('id,name,is_active').eq('category', 'source').order('id').range(o, o + 999)),
  ]);
  const ownLeads = allowed ? leads.filter(l => l.company_id && authorizedIds.has(l.company_id)) : [];
  const companyStages=await Promise.all(companies.map(async c=>{const result=await db.rpc('lead_company_stages',{_company:c.id});if(result.error)throw new Error('Company lead statuses could not be loaded');return {company_id:c.id,stages:parseCompanyStages(result.data)};}));
  const activities: Array<import('@/integrations/supabase/types').Database['public']['Tables']['lead_activities']['Row']> = [];
  for (let i = 0; i < ownLeads.length; i += 100) {
    activities.push(...await all(o => db.from('lead_activities').select('*').in('lead_id', ownLeads.slice(i, i + 100).map(l => l.id)).order('id').range(o, o + 999)));
  }
  return { profile, roles, userId: context.userId, allowed, leads: ownLeads, deals: allowed ? deals.filter(d => d.company_id && authorizedIds.has(d.company_id)) : [], work: allowed ? work.filter(w => authorizedIds.has(w.company_id)) : [], stages, sources, companies, companyStages, activities };
});
export const updateUserLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => userLeadActionSchema.parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc('user_lead_action', { _id: data.id, _updated_at: data.updated_at, _action: data.action, _payload: data.payload });
  if (result.error) throw new Error(result.error.message);
  return result.data;
});
export type UserCrmData = Awaited<ReturnType<typeof loadUserCrm>>;