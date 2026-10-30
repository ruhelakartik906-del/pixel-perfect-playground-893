-- Stage 1 multi-tenant core: plans, subscriptions, feature permissions, usage limits, support sessions.
-- Tenant = existing public.companies row. All changes additive; existing companies keep current behavior.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  limits jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  unique (plan_id, feature_key)
);

create table public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'active' check (status in ('active','suspended','expired')),
  term_months integer not null default 12 check (term_months in (12,24)),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_feature_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (company_id, feature_key)
);

create table public.org_usage_limits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  max_employees integer,
  max_leads integer,
  monthly_whatsapp_messages integer,
  max_whatsapp_numbers integer,
  max_chatbots integer,
  max_workflows integer,
  max_drip_campaigns integer,
  max_api_requests integer,
  max_storage_mb integer,
  updated_at timestamptz not null default now()
);

create table public.org_support_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  master_user_id uuid not null,
  mode text not null check (mode in ('view','support')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  revoked boolean not null default false
);

grant select, insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
grant select, insert, update, delete on public.plan_features to authenticated;
grant all on public.plan_features to service_role;
grant select, insert, update, delete on public.org_subscriptions to authenticated;
grant all on public.org_subscriptions to service_role;
grant select, insert, update, delete on public.org_feature_permissions to authenticated;
grant all on public.org_feature_permissions to service_role;
grant select, insert, update, delete on public.org_usage_limits to authenticated;
grant all on public.org_usage_limits to service_role;
grant select, insert, update, delete on public.org_support_sessions to authenticated;
grant all on public.org_support_sessions to service_role;

alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.org_subscriptions enable row level security;
alter table public.org_feature_permissions enable row level security;
alter table public.org_usage_limits enable row level security;
alter table public.org_support_sessions enable row level security;

create policy "Admins manage plans" on public.plans for all to authenticated using (public.routing_admin()) with check (public.routing_admin());
create policy "Admins manage plan features" on public.plan_features for all to authenticated using (public.routing_admin()) with check (public.routing_admin());
create policy "Admins manage subscriptions" on public.org_subscriptions for all to authenticated using (public.routing_admin()) with check (public.routing_admin());
create policy "Members read own subscription" on public.org_subscriptions for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "Admins manage feature permissions" on public.org_feature_permissions for all to authenticated using (public.routing_admin()) with check (public.routing_admin());
create policy "Members read own feature permissions" on public.org_feature_permissions for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "Admins manage usage limits" on public.org_usage_limits for all to authenticated using (public.routing_admin()) with check (public.routing_admin());
create policy "Members read own usage limits" on public.org_usage_limits for select to authenticated using (public.is_company_member(auth.uid(), company_id));
create policy "Admins manage support sessions" on public.org_support_sessions for all to authenticated using (public.routing_admin()) with check (public.routing_admin());

-- Feature gate: no subscription row (legacy companies) = allowed; missing permission row = enabled default.
create or replace function public.org_feature_allowed(_company uuid, _feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.status = 'active' from public.org_subscriptions s where s.company_id = _company), true)
     and coalesce((select p.enabled from public.org_feature_permissions p where p.company_id = _company and p.feature_key = _feature), true)
$$;

-- Usage limit gate: no limits row or null limit = unlimited.
create or replace function public.org_limit_available(_company uuid, _limit text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  l public.org_usage_limits%rowtype;
  n integer;
begin
  select * into l from public.org_usage_limits where company_id = _company;
  if not found then return true; end if;
  if _limit = 'employees' then
    if l.max_employees is null then return true; end if;
    select count(*) into n from public.company_members where company_id = _company;
    return n < l.max_employees;
  end if;
  if _limit = 'leads' then
    if l.max_leads is null then return true; end if;
    select count(*) into n from public.leads where company_id = _company;
    return n < l.max_leads;
  end if;
  return true;
end $$;

-- Backend enforcement of the employee limit on every membership insert.
create or replace function public.org_employee_limit_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.org_limit_available(NEW.company_id, 'employees') then
    raise exception 'Employee limit reached for this organization';
  end if;
  return NEW;
end $$;

create trigger org_employee_limit_guard before insert on public.company_members
for each row execute function public.org_employee_limit_guard();

-- Master Admin customer management RPCs. Each verifies the actor is an active Super Admin.
create or replace function public.master_assert_admin(_actor uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(_actor, 'super_admin') then
    raise exception 'Active Super Admin authorization required';
  end if;
  if not exists (select 1 from public.profiles where id = _actor and account_status = 'active') then
    raise exception 'Active Super Admin authorization required';
  end if;
end $$;

create or replace function public.master_create_customer(_actor uuid, _user uuid, _email text, _name text, _phone text, _company text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  perform public.master_assert_admin(_actor);
  if not exists (select 1 from public.profiles where id = _user) then
    raise exception 'Customer account profile is missing';
  end if;
  insert into public.companies (name, email, phone, contact_person)
  values (_company, _email, coalesce(_phone, ''), _name)
  returning id into c;
  insert into public.company_members (company_id, user_id) values (c, _user);
  insert into public.user_roles (user_id, role) values (_user, 'client')
  on conflict (user_id, role) do nothing;
  update public.profiles
  set account_status = 'active', company_name = _company, full_name = _name, phone = coalesce(_phone, ''), updated_at = now()
  where id = _user;
  insert into public.org_subscriptions (company_id, status, term_months, starts_at, expires_at)
  values (c, 'active', 12, now(), now() + interval '1 year');
  return c;
end $$;

create or replace function public.master_set_customer_status(_actor uuid, _company uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.master_assert_admin(_actor);
  if _status not in ('active','suspended') then raise exception 'Unsupported customer status'; end if;
  insert into public.org_subscriptions (company_id, status)
  values (_company, _status)
  on conflict (company_id) do update set status = _status, updated_at = now();
  if _status = 'suspended' then
    update public.profiles set account_status = 'blocked', updated_at = now()
    where account_status = 'active'
      and id in (select user_id from public.company_members where company_id = _company);
  else
    update public.profiles set account_status = 'active', updated_at = now()
    where account_status = 'blocked'
      and id in (select user_id from public.company_members where company_id = _company);
  end if;
end $$;

create or replace function public.master_save_customer_features(_actor uuid, _company uuid, _features jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.master_assert_admin(_actor);
  delete from public.org_feature_permissions where company_id = _company;
  insert into public.org_feature_permissions (company_id, feature_key, enabled)
  select _company, key, coalesce((value #>> '{}')::boolean, true)
  from jsonb_each(_features);
end $$;

create or replace function public.master_save_customer_limits(_actor uuid, _company uuid, _limits jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.master_assert_admin(_actor);
  insert into public.org_usage_limits (company_id, max_employees, max_leads, monthly_whatsapp_messages,
    max_whatsapp_numbers, max_chatbots, max_workflows, max_drip_campaigns, max_api_requests, max_storage_mb)
  values (_company,
    nullif(_limits->>'max_employees','')::int, nullif(_limits->>'max_leads','')::int,
    nullif(_limits->>'monthly_whatsapp_messages','')::int, nullif(_limits->>'max_whatsapp_numbers','')::int,
    nullif(_limits->>'max_chatbots','')::int, nullif(_limits->>'max_workflows','')::int,
    nullif(_limits->>'max_drip_campaigns','')::int, nullif(_limits->>'max_api_requests','')::int,
    nullif(_limits->>'max_storage_mb','')::int)
  on conflict (company_id) do update set
    max_employees = excluded.max_employees, max_leads = excluded.max_leads,
    monthly_whatsapp_messages = excluded.monthly_whatsapp_messages,
    max_whatsapp_numbers = excluded.max_whatsapp_numbers, max_chatbots = excluded.max_chatbots,
    max_workflows = excluded.max_workflows, max_drip_campaigns = excluded.max_drip_campaigns,
    max_api_requests = excluded.max_api_requests, max_storage_mb = excluded.max_storage_mb,
    updated_at = now();
end $$;

create or replace function public.master_assign_plan(_actor uuid, _company uuid, _plan uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.master_assert_admin(_actor);
  if not exists (select 1 from public.plans where id = _plan and is_active) then
    raise exception 'Select an active plan';
  end if;
  insert into public.org_subscriptions (company_id, plan_id) values (_company, _plan)
  on conflict (company_id) do update set plan_id = _plan, updated_at = now();
  delete from public.org_feature_permissions where company_id = _company;
  insert into public.org_feature_permissions (company_id, feature_key, enabled)
  select _company, feature_key, enabled from public.plan_features where plan_id = _plan;
  perform public.master_save_customer_limits(_actor, _company, coalesce((select limits from public.plans where id = _plan), '{}'::jsonb));
end $$;

create or replace function public.master_save_plan(_actor uuid, _plan uuid, _name text, _description text, _limits jsonb, _features jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p uuid;
begin
  perform public.master_assert_admin(_actor);
  if _plan is null then
    insert into public.plans (name, description, limits) values (_name, coalesce(_description,''), coalesce(_limits,'{}'::jsonb))
    returning id into p;
  else
    update public.plans set name = _name, description = coalesce(_description,''), limits = coalesce(_limits,'{}'::jsonb), updated_at = now()
    where id = _plan returning id into p;
    if p is null then raise exception 'Plan not found'; end if;
    delete from public.plan_features where plan_id = p;
  end if;
  insert into public.plan_features (plan_id, feature_key, enabled)
  select p, key, coalesce((value #>> '{}')::boolean, true) from jsonb_each(coalesce(_features,'{}'::jsonb));
  return p;
end $$;

create or replace function public.master_archive_customer(_actor uuid, _company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.master_assert_admin(_actor);
  update public.companies set is_active = false where id = _company;
  perform public.master_set_customer_status(_actor, _company, 'suspended');
end $$;