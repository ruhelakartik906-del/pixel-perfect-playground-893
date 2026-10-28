CREATE OR REPLACE FUNCTION public.crm_license_verify(_installation text, _hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.crm_installations; t timestamptz := clock_timestamp(); ref text := left(coalesce(_installation,''),80); st text;
BEGIN
 IF (SELECT count(*) FROM public.crm_license_verify_failures WHERE installation_ref=ref AND reason='invalid_credentials' AND created_at > t - interval '10 minutes') >= 10 THEN
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