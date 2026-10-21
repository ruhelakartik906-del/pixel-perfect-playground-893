CREATE OR REPLACE FUNCTION public.lead_record_allowed(_company uuid,_creator uuid,_assignee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.lead_workspace_active() AND _assignee=auth.uid() AND ((_company IS NULL AND _creator=auth.uid()) OR (_company IS NOT NULL AND public.user_crm_company(_company))) $$;
CREATE OR REPLACE FUNCTION public.lead_record_allowed(_company uuid,_creator uuid,_assignee uuid,_owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.lead_workspace_active() AND _assignee=auth.uid() AND ((_company IS NULL AND coalesce(_owner,_creator)=auth.uid()) OR (_company IS NOT NULL AND _owner IS NULL AND public.user_crm_company(_company))) $$;
REVOKE ALL ON FUNCTION public.lead_record_allowed(uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lead_record_allowed(uuid,uuid,uuid,uuid) TO authenticated,service_role;
ALTER POLICY "Active CRM lead access" ON public.leads USING(public.routing_admin() OR public.lead_record_allowed(company_id,created_by,assigned_to,private_owner_id)) WITH CHECK(public.routing_admin() OR public.lead_record_allowed(company_id,created_by,assigned_to,private_owner_id));
ALTER POLICY lead_account_assignment_boundary ON public.leads USING(public.routing_admin() OR public.lead_record_allowed(company_id,created_by,assigned_to,private_owner_id)) WITH CHECK(public.routing_admin() OR public.lead_record_allowed(company_id,created_by,assigned_to,private_owner_id));
ALTER POLICY personal_lead_read ON public.leads USING(company_id IS NULL AND public.lead_record_allowed(company_id,created_by,assigned_to,private_owner_id));
ALTER POLICY personal_activity_read ON public.lead_activities USING(EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.company_id IS NULL AND public.lead_record_allowed(l.company_id,l.created_by,l.assigned_to,l.private_owner_id)));
DO $migration$ DECLARE definition text; signature text; BEGIN
FOREACH signature IN ARRAY ARRAY['public.user_board_lead_delete(uuid,timestamptz)','public.lead_board_move(uuid,timestamptz,uuid,text)','public.user_lead_action(uuid,timestamptz,text,jsonb)'] LOOP
SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
EXECUTE replace(definition,'public.lead_record_allowed(l.company_id,l.created_by,l.assigned_to)','public.lead_record_allowed(l.company_id,l.created_by,l.assigned_to,l.private_owner_id)'); END LOOP;
SELECT pg_get_functiondef('public.lead_company_stage_guard()'::regprocedure) INTO definition;
EXECUTE replace(definition,'owner_id=NEW.created_by','owner_id=coalesce(NEW.private_owner_id,NEW.created_by)');
END $migration$;
CREATE OR REPLACE FUNCTION public.manual_routing_lead_assign(_lead uuid,_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.leads; BEGIN
IF auth.uid() IS NULL OR NOT coalesce(public.routing_admin(),false) THEN RAISE EXCEPTION 'Super Admin authorization required'; END IF;
SELECT * INTO l FROM public.leads WHERE id=_lead FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
IF l.assigned_to IS NOT NULL OR EXISTS(SELECT 1 FROM public.lead_assignment_events WHERE lead_id=l.id) THEN RETURN jsonb_build_object('status','unchanged'); END IF;
IF l.intake_source IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'Use existing ad routing for this lead'; END IF;
IF NOT public.manual_routing_eligible(_user,l.company_id) THEN RAISE EXCEPTION 'User is pending, blocked or unauthorized for this workspace'; END IF;
PERFORM 1 FROM public.profiles WHERE id=_user AND account_status='active' FOR SHARE;
IF NOT FOUND THEN RAISE EXCEPTION 'Active recipient required'; END IF;
IF l.company_id IS NULL AND l.private_owner_id IS NOT NULL AND l.private_owner_id IS DISTINCT FROM _user THEN RAISE EXCEPTION 'Private ownership cannot be transferred'; END IF;
UPDATE public.leads SET assigned_to=_user,private_owner_id=CASE WHEN l.company_id IS NULL THEN _user ELSE NULL END,updated_at=now() WHERE id=l.id RETURNING * INTO l;
INSERT INTO public.lead_assignment_events(lead_id,company_id,user_id,assignment_type,snapshot,actor_id) VALUES(l.id,l.company_id,_user,'manual',jsonb_build_object('lead',to_jsonb(l),'user_name',(SELECT coalesce(nullif(full_name,''),email) FROM public.profiles WHERE id=_user),'company_name',(SELECT name FROM public.companies WHERE id=l.company_id),'rule_name',NULL),auth.uid());
DELETE FROM public.lead_routing_queue WHERE lead_id=l.id;
RETURN jsonb_build_object('status','assigned','lead_id',l.id);
END $$;
REVOKE ALL ON FUNCTION public.manual_routing_lead_assign(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manual_routing_lead_assign(uuid,uuid) TO authenticated;