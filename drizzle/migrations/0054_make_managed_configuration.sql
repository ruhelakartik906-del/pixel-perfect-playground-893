CREATE TABLE public.make_api_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),label text NOT NULL,key_hash text NOT NULL UNIQUE CHECK(key_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),last_used_at timestamptz,revoked_at timestamptz,created_by uuid);
GRANT ALL ON public.make_api_keys TO service_role;
ALTER TABLE public.make_api_keys ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.make_lead_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,platform text NOT NULL CHECK(platform IN ('Facebook','Instagram','Website')),company_id uuid NOT NULL REFERENCES public.companies(id),account_id text NOT NULL,page_id text NOT NULL,form_id text NOT NULL,campaign_id text NOT NULL DEFAULT '',ad_id text NOT NULL DEFAULT '',rule_id uuid REFERENCES public.ad_routing_rules(id),active boolean NOT NULL DEFAULT true,archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.make_lead_sources TO authenticated; GRANT ALL ON public.make_lead_sources TO service_role;
ALTER TABLE public.make_lead_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY make_sources_admin ON public.make_lead_sources FOR SELECT TO authenticated USING(public.routing_admin());
CREATE UNIQUE INDEX make_source_mapping ON public.make_lead_sources(page_id,form_id,campaign_id,ad_id);
CREATE TABLE public.make_intake_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),key_id uuid REFERENCES public.make_api_keys(id),source_id uuid REFERENCES public.make_lead_sources(id),status text NOT NULL CHECK(status IN ('created','duplicate','validated','rejected','error')),http_status integer NOT NULL,code text NOT NULL,lead_id uuid REFERENCES public.leads(id),is_test boolean NOT NULL DEFAULT false);
GRANT ALL ON public.make_intake_logs TO service_role;
ALTER TABLE public.make_intake_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX make_logs_date ON public.make_intake_logs(created_at DESC);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS intake_source_id uuid REFERENCES public.make_lead_sources(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS intake_external_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS intake_rule_id uuid REFERENCES public.ad_routing_rules(id);
CREATE UNIQUE INDEX make_source_lead_id ON public.leads(intake_source_id,intake_external_id) WHERE intake_source_id IS NOT NULL;
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
  IF sid IS NULL THEN INSERT INTO public.make_lead_sources(name,platform,company_id,account_id,page_id,form_id) VALUES(_payload->>'name',_payload->>'platform',(_payload->>'company_id')::uuid,_payload->>'account_id',_payload->>'page_id',_payload->>'form_id') RETURNING id INTO sid; END IF;
  UPDATE public.make_lead_sources SET name=_payload->>'name',platform=_payload->>'platform',company_id=(_payload->>'company_id')::uuid,account_id=_payload->>'account_id',page_id=_payload->>'page_id',form_id=_payload->>'form_id',campaign_id=coalesce(_payload->>'campaign_id',''),ad_id=coalesce(_payload->>'ad_id',''),rule_id=nullif(_payload->>'rule_id','')::uuid,active=coalesce((_payload->>'active')::boolean,true),updated_at=now() WHERE id=sid AND NOT archived;
 ELSIF _action IN ('enable','disable','archive') THEN UPDATE public.make_lead_sources SET active=(_action='enable'),archived=(_action='archive') OR archived,updated_at=now() WHERE id=sid AND NOT archived;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source unavailable'; END IF;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.make_source_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.make_source_action(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.route_lead(_lead uuid,_manual_user uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; r public.ad_routing_rules; s public.ad_routing_steps; target uuid; why text; typ text;
BEGIN
 IF NOT public.routing_admin() AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Routing authorization required'; END IF;
 PERFORM pg_advisory_xact_lock(84219631);
 SELECT * INTO l FROM public.leads WHERE id=_lead FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead unavailable'; END IF;
 IF l.assigned_to IS NOT NULL THEN RETURN jsonb_build_object('status','already_assigned','user_id',l.assigned_to); END IF;
 IF EXISTS(SELECT 1 FROM public.lead_assignment_events WHERE lead_id=l.id) THEN RETURN jsonb_build_object('status','previously_assigned'); END IF;
 IF l.company_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=l.company_id AND is_active) THEN why:='Missing or inactive company';
 ELSIF _manual_user IS NOT NULL THEN
  IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Manual assignment requires Super Admin'; END IF;
  IF NOT public.routing_eligible(_manual_user,l.company_id) THEN RAISE EXCEPTION 'User is blocked, inactive or unauthorized for this company'; END IF;
  target:=_manual_user; typ:='manual';
 ELSE
  SELECT * INTO r FROM public.ad_routing_rules WHERE status='active' AND (l.intake_rule_id IS NULL OR id=l.intake_rule_id) AND company_id=l.company_id AND account_id=l.meta_account_id AND (page_id='' OR page_id=l.meta_page_id) AND (campaign_id='' OR campaign_id=l.meta_campaign_id) AND (adset_id='' OR adset_id=l.meta_adset_id) AND (ad_id='' OR ad_id=l.meta_ad_id) AND (creative_id='' OR creative_id=l.meta_creative_id) ORDER BY CASE WHEN creative_id<>'' THEN 4 WHEN ad_id<>'' THEN 3 WHEN campaign_id<>'' THEN 2 ELSE 1 END DESC,created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN why:='No matching active rule'; ELSE
   SELECT * INTO s FROM public.ad_routing_steps WHERE rule_id=r.id AND (quota IS NULL OR assigned_count<quota) AND public.routing_eligible(user_id,l.company_id) ORDER BY position LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN why:='Quotas exhausted or no eligible active users'; ELSE target:=s.user_id;typ:='automatic'; END IF;
  END IF;
 END IF;
 IF target IS NULL THEN INSERT INTO public.lead_routing_queue(lead_id,reason) VALUES(l.id,why) ON CONFLICT(lead_id) DO UPDATE SET reason=excluded.reason,updated_at=now(); RETURN jsonb_build_object('status','unassigned','reason',why); END IF;
 UPDATE public.leads SET assigned_to=target WHERE id=l.id;
 IF typ='automatic' THEN UPDATE public.ad_routing_steps SET assigned_count=assigned_count+1 WHERE id=s.id; UPDATE public.ad_routing_rules SET total_leads=total_leads+1 WHERE id=r.id; END IF;
 INSERT INTO public.lead_assignment_events(lead_id,company_id,rule_id,user_id,assignment_type,snapshot,actor_id) VALUES(l.id,l.company_id,r.id,target,typ,jsonb_build_object('lead',to_jsonb(l),'rule_name',r.name,'user_name',(SELECT coalesce(nullif(full_name,''),email) FROM public.profiles WHERE id=target),'company_name',(SELECT name FROM public.companies WHERE id=l.company_id)),auth.uid());
 DELETE FROM public.lead_routing_queue WHERE lead_id=l.id;
 RETURN jsonb_build_object('status','assigned','user_id',target);
END $$;
CREATE OR REPLACE FUNCTION public.make_lead_intake(_company uuid, _account text, _payload jsonb, _dry_run boolean, _source uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; lid uuid; pid uuid; sid uuid; src uuid;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Intake authorization required'; END IF;
 PERFORM pg_advisory_xact_lock(84219631);
 IF _company IS NULL OR _account IS NULL OR _account !~ '^[0-9]{1,40}$' OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND is_active) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Intake company unavailable'; END IF;
 IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR length(trim(coalesce(_payload->>'name','')))=0 OR length(_payload->>'name')>200 OR length(trim(coalesce(_payload->>'phone','')))=0 OR length(_payload->>'phone')>40 OR length(coalesce(_payload->>'email',''))>255 OR length(trim(coalesce(_payload->>'source','')))=0 OR length(_payload->>'source')>120 OR coalesce(_payload->>'facebook_lead_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'page_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'form_id','') !~ '^[0-9]{1,40}$' OR coalesce(_payload->>'campaign_id','') !~ '^([0-9]{1,40})?$' OR coalesce(_payload->>'ad_id','') !~ '^([0-9]{1,40})?$' OR jsonb_typeof(_payload->'form_answers') IS DISTINCT FROM 'object' OR octet_length(_payload::text)>65536 OR _payload ?| ARRAY['company_id','assigned_to','account_id'] THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid intake payload'; END IF;
 IF _source IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.make_lead_sources WHERE id=_source AND active AND NOT archived AND company_id=_company AND account_id=_account AND page_id=_payload->>'page_id' AND form_id=_payload->>'form_id' AND (campaign_id='' OR campaign_id=_payload->>'campaign_id') AND (ad_id='' OR ad_id=_payload->>'ad_id')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Source unavailable'; END IF;
 IF _dry_run THEN RETURN jsonb_build_object('dry_run',true,'status','validated'); END IF;
 SELECT * INTO l FROM public.leads WHERE (_source IS NOT NULL AND intake_source_id=_source AND intake_external_id=_payload->>'facebook_lead_id') OR (meta_lead_id=_payload->>'facebook_lead_id' AND intake_source_id IS NULL);
 IF FOUND THEN
  IF l.company_id IS DISTINCT FROM _company OR l.meta_account_id IS DISTINCT FROM _account OR l.meta_page_id IS DISTINCT FROM _payload->>'page_id' OR l.meta_form_id IS DISTINCT FROM _payload->>'form_id' OR l.meta_campaign_id IS DISTINCT FROM _payload->>'campaign_id' THEN RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Lead source conflict'; END IF;
  RETURN jsonb_build_object('status','duplicate','lead_id',l.id,'routing_status',CASE WHEN l.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END);
 END IF;
 SELECT id INTO pid FROM public.crm_pipelines WHERE kind='lead' AND is_active ORDER BY is_default DESC,position,id LIMIT 1;
 SELECT id INTO sid FROM public.crm_stages WHERE pipeline_id=pid AND kind='lead' AND is_active ORDER BY position,id LIMIT 1;
 SELECT id INTO src FROM public.crm_options WHERE category='source' AND is_active AND lower(name)=lower(_payload->>'source') ORDER BY id LIMIT 1;
 INSERT INTO public.leads(company_id,pipeline_id,stage_id,source_id,customer_name,phone,email,form_answers,intake_source,meta_account_id,meta_page_id,meta_form_id,meta_campaign_id,meta_ad_id,meta_adset_id,meta_creative_id,meta_lead_id,intake_source_id,intake_external_id,intake_rule_id)
 VALUES(_company,pid,sid,src,_payload->>'name',_payload->>'phone',coalesce(_payload->>'email',''),_payload->'form_answers',_payload->>'source',_account,_payload->>'page_id',_payload->>'form_id',_payload->>'campaign_id',_payload->>'ad_id',nullif(_payload->>'adset_id',''),nullif(_payload->>'creative_id',''),CASE WHEN _source IS NULL THEN _payload->>'facebook_lead_id' ELSE NULL END,_source,_payload->>'facebook_lead_id',(SELECT rule_id FROM public.make_lead_sources WHERE id=_source))
 ON CONFLICT DO NOTHING RETURNING id INTO lid;
 IF lid IS NULL THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Lead source conflict'; END IF;
 SELECT * INTO l FROM public.leads WHERE id=lid;
 RETURN jsonb_build_object('status','created','lead_id',lid,'routing_status',CASE WHEN l.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END);
END $$;
REVOKE ALL ON FUNCTION public.make_lead_intake(uuid,text,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.make_lead_intake(uuid,text,jsonb,boolean,uuid) TO service_role;