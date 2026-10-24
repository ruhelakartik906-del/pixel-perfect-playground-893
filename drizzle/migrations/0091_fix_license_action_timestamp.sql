CREATE OR REPLACE FUNCTION public.crm_installation_action(_action text, _payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.crm_installations; previous jsonb; yrs integer; target text; email text; action_time timestamptz := now();
BEGIN
 IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
 IF _action = 'create' THEN
  yrs := (_payload->>'validity_years')::integer;
  email := lower(trim(_payload->>'admin_email'));
  target := lower(trim(trailing '/' from trim(_payload->>'crm_url')));
  IF yrs NOT IN (1,2) OR yrs IS NULL OR coalesce(length(trim(_payload->>'client_name')),0) NOT BETWEEN 1 AND 120 OR coalesce(length(trim(_payload->>'company_name')),0) NOT BETWEEN 1 AND 160
   OR coalesce(length(email),0) > 255 OR email IS NULL OR email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   OR target IS NULL OR length(target)>500 OR target !~ '^https://[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:443)?$'
   OR length(coalesce(_payload->>'admin_phone','')) > 30 THEN RAISE EXCEPTION 'Invalid installation details'; END IF;
  INSERT INTO public.crm_installations(client_name,company_name,admin_email,admin_phone,crm_url,validity_years,starts_at,expires_at,created_by)
   VALUES(trim(_payload->>'client_name'),trim(_payload->>'company_name'),email,coalesce(trim(_payload->>'admin_phone'),''),target,yrs,action_time,public.crm_license_add_years(action_time,yrs),auth.uid()) RETURNING * INTO r;
 ELSIF _action IN ('extend','activate','suspend','reset') THEN
  SELECT * INTO r FROM public.crm_installations WHERE id=(_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Installation not found'; END IF;
  previous := to_jsonb(r);
  IF _action = 'extend' THEN
   yrs := (_payload->>'validity_years')::integer;
   IF yrs IS NULL OR yrs NOT IN (1,2) THEN RAISE EXCEPTION 'Select 1 Year or 2 Years'; END IF;
   IF (_payload->>'expected_expiry')::timestamptz IS DISTINCT FROM r.expires_at THEN RAISE EXCEPTION 'License changed. Refresh before extending'; END IF;
   UPDATE public.crm_installations SET expires_at=public.crm_license_add_years(greatest(expires_at,action_time),yrs),validity_years=yrs,updated_at=action_time WHERE id=r.id RETURNING * INTO r;
  ELSE
   RAISE EXCEPTION 'Setup Required: independent installation provisioning and server-side license enforcement are not configured';
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported installation action'; END IF;
 INSERT INTO public.crm_installation_audit(installation_id,actor_id,action,before_values,after_values) VALUES(r.id,auth.uid(),_action,previous,to_jsonb(r));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.crm_installation_action(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_installation_action(text,jsonb) TO authenticated;