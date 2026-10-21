CREATE OR REPLACE FUNCTION public.lead_assigned_board_move(_id uuid,_updated_at timestamptz,_stage uuid,_outcome text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.leads; s public.crm_stages; BEGIN
SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
IF NOT FOUND OR auth.uid() IS NULL OR l.assigned_to IS DISTINCT FROM auth.uid() OR NOT coalesce(public.lead_record_allowed(l.company_id,l.created_by,l.assigned_to,l.private_owner_id),false) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
IF l.updated_at IS DISTINCT FROM _updated_at THEN RAISE EXCEPTION 'Lead changed. Refresh before saving'; END IF;
SELECT * INTO s FROM public.crm_stages WHERE id=_stage AND kind='lead' AND is_active AND pipeline_id=l.pipeline_id FOR SHARE;
IF NOT FOUND THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
IF s.board_closed AND coalesce(_outcome,'') NOT IN ('won','lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
IF NOT s.board_closed AND _outcome IS NOT NULL THEN RAISE EXCEPTION 'Outcomes belong to Deal Closed'; END IF;
IF l.board_moved_at IS NOT NULL AND l.stage_id=s.id AND l.status=(CASE WHEN s.board_closed THEN _outcome ELSE 'open' END) THEN RETURN l.id; END IF;
UPDATE public.leads SET stage_id=s.id,status=CASE WHEN s.board_closed THEN _outcome ELSE 'open' END,board_moved_at=coalesce(board_moved_at,now()) WHERE id=l.id;
RETURN l.id; END $$;
REVOKE ALL ON FUNCTION public.lead_assigned_board_move(uuid,timestamptz,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lead_assigned_board_move(uuid,timestamptz,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.user_lead_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'super_admin') THEN
IF NEW.board_moved_at IS DISTINCT FROM OLD.board_moved_at AND (OLD.board_moved_at IS NOT NULL OR NEW.board_moved_at IS DISTINCT FROM now() OR OLD.assigned_to IS DISTINCT FROM auth.uid() OR NOT coalesce(public.lead_record_allowed(OLD.company_id,OLD.created_by,OLD.assigned_to,OLD.private_owner_id),false)) THEN RAISE EXCEPTION 'Only an authorized assigned Board move may set its timestamp'; END IF;
IF (to_jsonb(NEW)-ARRAY['customer_name','phone','email','business_name','business_category','region','requirements','interest_level','stage_id','status','updated_at','board_moved_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['customer_name','phone','email','business_name','business_category','region','requirements','interest_level','stage_id','status','updated_at','board_moved_at']) THEN RAISE EXCEPTION 'Only permitted lead details may change'; END IF;
IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NOT EXISTS(SELECT 1 FROM public.crm_stages s WHERE s.id=NEW.stage_id AND s.is_active AND s.kind='lead' AND s.pipeline_id=NEW.pipeline_id) THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
IF (to_jsonb(NEW)-ARRAY['stage_id','status','updated_at','board_moved_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['stage_id','status','updated_at','board_moved_at']) THEN INSERT INTO public.lead_activities(lead_id,actor_id,type,detail) VALUES(NEW.id,auth.uid(),'details_updated','Customer details updated'); END IF;
END IF; RETURN NEW; END $$;