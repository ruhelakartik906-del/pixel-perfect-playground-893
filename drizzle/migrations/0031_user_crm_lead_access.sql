CREATE OR REPLACE FUNCTION public.user_crm_company(_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.company_members m ON m.user_id=p.id JOIN public.companies c ON c.id=m.company_id WHERE p.id=auth.uid() AND p.account_status='active' AND c.id=_company AND c.is_active AND (public.routing_eligible(p.id,c.id) OR public.has_role(p.id,'client'))) $$;
REVOKE ALL ON FUNCTION public.user_crm_company(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_crm_company(uuid) TO authenticated,service_role;
CREATE POLICY "Active CRM lead access" ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (public.has_role(auth.uid(),'super_admin') OR public.user_crm_company(company_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (public.has_role(auth.uid(),'super_admin') OR public.user_crm_company(company_id)));
CREATE POLICY "Active CRM activity access" ON public.lead_activities AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id)) WITH CHECK (EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id));
CREATE OR REPLACE FUNCTION public.user_lead_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'super_admin') THEN
IF (to_jsonb(NEW)-ARRAY['customer_name','phone','email','business_name','business_category','region','requirements','interest_level','stage_id','status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['customer_name','phone','email','business_name','business_category','region','requirements','interest_level','stage_id','status','updated_at']) THEN RAISE EXCEPTION 'Only permitted lead details may change'; END IF;
IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NOT EXISTS(SELECT 1 FROM public.crm_stages s WHERE s.id=NEW.stage_id AND s.is_active AND s.kind='lead' AND s.pipeline_id=NEW.pipeline_id) THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
IF (to_jsonb(NEW)-ARRAY['stage_id','status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['stage_id','status','updated_at']) THEN INSERT INTO public.lead_activities(lead_id,actor_id,type,detail) VALUES(NEW.id,auth.uid(),'details_updated','Customer details updated'); END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER user_lead_details_guard BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.user_lead_guard();
CREATE OR REPLACE FUNCTION public.user_lead_action(_id uuid,_updated_at timestamptz,_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.leads; BEGIN
SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
IF NOT FOUND OR l.assigned_to IS DISTINCT FROM auth.uid() OR NOT public.user_crm_company(l.company_id) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
IF l.updated_at IS DISTINCT FROM _updated_at THEN RAISE EXCEPTION 'Lead changed. Refresh before saving'; END IF;
IF _action='note' THEN
IF length(trim(coalesce(_payload->>'note','')))=0 OR length(_payload->>'note')>5000 THEN RAISE EXCEPTION 'Note must contain 1 to 5000 characters'; END IF;
INSERT INTO public.lead_activities(lead_id,actor_id,type,detail) VALUES(l.id,auth.uid(),'note',trim(_payload->>'note'));
ELSIF _action='stage' THEN
IF NOT EXISTS(SELECT 1 FROM public.crm_stages WHERE id=(_payload->>'stage_id')::uuid AND kind='lead' AND is_active AND pipeline_id=l.pipeline_id) THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
UPDATE public.leads SET stage_id=(_payload->>'stage_id')::uuid WHERE id=l.id;
ELSIF _action='details' THEN
IF length(trim(coalesce(_payload->>'customer_name','')))=0 THEN RAISE EXCEPTION 'Customer name is required'; END IF;
UPDATE public.leads SET customer_name=trim(_payload->>'customer_name'),phone=coalesce(_payload->>'phone',''),email=coalesce(_payload->>'email',''),business_name=coalesce(_payload->>'business_name',''),business_category=coalesce(_payload->>'business_category',''),region=coalesce(_payload->>'region',''),requirements=coalesce(_payload->>'requirements',''),interest_level=coalesce(_payload->>'interest_level','') WHERE id=l.id;
ELSE RAISE EXCEPTION 'Unsupported lead action'; END IF;
RETURN l.id; END $$;
REVOKE ALL ON FUNCTION public.user_lead_action(uuid,timestamptz,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_lead_action(uuid,timestamptz,text,jsonb) TO authenticated,service_role;