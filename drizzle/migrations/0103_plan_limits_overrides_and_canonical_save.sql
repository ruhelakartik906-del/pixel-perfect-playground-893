CREATE TABLE public.org_configuration_overrides (
 company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
 limits jsonb NOT NULL DEFAULT '{}'::jsonb,
 features jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_configuration_overrides TO authenticated;
GRANT ALL ON public.org_configuration_overrides TO service_role;
ALTER TABLE public.org_configuration_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY configuration_admin_read ON public.org_configuration_overrides FOR SELECT TO authenticated USING (public.routing_admin());
CREATE POLICY configuration_member_read ON public.org_configuration_overrides FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY license_gate ON public.org_configuration_overrides AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
-- Preserve legacy effective configuration without changing the effective rows.
INSERT INTO public.org_configuration_overrides(company_id,limits,features)
SELECT c.id,
 coalesce((SELECT to_jsonb(l) - 'id' - 'company_id' - 'updated_at' FROM public.org_usage_limits l WHERE l.company_id=c.id),'{}'::jsonb),
 coalesce((SELECT jsonb_object_agg(f.feature_key,f.enabled) FROM public.org_feature_permissions f WHERE f.company_id=c.id),'{}'::jsonb)
FROM public.companies c WHERE EXISTS (SELECT 1 FROM public.org_usage_limits l WHERE l.company_id=c.id) OR EXISTS (SELECT 1 FROM public.org_feature_permissions f WHERE f.company_id=c.id);
CREATE OR REPLACE FUNCTION public.org_validate_limits(_limits jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; v jsonb;
BEGIN
 IF _limits IS NULL OR jsonb_typeof(_limits)<>'object' THEN RAISE EXCEPTION 'Limits must be an object'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(_limits) LOOP
  IF k NOT IN ('max_employees','max_leads','monthly_whatsapp_messages','max_whatsapp_numbers','max_chatbots','max_workflows','max_drip_campaigns','max_api_requests','max_storage_mb') THEN RAISE EXCEPTION 'Unknown limit'; END IF;
  IF v <> 'null'::jsonb THEN
   IF jsonb_typeof(v)<>'number' OR (v::text)::numeric < 0 OR (v::text)::numeric > 2147483647 OR trunc((v::text)::numeric) <> (v::text)::numeric THEN RAISE EXCEPTION 'Limits must be non-negative whole numbers or Unlimited'; END IF;
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.org_validate_features(_features jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; v jsonb;
BEGIN
 IF _features IS NULL OR jsonb_typeof(_features)<>'object' THEN RAISE EXCEPTION 'Features must be an object'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(_features) LOOP
  IF k NOT IN ('leads','contacts','companies','pipeline','deals','tasks','quotations','invoices','payments','products','import_export','employees','analytics','reports','whatsapp','whatsapp_templates','whatsapp_campaigns','chatbots','flows','drip_campaigns','integrations','developer_api','webhooks') OR jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION 'Invalid feature'; END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.org_apply_configuration(_company uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l jsonb; f jsonb; ov public.org_configuration_overrides; p uuid;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 SELECT plan_id INTO p FROM public.org_subscriptions WHERE company_id=_company;
 SELECT * INTO ov FROM public.org_configuration_overrides WHERE company_id=_company;
 l:=coalesce((SELECT limits FROM public.plans WHERE id=p),'{}'::jsonb) || coalesce(ov.limits,'{}'::jsonb);
 f:=coalesce((SELECT jsonb_object_agg(feature_key,enabled) FROM public.plan_features WHERE plan_id=p),'{}'::jsonb) || coalesce(ov.features,'{}'::jsonb);
 INSERT INTO public.org_usage_limits(company_id,max_employees,max_leads,monthly_whatsapp_messages,max_whatsapp_numbers,max_chatbots,max_workflows,max_drip_campaigns,max_api_requests,max_storage_mb)
 VALUES(_company,(l->>'max_employees')::int,(l->>'max_leads')::int,(l->>'monthly_whatsapp_messages')::int,(l->>'max_whatsapp_numbers')::int,(l->>'max_chatbots')::int,(l->>'max_workflows')::int,(l->>'max_drip_campaigns')::int,(l->>'max_api_requests')::int,(l->>'max_storage_mb')::int)
 ON CONFLICT(company_id) DO UPDATE SET max_employees=excluded.max_employees,max_leads=excluded.max_leads,monthly_whatsapp_messages=excluded.monthly_whatsapp_messages,max_whatsapp_numbers=excluded.max_whatsapp_numbers,max_chatbots=excluded.max_chatbots,max_workflows=excluded.max_workflows,max_drip_campaigns=excluded.max_drip_campaigns,max_api_requests=excluded.max_api_requests,max_storage_mb=excluded.max_storage_mb,updated_at=now();
 DELETE FROM public.org_feature_permissions WHERE company_id=_company;
 INSERT INTO public.org_feature_permissions(company_id,feature_key,enabled) SELECT _company,key,(value::text)::boolean FROM jsonb_each(f);
END $$;
REVOKE ALL ON FUNCTION public.org_apply_configuration(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.master_save_customer_limits(_actor uuid,_company uuid,_limits jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.master_assert_admin(_actor);
 IF _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid actor'; END IF;
 PERFORM public.org_validate_limits(_limits);
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 INSERT INTO public.org_configuration_overrides(company_id,limits) VALUES(_company,_limits) ON CONFLICT(company_id) DO UPDATE SET limits=excluded.limits,updated_at=now();
 PERFORM public.org_apply_configuration(_company);
END $$;
CREATE OR REPLACE FUNCTION public.master_save_customer_features(_actor uuid,_company uuid,_features jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.master_assert_admin(_actor);
 IF _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid actor'; END IF;
 PERFORM public.org_validate_features(_features);
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 INSERT INTO public.org_configuration_overrides(company_id,features) VALUES(_company,_features) ON CONFLICT(company_id) DO UPDATE SET features=excluded.features,updated_at=now();
 PERFORM public.org_apply_configuration(_company);
END $$;
CREATE OR REPLACE FUNCTION public.master_assign_plan(_actor uuid,_company uuid,_plan uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.master_assert_admin(_actor);
 IF _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid actor'; END IF;
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 PERFORM 1 FROM public.plans WHERE id=_plan AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select an active plan'; END IF;
 INSERT INTO public.org_subscriptions(company_id,plan_id) VALUES(_company,_plan) ON CONFLICT(company_id) DO UPDATE SET plan_id=excluded.plan_id,updated_at=now();
 PERFORM public.org_apply_configuration(_company);
END $$;
-- Keep the text contract used by the existing published application, retire only the unused conflicting overload.
DROP FUNCTION public.master_save_plan(uuid,uuid,text,text,jsonb,jsonb);
CREATE OR REPLACE FUNCTION public.master_save_plan(_actor uuid,_plan text,_name text,_description text,_limits jsonb,_features jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p uuid:=nullif(_plan,'')::uuid; c uuid;
BEGIN
 PERFORM public.master_assert_admin(_actor);
 IF _actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid actor'; END IF;
 IF length(btrim(coalesce(_name,''))) NOT BETWEEN 1 AND 80 OR length(coalesce(_description,''))>500 THEN RAISE EXCEPTION 'Invalid plan name or description'; END IF;
 PERFORM public.org_validate_limits(_limits); PERFORM public.org_validate_features(_features);
 IF p IS NULL THEN
  INSERT INTO public.plans(name,description,limits) VALUES(btrim(_name),coalesce(_description,''),_limits) RETURNING id INTO p;
 ELSE
  UPDATE public.plans SET name=btrim(_name),description=coalesce(_description,''),limits=_limits,updated_at=now() WHERE id=p AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active plan not found'; END IF;
 END IF;
 DELETE FROM public.plan_features WHERE plan_id=p;
 INSERT INTO public.plan_features(plan_id,feature_key,enabled) SELECT p,key,(value::text)::boolean FROM jsonb_each(_features);
 FOR c IN SELECT company_id FROM public.org_subscriptions WHERE plan_id=p ORDER BY company_id LOOP PERFORM public.org_apply_configuration(c); END LOOP;
 RETURN p;
END $$;
CREATE OR REPLACE FUNCTION public.master_retire_plan(_plan_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.master_assert_admin(auth.uid());
 PERFORM 1 FROM public.plans WHERE id=_plan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
 UPDATE public.plans SET is_active=false,updated_at=now() WHERE id=_plan_id;
END $$;
CREATE OR REPLACE FUNCTION public.org_plan_delete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.org_subscriptions WHERE plan_id=OLD.id) THEN RAISE EXCEPTION 'Assigned plans must be retired to preserve customer history'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER org_plan_delete_guard BEFORE DELETE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.org_plan_delete_guard();
REVOKE ALL ON FUNCTION public.master_save_plan(uuid,text,text,text,jsonb,jsonb),public.master_save_customer_limits(uuid,uuid,jsonb),public.master_save_customer_features(uuid,uuid,jsonb),public.master_assign_plan(uuid,uuid,uuid),public.master_retire_plan(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.master_save_plan(uuid,text,text,text,jsonb,jsonb),public.master_save_customer_limits(uuid,uuid,jsonb),public.master_save_customer_features(uuid,uuid,jsonb),public.master_assign_plan(uuid,uuid,uuid),public.master_retire_plan(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.org_employee_limit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text,17));
 IF TG_OP='UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN RETURN NEW; END IF;
 IF NOT public.org_limit_available(NEW.company_id,'employees') THEN RAISE EXCEPTION 'Employee limit reached for this organization'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER org_employee_update_limit_guard BEFORE UPDATE OF company_id ON public.company_members FOR EACH ROW EXECUTE FUNCTION public.org_employee_limit_guard();
CREATE OR REPLACE FUNCTION public.org_lead_limit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text,17));
 IF NOT public.org_limit_available(NEW.company_id,'leads') THEN RAISE EXCEPTION 'Lead limit reached for this organization'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER org_lead_limit_guard BEFORE INSERT OR UPDATE OF company_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.org_lead_limit_guard();