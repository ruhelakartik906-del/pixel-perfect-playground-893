-- Organization-level WhatsApp Business (Meta Cloud API) connections.
-- Connection metadata is readable by the organization's members and active Super Admins;
-- every write goes through authorized server functions (service role). Access tokens live
-- in a separate service-role-only table, encrypted by the app server before storage.

create table public.org_whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text,
  verified_name text,
  business_name text,
  quality_rating text,
  coexistence boolean not null default false,
  status text not null default 'pending' check (status in ('pending','connected','error','token_expired','disconnected','revoked')),
  token_ok boolean not null default false,
  number_registered boolean not null default false,
  webhook_subscribed boolean not null default false,
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  last_health_at timestamptz,
  last_error text,
  connected_by uuid,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index org_whatsapp_active_phone on public.org_whatsapp_connections(phone_number_id) where status not in ('disconnected','revoked');
create index org_whatsapp_company on public.org_whatsapp_connections(company_id);

grant select on public.org_whatsapp_connections to authenticated;
grant all on public.org_whatsapp_connections to service_role;
alter table public.org_whatsapp_connections enable row level security;
create policy org_whatsapp_read on public.org_whatsapp_connections for select to authenticated
  using (
    exists (select 1 from public.company_members cm join public.profiles p on p.id = cm.user_id
            where cm.company_id = org_whatsapp_connections.company_id and cm.user_id = auth.uid() and p.account_status = 'active')
    or public.routing_admin()
  );
create policy license_gate on public.org_whatsapp_connections as restrictive for all to authenticated
  using (public.license_active()) with check (public.license_active());

create table public.org_whatsapp_secrets (
  connection_id uuid primary key references public.org_whatsapp_connections(id) on delete cascade,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);
grant all on public.org_whatsapp_secrets to service_role;
alter table public.org_whatsapp_secrets enable row level security;
revoke all on public.org_whatsapp_secrets from anon, authenticated;

create table public.org_whatsapp_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid,
  actor uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index org_whatsapp_audit_company on public.org_whatsapp_audit(company_id, created_at desc);
grant select on public.org_whatsapp_audit to authenticated;
grant all on public.org_whatsapp_audit to service_role;
alter table public.org_whatsapp_audit enable row level security;
create policy org_whatsapp_audit_read on public.org_whatsapp_audit for select to authenticated
  using (public.org_customer_admin(auth.uid(), company_id) or public.routing_admin());
create policy license_gate on public.org_whatsapp_audit as restrictive for all to authenticated
  using (public.license_active()) with check (public.license_active());

create table public.org_whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  connection_id uuid,
  phone_number_id text,
  waba_id text,
  field text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
create index org_whatsapp_events_company on public.org_whatsapp_webhook_events(company_id, received_at desc);
grant select on public.org_whatsapp_webhook_events to authenticated;
grant all on public.org_whatsapp_webhook_events to service_role;
alter table public.org_whatsapp_webhook_events enable row level security;
create policy org_whatsapp_events_read on public.org_whatsapp_webhook_events for select to authenticated
  using ((company_id is not null and public.org_customer_admin(auth.uid(), company_id)) or public.routing_admin());
create policy license_gate on public.org_whatsapp_webhook_events as restrictive for all to authenticated
  using (public.license_active()) with check (public.license_active());