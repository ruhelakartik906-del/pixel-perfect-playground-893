CREATE OR REPLACE FUNCTION public.user_lead_status_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'super_admin') AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('open','won','lost') THEN RAISE EXCEPTION 'Select a valid lead status'; END IF; RETURN NEW; END $$;
CREATE TRIGGER user_lead_status_validation BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.user_lead_status_guard();
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
ELSIF _action='status' THEN
IF coalesce(_payload->>'status','') NOT IN ('open','won','lost') THEN RAISE EXCEPTION 'Select a valid lead status'; END IF;
UPDATE public.leads SET status=_payload->>'status' WHERE id=l.id;
ELSIF _action='details' THEN
IF length(trim(coalesce(_payload->>'customer_name','')))=0 THEN RAISE EXCEPTION 'Customer name is required'; END IF;
UPDATE public.leads SET customer_name=trim(_payload->>'customer_name'),phone=coalesce(_payload->>'phone',''),email=coalesce(_payload->>'email',''),business_name=coalesce(_payload->>'business_name',''),business_category=coalesce(_payload->>'business_category',''),region=coalesce(_payload->>'region',''),requirements=coalesce(_payload->>'requirements',''),interest_level=coalesce(_payload->>'interest_level','') WHERE id=l.id;
ELSE RAISE EXCEPTION 'Unsupported lead action'; END IF;
RETURN l.id; END $$;
REVOKE ALL ON FUNCTION public.user_lead_action(uuid,timestamptz,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_lead_action(uuid,timestamptz,text,jsonb) TO authenticated,service_role;