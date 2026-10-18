CREATE OR REPLACE FUNCTION public.make_source_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; r public.ad_routing_rules;
BEGIN
 IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Super Admin authorization required'; END IF;
 PERFORM pg_advisory_xact_lock(84219631);
 sid:=nullif(_payload->>'id','')::uuid;
 IF _action='save' THEN
  IF length(trim(coalesce(_payload->>'name','')))=0 OR length(_payload->>'name')>120 OR coalesce(_payload->>'platform','') NOT IN ('Facebook','Instagram','Website') OR coalesce(_payload->>'account_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'page_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'form_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'campaign_id','') !~ '^([0-9]{1,40})?$' OR coalesce(_payload->>'ad_id','') !~ '^([0-9]{1,40})?$' THEN RAISE EXCEPTION 'Invalid source'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=(_payload->>'company_id')::uuid AND is_active) THEN RAISE EXCEPTION 'Active company required'; END IF;
  IF nullif(_payload->>'rule_id','') IS NOT NULL THEN
   SELECT * INTO r FROM public.ad_routing_rules WHERE id=(_payload->>'rule_id')::uuid AND status<>'deleted';
   IF NOT FOUND OR r.company_id IS DISTINCT FROM (_payload->>'company_id')::uuid OR r.account_id IS DISTINCT FROM _payload->>'account_id' OR (r.page_id<>'' AND r.page_id IS DISTINCT FROM _payload->>'page_id') OR (r.campaign_id<>'' AND r.campaign_id IS DISTINCT FROM _payload->>'campaign_id') OR (r.ad_id<>'' AND r.ad_id IS DISTINCT FROM _payload->>'ad_id') THEN RAISE EXCEPTION 'Routing rule must match the company and source'; END IF;
  END IF;
  IF sid IS NOT NULL AND EXISTS(SELECT 1 FROM public.make_lead_sources WHERE id=sid AND company_id IS DISTINCT FROM (_payload->>'company_id')::uuid) THEN RAISE EXCEPTION 'Create another source to change company'; END IF;
  IF sid IS NULL THEN INSERT INTO public.make_lead_sources(name,platform,company_id,account_id,page_id,form_id,campaign_id,ad_id) VALUES(_payload->>'name',_payload->>'platform',(_payload->>'company_id')::uuid,_payload->>'account_id',_payload->>'page_id',_payload->>'form_id',coalesce(_payload->>'campaign_id',''),coalesce(_payload->>'ad_id','')) RETURNING id INTO sid; END IF;
  UPDATE public.make_lead_sources SET name=_payload->>'name',platform=_payload->>'platform',company_id=(_payload->>'company_id')::uuid,account_id=_payload->>'account_id',page_id=_payload->>'page_id',form_id=_payload->>'form_id',campaign_id=coalesce(_payload->>'campaign_id',''),ad_id=coalesce(_payload->>'ad_id',''),rule_id=nullif(_payload->>'rule_id','')::uuid,active=coalesce((_payload->>'active')::boolean,true),updated_at=now() WHERE id=sid AND NOT archived;
 ELSIF _action IN ('enable','disable','archive') THEN UPDATE public.make_lead_sources SET active=(_action='enable'),archived=(_action='archive') OR archived,updated_at=now() WHERE id=sid AND NOT archived;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source unavailable'; END IF;
 RETURN sid;
END $$;