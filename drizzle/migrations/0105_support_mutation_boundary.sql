CREATE OR REPLACE FUNCTION public.support_mutation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions; row_data jsonb; bound uuid; marker text;
BEGIN
 SELECT * INTO s FROM public.org_support_sessions WHERE master_user_id=auth.uid() AND ended_at IS NULL AND NOT revoked AND expires_at>now() ORDER BY started_at DESC LIMIT 1;
 IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF s.mode='view' THEN RAISE EXCEPTION 'View Only support access cannot write'; END IF;
 marker:=current_setting('app.support_session',true);
 IF marker IS DISTINCT FROM s.id::text THEN RAISE EXCEPTION 'Support writes must use authorized session actions'; END IF;
 IF TG_TABLE_NAME<>'leads' THEN RAISE EXCEPTION 'This sensitive support action is not enabled'; END IF;
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 bound:=nullif(row_data->>'company_id','')::uuid;
 IF bound IS DISTINCT FROM s.company_id OR row_data->>'private_owner_id' IS NOT NULL THEN RAISE EXCEPTION 'Support organization boundary denied'; END IF;
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Support action is not enabled'; END IF;
 IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Support cannot change record ownership'; END IF;
 RETURN NEW;
END $$;
-- Every existing application data table is guarded; session lifecycle/audit and license state remain controlled by their dedicated RPCs.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('org_support_sessions','org_support_audit','license_state','crm_license_verify_failures') LOOP
  EXECUTE format('CREATE TRIGGER support_mutation_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.support_mutation_guard()',t);
 END LOOP;
END $$;
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
 PERFORM set_config('app.support_session',s.id::text,true);
 UPDATE public.leads SET customer_name=coalesce(_details->>'customer_name',customer_name),phone=coalesce(_details->>'phone',phone),email=coalesce(_details->>'email',email),business_name=coalesce(_details->>'business_name',business_name),business_category=coalesce(_details->>'business_category',business_category),region=coalesce(_details->>'region',region),requirements=coalesce(_details->>'requirements',requirements),interest_level=coalesce(_details->>'interest_level',interest_level),updated_at=now() WHERE id=l.id;
 PERFORM set_config('app.support_session','',true);
 PERFORM public.support_audit(s,'lead.details',l.id::text,jsonb_build_object('fields',(SELECT jsonb_agg(key) FROM jsonb_object_keys(_details) key),'before',jsonb_build_object('updated_at',l.updated_at),'after',jsonb_build_object('updated_at',(SELECT updated_at FROM public.leads WHERE id=l.id))));
 RETURN jsonb_build_object('ok',true);
END $$;
-- The legacy status-only support action is unsafe for Board outcomes; fail closed and use validated detail actions.
CREATE OR REPLACE FUNCTION public.support_write(_session uuid,_action text,_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions;
BEGIN
 s:=public.support_session_require(_session,true);
 IF s.id IS NULL THEN RETURN jsonb_build_object('error','Not allowed: session expired or View Only'); END IF;
 RAISE EXCEPTION 'Use the validated customer workspace action';
END $$;