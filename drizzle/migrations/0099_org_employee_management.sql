-- Stage 3: Customer Admin employee management.
-- Audit trail for organization employee actions.
create table public.org_employee_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid not null,
  employee_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.org_employee_audit to authenticated;
grant all on public.org_employee_audit to service_role;

alter table public.org_employee_audit enable row level security;

create policy "Members read own employee audit" on public.org_employee_audit
  for select to authenticated using (public.is_company_member(auth.uid(), company_id));

-- Customer Admin = active account with client role and membership in the company.
create or replace function public.org_customer_admin(_user uuid, _company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    join public.user_roles ur on ur.user_id = cm.user_id
    where cm.user_id = _user and cm.company_id = _company
      and p.account_status = 'active' and ur.role = 'client'
  )
$$;

-- Employee management actions, authorized per call. The employee limit is enforced
-- by the existing org_employee_limit_guard trigger on company_members inserts.
create or replace function public.org_employee_action(_action text, _payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  company uuid := nullif(_payload->>'company_id','')::uuid;
  target uuid := nullif(_payload->>'user_id','')::uuid;
  new_id uuid;
begin
  if actor is null or company is null or not public.org_customer_admin(actor, company) then
    raise exception 'Customer Admin authorization required';
  end if;
  if _action = 'attach' then
    -- Attach a freshly created auth user as an employee of this organization.
    if target is null then raise exception 'Employee account is required'; end if;
    insert into public.company_members (company_id, user_id) values (company, target);
    insert into public.user_roles (user_id, role) values (target, 'employee') on conflict do nothing;
    new_id := target;
  elsif _action = 'update' then
    if not exists (select 1 from public.company_members where company_id = company and user_id = target) then
      raise exception 'Employee not found in this organization';
    end if;
    update public.profiles set
      full_name = left(coalesce(nullif(_payload->>'full_name',''), full_name), 120),
      phone = left(coalesce(_payload->>'phone', phone), 40),
      updated_at = now()
    where id = target;
    new_id := target;
  elsif _action = 'set_status' then
    if not exists (select 1 from public.company_members where company_id = company and user_id = target) then
      raise exception 'Employee not found in this organization';
    end if;
    if target = actor then raise exception 'You cannot change your own account status'; end if;
    if _payload->>'status' not in ('active','blocked') then raise exception 'Invalid status'; end if;
    update public.profiles set account_status = (_payload->>'status')::public.account_status, updated_at = now() where id = target;
    new_id := target;
  elsif _action = 'remove' then
    if target = actor then raise exception 'You cannot remove your own account'; end if;
    if not exists (select 1 from public.company_members where company_id = company and user_id = target) then
      raise exception 'Employee not found in this organization';
    end if;
    delete from public.user_access_roles where user_id = target;
    delete from public.user_roles where user_id = target and role = 'employee';
    delete from public.company_members where company_id = company and user_id = target;
    new_id := target;
  elsif _action = 'assign_role' then
    if not exists (select 1 from public.company_members where company_id = company and user_id = target) then
      raise exception 'Employee not found in this organization';
    end if;
    delete from public.user_access_roles where user_id = target;
    if nullif(_payload->>'access_role','') is not null then
      insert into public.user_access_roles (user_id, role_id) values (target, (_payload->>'access_role')::uuid);
    end if;
    new_id := target;
  else
    raise exception 'Unknown employee action';
  end if;
  insert into public.org_employee_audit (company_id, actor_id, employee_id, action, detail)
  values (company, actor, new_id, _action, _payload - 'password');
  return new_id;
end $$;