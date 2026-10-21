CREATE OR REPLACE FUNCTION public.manual_routing_eligible(_user uuid,_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_user AND p.account_status='active' AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('client','employee','manager','super_admin')) AND (_company IS NULL OR EXISTS(SELECT 1 FROM public.company_members m JOIN public.companies c ON c.id=m.company_id WHERE m.user_id=p.id AND c.id=_company AND c.is_active AND (public.has_role(p.id,'client') OR public.routing_eligible(p.id,c.id))))) $$;
REVOKE ALL ON FUNCTION public.manual_routing_eligible(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manual_routing_eligible(uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.manual_routing_recipients() RETURNS TABLE(user_id uuid,company_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT coalesce(public.routing_admin(),false) THEN RAISE EXCEPTION 'Super Admin authorization required'; END IF;
RETURN QUERY SELECT p.id,NULL::uuid FROM public.profiles p WHERE public.manual_routing_eligible(p.id,NULL) UNION SELECT m.user_id,m.company_id FROM public.company_members m WHERE public.manual_routing_eligible(m.user_id,m.company_id);
END $$;
REVOKE ALL ON FUNCTION public.manual_routing_recipients() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manual_routing_recipients() TO authenticated;
CREATE OR REPLACE FUNCTION public.lead_record_allowed(_company uuid,_creator uuid,_assignee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.lead_workspace_active() AND _assignee=auth.uid() AND ((_company IS NULL AND (_creator=auth.uid() OR EXISTS(SELECT 1 FROM public.leads l WHERE l.company_id IS NULL AND l.created_by=_creator AND l.assigned_to=auth.uid() AND l.private_owner_id=auth.uid()))) OR (_company IS NOT NULL AND public.user_crm_company(_company))) $$;
ALTER POLICY private_lead_boundary ON public.leads USING(private_owner_id IS NULL OR (private_owner_id=auth.uid() AND public.lead_workspace_active()) OR (public.routing_admin() AND intake_source='manual' AND created_by IS DISTINCT FROM private_owner_id)) WITH CHECK(private_owner_id IS NULL OR (private_owner_id=auth.uid() AND public.lead_workspace_active()) OR (public.routing_admin() AND intake_source='manual' AND created_by IS DISTINCT FROM private_owner_id));
DO $migration$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.lead_company_stage_guard()'::regprocedure) INTO definition;
definition:=replace(definition,'owner_id IS DISTINCT FROM NEW.created_by','owner_id IS DISTINCT FROM coalesce(NEW.private_owner_id,NEW.created_by)');
definition:=replace(definition,'owner_id=NEW.created_by','owner_id=coalesce(NEW.private_owner_id,NEW.created_by)'); EXECUTE definition;
SELECT pg_get_functiondef('public.lead_personal_status_action(text,jsonb)'::regprocedure) INTO definition;
EXECUTE replace(definition,'public.leads WHERE company_id IS NULL AND created_by=cid','public.leads WHERE company_id IS NULL AND coalesce(private_owner_id,created_by)=cid');
END $migration$;
CREATE OR REPLACE FUNCTION public.manual_routing_lead_create(_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid:=nullif(_payload->>'company_id','')::uuid; target uuid:=nullif(_payload->>'assign_user','')::uuid; request uuid:=(_payload->>'request_id')::uuid; l public.leads; s public.crm_stages; phone text:=trim(_payload->>'country_code')||trim(_payload->>'mobile'); request_key text;
BEGIN
IF auth.uid() IS NULL OR NOT coalesce(public.routing_admin(),false) THEN RAISE EXCEPTION 'Super Admin authorization required'; END IF;
IF request IS NULL OR length(trim(coalesce(_payload->>'customer_name',''))) NOT BETWEEN 1 AND 200 OR coalesce(phone,'') !~ '^\+[1-9][0-9]{6,14}$' THEN RAISE EXCEPTION 'Client name and valid phone are required'; END IF;
IF coalesce(_payload->>'priority','') NOT IN ('low','medium','high') OR coalesce(_payload->>'service','') NOT IN ('Meta Ads','Google Ads','Website','SEO','Social Media Marketing','Other') THEN RAISE EXCEPTION 'Invalid lead options'; END IF;
IF length(coalesce(_payload->>'notes',''))>2000 OR length(coalesce(_payload->>'address',''))>2000 OR length(coalesce(_payload->>'email',''))>255 OR length(trim(coalesce(_payload->>'source',''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid lead details'; END IF;
request_key:='admin-manual:'||auth.uid()::text||':'||request::text;
PERFORM pg_advisory_xact_lock(hashtextextended('manual-routing-create',0));
SELECT * INTO l FROM public.leads WHERE intake_source='manual' AND intake_external_id=request_key;
IF FOUND THEN RETURN jsonb_build_object('id',l.id,'assigned',l.assigned_to IS NOT NULL); END IF;
IF cid IS NOT NULL THEN PERFORM 1 FROM public.companies WHERE id=cid AND is_active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Select an active company'; END IF; END IF;
IF target IS NOT NULL THEN
PERFORM 1 FROM public.profiles WHERE id=target AND account_status='active' FOR SHARE;
IF NOT FOUND OR NOT public.manual_routing_eligible(target,cid) THEN RAISE EXCEPTION 'User is pending, blocked or unauthorized for this workspace'; END IF;
END IF;
IF EXISTS(SELECT 1 FROM public.leads WHERE intake_source='manual' AND phone=manual_routing_lead_create.phone AND company_id IS NOT DISTINCT FROM cid AND (cid IS NOT NULL OR private_owner_id IS NOT DISTINCT FROM target) AND created_at>=now()-interval '5 minutes') THEN RAISE EXCEPTION 'A lead with this phone number was just created for this workspace'; END IF;
SELECT st.* INTO s FROM public.crm_stages st JOIN public.crm_pipelines p ON p.id=st.pipeline_id WHERE p.is_active AND st.kind='lead' AND st.is_active AND st.board_initial AND st.owner_id IS NULL AND (st.company_id IS NULL OR st.company_id=cid) ORDER BY st.position,st.id LIMIT 1;
IF NOT FOUND THEN RAISE EXCEPTION 'No active initial lead stage available'; END IF;
INSERT INTO public.leads(company_id,private_owner_id,assigned_to,created_by,pipeline_id,stage_id,customer_name,phone,email,business_name,business_category,requirements,interest_level,region,status,intake_source,intake_external_id,form_answers)
VALUES(cid,CASE WHEN cid IS NULL THEN target END,target,auth.uid(),s.pipeline_id,s.id,trim(_payload->>'customer_name'),phone,coalesce(_payload->>'email',''),coalesce(_payload->>'business_name',''),coalesce(_payload->>'business_category',''),coalesce(_payload->>'notes',''),_payload->>'priority',concat_ws(', ',nullif(_payload->>'city',''),nullif(_payload->>'state','')),'open','manual',request_key,jsonb_build_object('Lead Source',_payload->>'source','Required Service',_payload->>'service','Priority',_payload->>'priority','Address',_payload->>'address','City',_payload->>'city','State',_payload->>'state')) RETURNING * INTO l;
IF target IS NULL THEN INSERT INTO public.lead_routing_queue(lead_id,reason) VALUES(l.id,'Manual lead awaiting assignment');
ELSE INSERT INTO public.lead_assignment_events(lead_id,company_id,user_id,assignment_type,snapshot,actor_id) VALUES(l.id,cid,target,'manual',jsonb_build_object('lead',to_jsonb(l),'user_name',(SELECT coalesce(nullif(full_name,''),email) FROM public.profiles WHERE id=target),'company_name',(SELECT name FROM public.companies WHERE id=cid),'rule_name',NULL),auth.uid()); END IF;
RETURN jsonb_build_object('id',l.id,'assigned',target IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.manual_routing_lead_create(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manual_routing_lead_create(jsonb) TO authenticated;