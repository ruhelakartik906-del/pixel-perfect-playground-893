-- Allow plan creation through master_save_plan without a UUID placeholder: empty text = new plan.
create or replace function public.master_save_plan(_actor uuid, _plan text, _name text, _description text, _limits jsonb, _features jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p uuid;
  t uuid := nullif(_plan, '')::uuid;
begin
  perform public.master_assert_admin(_actor);
  if t is null then
    insert into public.plans (name, description, limits) values (_name, coalesce(_description,''), coalesce(_limits,'{}'::jsonb))
    returning id into p;
  else
    update public.plans set name = _name, description = coalesce(_description,''), limits = coalesce(_limits,'{}'::jsonb), updated_at = now()
    where id = t returning id into p;
    if p is null then raise exception 'Plan not found'; end if;
    delete from public.plan_features where plan_id = p;
  end if;
  insert into public.plan_features (plan_id, feature_key, enabled)
  select p, key, coalesce((value #>> '{}')::boolean, true) from jsonb_each(coalesce(_features,'{}'::jsonb));
  return p;
end $$;