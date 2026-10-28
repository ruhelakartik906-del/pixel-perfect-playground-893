ALTER TABLE public.crm_installations DROP CONSTRAINT crm_installations_check1;
ALTER TABLE public.crm_installations DROP CONSTRAINT crm_installations_license_status_check;
ALTER TABLE public.crm_installations ADD CONSTRAINT crm_installations_license_status_check CHECK (license_status IN ('setup_required','pending','active','suspended'));
ALTER TABLE public.crm_installations ALTER COLUMN license_status SET DEFAULT 'pending';
ALTER TABLE public.crm_installations
 ADD COLUMN activated_at timestamptz, ADD COLUMN valid_until timestamptz,
 ADD COLUMN last_verified_at timestamptz, ADD COLUMN last_renewed_at timestamptz,
 ADD COLUMN notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
 ADD COLUMN credential_hash text CHECK (credential_hash IS NULL OR credential_hash ~ '^[0-9a-f]{64}$'),
 ADD COLUMN credential_rotated_at timestamptz;
ALTER TABLE public.crm_installations ADD CONSTRAINT crm_installations_active_dates CHECK (license_status IN ('pending','setup_required') OR (activated_at IS NOT NULL AND valid_until > activated_at));
COMMENT ON COLUMN public.crm_installations.starts_at IS 'DEPRECATED: registration placeholder; use activated_at';
COMMENT ON COLUMN public.crm_installations.expires_at IS 'DEPRECATED: placeholder; use valid_until';
COMMENT ON COLUMN public.crm_installations.configuration_verified IS 'DEPRECATED: superseded by last_verified_at';
COMMENT ON COLUMN public.crm_installations.enforcement_verified IS 'DEPRECATED: superseded by last_verified_at';
COMMENT ON COLUMN public.crm_installations.admin_provisioned IS 'DEPRECATED: customer admins live in customer backends';
REVOKE SELECT ON public.crm_installations FROM authenticated;
GRANT SELECT (id,installation_id,client_name,company_name,admin_email,admin_phone,crm_url,validity_years,starts_at,expires_at,license_status,configuration_verified,enforcement_verified,admin_provisioned,created_by,created_at,updated_at,activated_at,valid_until,last_verified_at,last_renewed_at,notes,credential_rotated_at) ON public.crm_installations TO authenticated;

CREATE TABLE public.crm_license_verify_failures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), installation_ref text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.crm_license_verify_failures TO service_role;
ALTER TABLE public.crm_license_verify_failures ENABLE ROW LEVEL SECURITY;
CREATE INDEX crm_license_verify_failures_recent ON public.crm_license_verify_failures(installation_ref, created_at);

CREATE OR REPLACE FUNCTION public.crm_installation_action(_action text, _payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.crm_installations; previous jsonb; yrs integer; target text; email text; t timestamptz := now(); h text;
BEGIN
 IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
 h := _payload->>'credential_hash';
 IF _action = 'create' THEN
  yrs := (_payload->>'validity_years')::integer;
  email := lower(trim(_payload->>'admin_email'));
  target := lower(trim(trailing '/' from trim(_payload->>'crm_url')));
  IF yrs IS NULL OR yrs NOT IN (1,2) OR coalesce(length(trim(_payload->>'client_name')),0) NOT BETWEEN 1 AND 120 OR coalesce(length(trim(_payload->>'company_name')),0) NOT BETWEEN 1 AND 160
   OR coalesce(length(email),0) > 255 OR email IS NULL OR email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   OR target IS NULL OR length(target)>500 OR length(coalesce(_payload->>'admin_phone','')) > 30
   OR length(coalesce(_payload->>'notes','')) > 2000 OR h IS NULL OR h !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid installation details'; END IF;
  INSERT INTO public.crm_installations(client_name,company_name,admin_email,admin_phone,crm_url,validity_years,starts_at,expires_at,license_status,notes,credential_hash,credential_rotated_at,created_by)
   VALUES(trim(_payload->>'client_name'),trim(_payload->>'company_name'),email,coalesce(trim(_payload->>'admin_phone'),''),target,yrs,t,t + interval '1 second','pending',coalesce(trim(_payload->>'notes'),''),h,t,auth.uid()) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.crm_installations WHERE id=(_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Installation not found'; END IF;
  previous := to_jsonb(r) - 'credential_hash';
  IF _payload ? 'expected_updated_at' AND (_payload->>'expected_updated_at')::timestamptz IS DISTINCT FROM r.updated_at THEN RAISE EXCEPTION 'License changed. Refresh and try again'; END IF;
  IF _action = 'activate' THEN
   IF r.license_status NOT IN ('pending','setup_required') THEN RAISE EXCEPTION 'Only pending licenses can be activated'; END IF;
   UPDATE public.crm_installations SET license_status='active',activated_at=t,valid_until=public.crm_license_add_years(t,validity_years),updated_at=t WHERE id=r.id RETURNING * INTO r;
  ELSIF _action = 'suspend' THEN
   IF r.license_status <> 'active' THEN RAISE EXCEPTION 'Only active licenses can be suspended'; END IF;
   UPDATE public.crm_installations SET license_status='suspended',updated_at=t WHERE id=r.id RETURNING * INTO r;
  ELSIF _action = 'resume' THEN
   IF r.license_status <> 'suspended' THEN RAISE EXCEPTION 'Only suspended licenses can be resumed'; END IF;
   IF r.valid_until <= t THEN RAISE EXCEPTION 'License expired. Renew it before resuming'; END IF;
   UPDATE public.crm_installations SET license_status='active',updated_at=t WHERE id=r.id RETURNING * INTO r;
  ELSIF _action = 'renew' THEN
   yrs := (_payload->>'validity_years')::integer;
   IF yrs IS NULL OR yrs NOT IN (1,2) THEN RAISE EXCEPTION 'Select 1 Year or 2 Years'; END IF;
   IF r.valid_until IS NULL THEN RAISE EXCEPTION 'Activate the license before renewing'; END IF;
   UPDATE public.crm_installations SET valid_until=public.crm_license_add_years(greatest(valid_until,t),yrs),validity_years=yrs,last_renewed_at=t,updated_at=t WHERE id=r.id RETURNING * INTO r;
  ELSIF _action = 'rotate' THEN
   IF h IS NULL OR h !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid credential'; END IF;
   UPDATE public.crm_installations SET credential_hash=h,credential_rotated_at=t,updated_at=t WHERE id=r.id RETURNING * INTO r;
  ELSE RAISE EXCEPTION 'Unsupported installation action'; END IF;
 END IF;
 INSERT INTO public.crm_installation_audit(installation_id,actor_id,action,before_values,after_values) VALUES(r.id,auth.uid(),_action,previous,to_jsonb(r) - 'credential_hash');
 RETURN to_jsonb(r) - 'credential_hash';
END $$;
REVOKE ALL ON FUNCTION public.crm_installation_action(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_installation_action(text,jsonb) TO authenticated;

CREATE FUNCTION public.crm_license_verify(_installation text, _hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.crm_installations; t timestamptz := clock_timestamp(); ref text := left(coalesce(_installation,''),80); st text;
BEGIN
 IF (SELECT count(*) FROM public.crm_license_verify_failures WHERE installation_ref=ref AND created_at > t - interval '10 minutes') >= 10 THEN
  RETURN jsonb_build_object('ok',false,'code','RATE_LIMITED'); END IF;
 SELECT * INTO r FROM public.crm_installations WHERE installation_id=ref;
 IF NOT FOUND OR r.credential_hash IS NULL OR _hash IS NULL OR r.credential_hash <> _hash THEN
  INSERT INTO public.crm_license_verify_failures(installation_ref,reason) VALUES(ref,'invalid_credentials');
  RETURN jsonb_build_object('ok',false,'code','INVALID_CREDENTIALS'); END IF;
 st := CASE WHEN r.license_status='active' AND r.valid_until > t THEN 'active' WHEN r.valid_until IS NOT NULL AND r.valid_until <= t THEN 'expired' WHEN r.license_status='setup_required' THEN 'pending' ELSE r.license_status END;
 IF st = 'active' THEN UPDATE public.crm_installations SET last_verified_at=t WHERE id=r.id;
 ELSE INSERT INTO public.crm_license_verify_failures(installation_ref,reason) VALUES(ref,st); END IF;
 RETURN jsonb_build_object('ok',true,'installation_id',r.installation_id,'status',st,'access_allowed',st='active','valid_until',r.valid_until,'server_time',t);
END $$;
REVOKE ALL ON FUNCTION public.crm_license_verify(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_license_verify(text,text) TO service_role;