CREATE OR REPLACE FUNCTION public.lead_board_move(_id uuid,_updated_at timestamptz,_stage uuid,_outcome text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.leads; s public.crm_stages; BEGIN
SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
IF NOT FOUND OR auth.uid() IS NULL OR NOT coalesce(public.routing_admin() OR (l.assigned_to=auth.uid() AND public.user_workspace_allowed() AND public.user_crm_company(l.company_id)),false) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
IF l.updated_at IS DISTINCT FROM _updated_at THEN RAISE EXCEPTION 'Lead changed. Refresh before saving'; END IF;
SELECT * INTO s FROM public.crm_stages WHERE id=_stage AND kind='lead' AND is_active AND pipeline_id=l.pipeline_id FOR SHARE;
IF NOT FOUND THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
IF s.board_closed AND coalesce(_outcome,'') NOT IN ('won','lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
IF NOT s.board_closed AND _outcome IS NOT NULL THEN RAISE EXCEPTION 'Outcomes belong to Deal Closed'; END IF;
UPDATE public.leads SET stage_id=s.id,status=CASE WHEN s.board_closed THEN _outcome ELSE 'open' END WHERE id=l.id;
RETURN l.id; END $$;
REVOKE ALL ON FUNCTION public.lead_board_move(uuid,timestamptz,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_board_move(uuid,timestamptz,uuid,text) TO authenticated,service_role;