import { createServerFn } from '@tanstack/react-start';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { PROVIDERS, defaultPolicy, policyInput } from './integration-marketplace';

export const integrationMarketplace = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ company_id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ context, data }) => {
    const membership = await context.supabase.from('company_members').select('company_id').eq('company_id', data.company_id).eq('user_id', context.userId).maybeSingle();
    if (membership.error || !membership.data) throw new Error('Organization access denied');
    const policies = await context.supabase.from('integration_platform_policies').select('provider,enabled,plan_ids,max_connections,required_permissions');
    if (policies.error) throw new Error('Integration settings could not be loaded');
    const providers = await Promise.all(PROVIDERS.map(async provider => {
      const [view, manage, use] = await Promise.all(['view', 'manage', 'use'].map(action => context.supabase.rpc('integration_provider_allowed', { _company: data.company_id, _provider: provider.id, _action: action })));
      if (view?.error || manage?.error || use?.error) throw new Error('Integration permissions could not be verified');
      const saved = policies.data.find(p => p.provider === provider.id);
      return { ...provider, policy: saved ? policyInput.parse(saved) : defaultPolicy(provider.id), allowed: view?.data === true, can_manage: manage?.data === true, can_use: use?.data === true };
    }));
    const connections = await context.supabase.from('org_whatsapp_connections').select('id,status,display_phone_number,verified_name,last_health_at,last_error,scopes').eq('company_id', data.company_id).not('status', 'in', '(disconnected,revoked)');
    if (connections.error) throw new Error('Connections could not be loaded');
    return { providers, whatsapp: connections.data };
  });

export const marketplaceQuery = (company_id: string) => queryOptions({ queryKey: ['integration-marketplace', company_id], queryFn: () => integrationMarketplace({ data: { company_id } }), staleTime: 15_000 });

export const masterIntegrationPolicies = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const check = await context.supabase.rpc('routing_admin');
    if (check.error || check.data !== true) throw new Error('Active Super Admin required');
    const [policies, plans, audit] = await Promise.all([
      context.supabase.from('integration_platform_policies').select('provider,enabled,plan_ids,max_connections,required_permissions'),
      context.supabase.from('plans').select('id,name,is_active').order('name'),
      context.supabase.from('integration_platform_audit').select('id,provider,created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    if (policies.error || plans.error || audit.error) throw new Error('Integration policies could not be loaded');
    const metaReady = Boolean(process.env['META_APP_ID'] && process.env['META_APP_SECRET'] && process.env['META_WEBHOOK_VERIFY_TOKEN']);
    return { policies: PROVIDERS.map(p => {
      const row = policies.data.find(s => s.provider === p.id);
      return row ? policyInput.parse(row) : defaultPolicy(p.id);
    }), plans: plans.data, audit: audit.data, readiness: {
      whatsapp: metaReady && Boolean(process.env['META_EMBEDDED_SIGNUP_CONFIG_ID'] && process.env['WHATSAPP_TOKEN_ENCRYPTION_KEY']),
      meta_ads: metaReady, google_calendar: Boolean(process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY']),
      google_meet: Boolean(process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY']),
      zoom: Boolean(process.env['ZOOM_CLIENT_ID'] && process.env['ZOOM_CLIENT_SECRET']),
    } };
  });

export const masterPolicyQuery = queryOptions({ queryKey: ['master-integration-policies'], queryFn: () => masterIntegrationPolicies(), staleTime: 15_000 });

export const saveIntegrationPolicy = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => policyInput.parse(input))
  .handler(async ({ context, data }) => {
    const result = await context.supabase.rpc('master_save_integration_policy', { _provider: data.provider, _enabled: data.enabled, _plans: data.plan_ids, _max: data.max_connections, _permissions: data.required_permissions });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });