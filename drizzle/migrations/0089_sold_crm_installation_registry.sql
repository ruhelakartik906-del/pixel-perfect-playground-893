CREATE TABLE public.crm_installations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 installation_id text NOT NULL UNIQUE DEFAULT ('RCRM-' || upper(replace(gen_random_uuid()::text,'-',''))),
 client_name text NOT NULL, company_name text NOT NULL, admin_email text NOT NULL, admin_phone text NOT NULL DEFAULT '',
 crm_url text NOT NULL UNIQUE, validity_years integer NOT NULL DEFAULT 1 CHECK (validity_years IN (1,2)),
 starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 license_status text NOT NULL DEFAULT 'setup_required' CHECK (license_status IN ('setup_required','active','suspended')),
 configuration_verified boolean NOT NULL DEFAULT false, enforcement_verified boolean NOT NULL DEFAULT false,
 admin_provisioned boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (expires_at > starts_at),
 CHECK (license_status = 'setup_required' OR (configuration_verified AND enforcement_verified AND admin_provisioned))
);
GRANT SELECT ON public.crm_installations TO authenticated;
GRANT ALL ON public.crm_installations TO service_role;
ALTER TABLE public.crm_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_installations_admin_read ON public.crm_installations FOR SELECT TO authenticated USING (public.routing_admin());
CREATE UNIQUE INDEX crm_installations_email_unique ON public.crm_installations(lower(admin_email));
CREATE INDEX crm_installations_expiry ON public.crm_installations(expires_at);
CREATE TABLE public.crm_installation_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), installation_id uuid NOT NULL REFERENCES public.crm_installations(id),
 actor_id uuid NOT NULL, action text NOT NULL, before_values jsonb, after_values jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_installation_audit TO authenticated;
GRANT ALL ON public.crm_installation_audit TO service_role;
ALTER TABLE public.crm_installation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_installation_audit_admin_read ON public.crm_installation_audit FOR SELECT TO authenticated USING (public.routing_admin());
CREATE FUNCTION public.crm_license_add_years(_start timestamptz, _years integer) RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT ((_start AT TIME ZONE 'Asia/Kolkata') + make_interval(years => _years)) AT TIME ZONE 'Asia/Kolkata' $$;
REVOKE ALL ON FUNCTION public.crm_license_add_years(timestamptz,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_license_add_years(timestamptz,integer) TO service_role;
CREATE FUNCTION public.crm_installation_action(_action text, _payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.crm_installations; previous jsonb; yrs integer; target text; email text; current_time timestamptz := now();
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
   VALUES(trim(_payload->>'client_name'),trim(_payload->>'company_name'),email,coalesce(trim(_payload->>'admin_phone'),''),target,yrs,current_time,public.crm_license_add_years(current_time,yrs),auth.uid()) RETURNING * INTO r;
 ELSIF _action IN ('extend','activate','suspend','reset') THEN
  SELECT * INTO r FROM public.crm_installations WHERE id=(_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Installation not found'; END IF;
  previous := to_jsonb(r);
  IF _action = 'extend' THEN
   yrs := (_payload->>'validity_years')::integer;
   IF yrs IS NULL OR yrs NOT IN (1,2) THEN RAISE EXCEPTION 'Select 1 Year or 2 Years'; END IF;
   IF (_payload->>'expected_expiry')::timestamptz IS DISTINCT FROM r.expires_at THEN RAISE EXCEPTION 'License changed. Refresh before extending'; END IF;
   UPDATE public.crm_installations SET expires_at=public.crm_license_add_years(greatest(expires_at,current_time),yrs),validity_years=yrs,updated_at=current_time WHERE id=r.id RETURNING * INTO r;
  ELSE
   -- No independent customer connector has been configured. Never change a label as a substitute for remote enforcement or send an invitation from this database.
   RAISE EXCEPTION 'Setup Required: independent installation provisioning and server-side license enforcement are not configured';
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported installation action'; END IF;
 INSERT INTO public.crm_installation_audit(installation_id,actor_id,action,before_values,after_values) VALUES(r.id,auth.uid(),_action,previous,to_jsonb(r));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.crm_installation_action(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_installation_action(text,jsonb) TO authenticated;
CREATE FUNCTION public.crm_installation_license_state(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('installation_id',installation_id,'valid_until',expires_at,'status',CASE WHEN expires_at<=now() THEN 'expired' ELSE license_status END,'access_allowed',configuration_verified AND enforcement_verified AND admin_provisioned AND license_status='active' AND starts_at<=now() AND expires_at>now()) FROM public.crm_installations WHERE id=_id
$$;
REVOKE ALL ON FUNCTION public.crm_installation_license_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_installation_license_state(uuid) TO service_role;