CREATE OR REPLACE FUNCTION public.make_lead_intake(_company uuid, _account text, _payload jsonb, _dry_run boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; lid uuid; pid uuid; sid uuid; src uuid;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Intake authorization required'; END IF;
 IF _company IS NULL OR _account IS NULL OR _account !~ '^[0-9]{1,40}$' OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND is_active) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Intake company unavailable'; END IF;
 IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR length(trim(coalesce(_payload->>'name','')))=0 OR length(_payload->>'name')>200 OR length(trim(coalesce(_payload->>'phone','')))=0 OR length(_payload->>'phone')>40 OR length(coalesce(_payload->>'email',''))>255 OR length(trim(coalesce(_payload->>'source','')))=0 OR length(_payload->>'source')>120 OR coalesce(_payload->>'facebook_lead_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'page_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'form_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'campaign_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'ad_id','') !~ '^[0-9]{1,40}$' OR jsonb_typeof(_payload->'form_answers') IS DISTINCT FROM 'object' OR octet_length(_payload::text)>65536 OR _payload ?| ARRAY['company_id','assigned_to','account_id'] THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid intake payload'; END IF;
 IF _dry_run THEN RETURN jsonb_build_object('dry_run',true,'status','validated'); END IF;
 -- Use the routing engine's existing lock ordering; serialize duplicate deliveries and source assignment.
 PERFORM pg_advisory_xact_lock(84219631);
 SELECT * INTO l FROM public.leads WHERE meta_lead_id=_payload->>'facebook_lead_id';
 IF FOUND THEN
  IF l.company_id IS DISTINCT FROM _company OR l.meta_account_id IS DISTINCT FROM _account OR l.meta_page_id IS DISTINCT FROM _payload->>'page_id' OR l.meta_form_id IS DISTINCT FROM _payload->>'form_id' OR l.meta_campaign_id IS DISTINCT FROM _payload->>'campaign_id' THEN RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Lead source conflict'; END IF;
  RETURN jsonb_build_object('status','duplicate','lead_id',l.id,'routing_status',CASE WHEN l.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END);
 END IF;
 SELECT id INTO pid FROM public.crm_pipelines WHERE kind='lead' AND is_active ORDER BY is_default DESC,position,id LIMIT 1;
 SELECT id INTO sid FROM public.crm_stages WHERE pipeline_id=pid AND kind='lead' AND is_active ORDER BY position,id LIMIT 1;
 SELECT id INTO src FROM public.crm_options WHERE category='source' AND is_active AND lower(name)=lower(_payload->>'source') ORDER BY id LIMIT 1;
 INSERT INTO public.leads(company_id,pipeline_id,stage_id,source_id,customer_name,phone,email,form_answers,meta_account_id,meta_page_id,meta_form_id,meta_campaign_id,meta_ad_id,meta_adset_id,meta_creative_id,meta_lead_id)
 VALUES(_company,pid,sid,src,_payload->>'name',_payload->>'phone',coalesce(_payload->>'email',''),(_payload->'form_answers') || jsonb_build_object('_intake_source',_payload->>'source'),_account,_payload->>'page_id',_payload->>'form_id',_payload->>'campaign_id',_payload->>'ad_id',nullif(_payload->>'adset_id',''),nullif(_payload->>'creative_id',''),_payload->>'facebook_lead_id')
 ON CONFLICT(meta_lead_id) DO NOTHING RETURNING id INTO lid;
 IF lid IS NULL THEN
  SELECT * INTO l FROM public.leads WHERE meta_lead_id=_payload->>'facebook_lead_id';
  IF l.company_id IS DISTINCT FROM _company OR l.meta_account_id IS DISTINCT FROM _account OR l.meta_page_id IS DISTINCT FROM _payload->>'page_id' OR l.meta_form_id IS DISTINCT FROM _payload->>'form_id' OR l.meta_campaign_id IS DISTINCT FROM _payload->>'campaign_id' THEN RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Lead source conflict'; END IF;
  RETURN jsonb_build_object('status','duplicate','lead_id',l.id,'routing_status',CASE WHEN l.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END);
 END IF;
 -- AFTER INSERT already applies routing, quotas, overflow, events and queue in this transaction.
 SELECT * INTO l FROM public.leads WHERE id=lid;
 RETURN jsonb_build_object('status','created','lead_id',lid,'routing_status',CASE WHEN l.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END);
END $$;
REVOKE ALL ON FUNCTION public.make_lead_intake(uuid,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.make_lead_intake(uuid,text,jsonb,boolean) TO service_role;
COMMENT ON FUNCTION public.make_lead_intake(uuid,text,jsonb,boolean) IS 'Service-only Make intake; trusted server source bindings, canonical leads and transactional existing routing. dry_run never writes.';