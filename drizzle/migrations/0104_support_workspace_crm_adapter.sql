CREATE OR REPLACE FUNCTION public.support_workspace_crm(_session uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions; actor uuid; r jsonb; enabled boolean;
BEGIN
 s:=public.support_session_require(_session,false);
 IF s.id IS NULL THEN RETURN jsonb_build_object('error','Support session expired'); END IF;
 IF NOT public.license_active() OR NOT public.org_feature_allowed(s.company_id,'leads') THEN RAISE EXCEPTION 'Customer CRM access unavailable'; END IF;
 SELECT m.user_id INTO actor FROM public.company_members m JOIN public.profiles p ON p.id=m.user_id JOIN public.user_roles ur ON ur.user_id=m.user_id AND ur.role='client' WHERE m.company_id=s.company_id AND p.account_status='active' ORDER BY m.created_at,m.user_id LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Active customer administrator not found'; END IF;
 -- Project the customer's canonical company records, never private personal/ad-owned records.
 SELECT jsonb_build_object(
 'profile',(SELECT jsonb_build_object('id',id,'full_name',full_name,'email',email,'account_status',account_status) FROM public.profiles WHERE id=actor),
 'roles',jsonb_build_array('client'),'userId',actor,'allowed',true,
 'companies',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active)),'[]'::jsonb) FROM public.companies WHERE id=s.company_id),
 'leads',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC),'[]'::jsonb) FROM public.leads l WHERE l.company_id=s.company_id AND l.assigned_to=actor AND l.private_owner_id IS NULL),
 'deals',CASE WHEN public.org_feature_allowed(s.company_id,'deals') THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'status',d.status,'created_at',d.created_at,'company_id',d.company_id)),'[]'::jsonb) FROM public.deals d WHERE d.company_id=s.company_id AND d.assigned_to=actor AND d.deleted_at IS NULL) ELSE '[]'::jsonb END,
 'work','[]'::jsonb,
 'stages',(SELECT coalesce(jsonb_agg(to_jsonb(st) ORDER BY st.position),'[]'::jsonb) FROM public.crm_stages st WHERE st.kind='lead' AND st.company_id=s.company_id AND st.owner_id IS NULL),
 'sources',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active)),'[]'::jsonb) FROM public.crm_options WHERE category='source'),
 'companyStages',jsonb_build_array(jsonb_build_object('company_id',s.company_id,'stages',coalesce((SELECT jsonb_agg(to_jsonb(st) ORDER BY st.position) FROM public.crm_stages st WHERE st.kind='lead' AND st.company_id=s.company_id AND st.owner_id IS NULL),'[]'::jsonb))),
 'personalStages','[]'::jsonb,
 'activities',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]'::jsonb) FROM public.lead_activities a JOIN public.leads l ON l.id=a.lead_id WHERE l.company_id=s.company_id AND l.assigned_to=actor AND l.private_owner_id IS NULL),
 'features',coalesce((SELECT jsonb_object_agg(feature_key,enabled) FROM public.org_feature_permissions WHERE company_id=s.company_id),'{}'::jsonb),
 'session',to_jsonb(s),'companyName',(SELECT name FROM public.companies WHERE id=s.company_id)) INTO r;
 PERFORM public.support_audit(s,'view.crm_workspace',NULL,'{}'::jsonb);
 RETURN jsonb_build_object('data',r);
END $$;
REVOKE ALL ON FUNCTION public.support_workspace_crm(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_workspace_crm(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.support_workspace_lead_action(_session uuid,_lead uuid,_updated_at timestamptz,_details jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions; l public.leads; actor uuid;
BEGIN
 s:=public.support_session_require(_session,true);
 IF s.id IS NULL THEN RETURN jsonb_build_object('error','Not allowed: expired session or View Only'); END IF;
 IF NOT public.license_active() OR NOT public.org_feature_allowed(s.company_id,'leads') THEN RAISE EXCEPTION 'Customer leads feature unavailable'; END IF;
 SELECT m.user_id INTO actor FROM public.company_members m JOIN public.profiles p ON p.id=m.user_id AND p.account_status='active' JOIN public.user_roles ur ON ur.user_id=m.user_id AND ur.role='client' WHERE m.company_id=s.company_id ORDER BY m.created_at,m.user_id LIMIT 1;
 SELECT * INTO l FROM public.leads WHERE id=_lead AND company_id=s.company_id AND assigned_to=actor AND private_owner_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not available in this customer workspace'; END IF;
 IF l.updated_at IS DISTINCT FROM _updated_at THEN RAISE EXCEPTION 'Lead changed; refresh before saving'; END IF;
 IF jsonb_typeof(_details)<>'object' OR EXISTS(SELECT 1 FROM jsonb_each(_details) WHERE key NOT IN ('customer_name','phone','email','business_name','business_category','region','requirements','interest_level') OR jsonb_typeof(value)<>'string' OR length(value #>> '{}')>5000) THEN RAISE EXCEPTION 'Invalid lead details'; END IF;
 IF _details ? 'customer_name' AND length(btrim(_details->>'customer_name')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Customer name is required'; END IF;
 UPDATE public.leads SET customer_name=coalesce(_details->>'customer_name',customer_name),phone=coalesce(_details->>'phone',phone),email=coalesce(_details->>'email',email),business_name=coalesce(_details->>'business_name',business_name),business_category=coalesce(_details->>'business_category',business_category),region=coalesce(_details->>'region',region),requirements=coalesce(_details->>'requirements',requirements),interest_level=coalesce(_details->>'interest_level',interest_level),updated_at=now() WHERE id=l.id;
 PERFORM public.support_audit(s,'lead.details',l.id::text,jsonb_build_object('fields',(SELECT jsonb_agg(key) FROM jsonb_object_keys(_details) key)));
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.support_workspace_lead_action(uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_workspace_lead_action(uuid,uuid,timestamptz,jsonb) TO authenticated;
-- Existing limited support endpoints must respect the same tenant feature/privacy boundaries.
CREATE OR REPLACE FUNCTION public.support_read(_session uuid,_resource text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions; r jsonb;
BEGIN
 s:=public.support_session_require(_session,false);
 IF s.id IS NULL THEN RETURN jsonb_build_object('error','Support session has expired'); END IF;
 IF NOT public.license_active() THEN RAISE EXCEPTION 'License access unavailable'; END IF;
 IF _resource='overview' THEN
  SELECT jsonb_build_object('company',(SELECT jsonb_build_object('id',id,'name',name,'email',email,'phone',phone,'contact_person',contact_person) FROM public.companies WHERE id=s.company_id),'session',to_jsonb(s),'counts',jsonb_build_object('members',(SELECT count(*) FROM public.company_members WHERE company_id=s.company_id),'leads',(SELECT count(*) FROM public.leads WHERE company_id=s.company_id AND private_owner_id IS NULL))) INTO r;
 ELSIF _resource='leads' THEN
  IF NOT public.org_feature_allowed(s.company_id,'leads') THEN RAISE EXCEPTION 'Customer leads feature unavailable'; END IF;
  SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO r FROM (SELECT jsonb_build_object('id',l.id,'customer_name',l.customer_name,'phone',l.phone,'email',l.email,'status',l.status,'requirements',l.requirements,'assigned_to',p.full_name,'created_at',l.created_at) x FROM public.leads l LEFT JOIN public.profiles p ON p.id=l.assigned_to WHERE l.company_id=s.company_id AND l.private_owner_id IS NULL ORDER BY l.created_at DESC LIMIT 200) q;
 ELSIF _resource='employees' THEN
  IF NOT public.org_feature_allowed(s.company_id,'employees') THEN RAISE EXCEPTION 'Customer employees feature unavailable'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'status',p.account_status,'roles',(SELECT coalesce(jsonb_agg(role),'[]'::jsonb) FROM public.user_roles WHERE user_id=p.id))),'[]'::jsonb) INTO r FROM public.company_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.company_id=s.company_id;
 ELSE RAISE EXCEPTION 'Unknown resource'; END IF;
 PERFORM public.support_audit(s,'view.'||_resource,NULL,'{}'::jsonb);
 RETURN jsonb_build_object('data',r);
END $$;
CREATE OR REPLACE FUNCTION public.support_write(_session uuid,_action text,_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions; l public.leads; lead_id uuid;
BEGIN
 s:=public.support_session_require(_session,true);
 IF s.id IS NULL THEN RETURN jsonb_build_object('error','Not allowed: session expired or View Only'); END IF;
 IF NOT public.license_active() OR NOT public.org_feature_allowed(s.company_id,'leads') THEN RAISE EXCEPTION 'Customer leads feature unavailable'; END IF;
 IF _action<>'lead.update' THEN RAISE EXCEPTION 'Unknown support action'; END IF;
 lead_id:=(_payload->>'lead_id')::uuid;
 SELECT * INTO l FROM public.leads WHERE id=lead_id AND company_id=s.company_id AND private_owner_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found in this organization'; END IF;
 IF length(coalesce(_payload->>'status',''))>60 OR length(coalesce(_payload->>'requirements',''))>5000 THEN RAISE EXCEPTION 'Invalid lead update'; END IF;
 UPDATE public.leads SET status=coalesce(nullif(btrim(_payload->>'status'),''),status),requirements=coalesce(_payload->>'requirements',requirements),updated_at=now() WHERE id=l.id;
 PERFORM public.support_audit(s,'lead.update',l.id::text,jsonb_build_object('before',jsonb_build_object('status',l.status),'after',jsonb_build_object('status',coalesce(_payload->>'status',l.status))));
 RETURN jsonb_build_object('ok',true);
END $$;