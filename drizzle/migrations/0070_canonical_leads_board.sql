ALTER TABLE public.crm_stages ADD COLUMN board_label text, ADD COLUMN board_initial boolean NOT NULL DEFAULT false, ADD COLUMN board_closed boolean NOT NULL DEFAULT false;
UPDATE public.crm_stages SET board_label=CASE WHEN name='New' THEN 'All Leads' WHEN name='Qualified' THEN 'Interested' ELSE name END, board_initial=(position=0), board_closed=(name='Deal Closed') WHERE kind='lead';
INSERT INTO public.crm_stages(pipeline_id,kind,name,board_label,color,position,board_closed)
SELECT p.id,'lead',v.name,v.name,v.color,v.position,v.closed FROM public.crm_pipelines p CROSS JOIN (VALUES ('Follow-up','#EAB6DA',3,false),('Negotiation','#BBD7F4',4,false),('Deal Closed','#A8E0BD',5,true)) AS v(name,color,position,closed) WHERE NOT EXISTS(SELECT 1 FROM public.crm_stages s WHERE s.pipeline_id=p.id AND s.kind='lead' AND s.name=v.name);
CREATE OR REPLACE FUNCTION public.lead_board_move(_id uuid,_updated_at timestamptz,_stage uuid,_outcome text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.leads; s public.crm_stages; BEGIN
SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
IF NOT FOUND OR NOT (public.routing_admin() OR (l.assigned_to=auth.uid() AND public.user_crm_company(l.company_id))) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
IF l.updated_at IS DISTINCT FROM _updated_at THEN RAISE EXCEPTION 'Lead changed. Refresh before saving'; END IF;
SELECT * INTO s FROM public.crm_stages WHERE id=_stage AND kind='lead' AND is_active AND pipeline_id=l.pipeline_id FOR SHARE;
IF NOT FOUND THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
IF s.board_closed AND coalesce(_outcome,'') NOT IN ('won','lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
IF NOT s.board_closed AND _outcome IS NOT NULL THEN RAISE EXCEPTION 'Outcomes belong to Deal Closed'; END IF;
UPDATE public.leads SET stage_id=s.id,status=CASE WHEN s.board_closed THEN _outcome ELSE 'open' END WHERE id=l.id;
RETURN l.id; END $$;
REVOKE ALL ON FUNCTION public.lead_board_move(uuid,timestamptz,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_board_move(uuid,timestamptz,uuid,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.lead_board_consistency() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.crm_stages; closed_id uuid; BEGIN
IF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.status IS DISTINCT FROM OLD.status THEN
SELECT * INTO s FROM public.crm_stages WHERE id=NEW.stage_id AND kind='lead';
IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND s.id IS NOT NULL THEN
IF s.pipeline_id IS DISTINCT FROM NEW.pipeline_id OR NOT s.is_active THEN RAISE EXCEPTION 'Select an active stage in this lead pipeline'; END IF;
IF s.board_closed AND NEW.status NOT IN ('won','lost') THEN RAISE EXCEPTION 'Choose Won or Lost for Deal Closed'; END IF;
IF NOT s.board_closed THEN NEW.status:='open'; END IF;
ELSIF NEW.status IN ('won','lost') THEN
SELECT id INTO closed_id FROM public.crm_stages WHERE pipeline_id=NEW.pipeline_id AND kind='lead' AND board_closed AND is_active LIMIT 1;
IF closed_id IS NOT NULL THEN NEW.stage_id:=closed_id; END IF;
ELSIF NEW.status='open' AND s.board_closed THEN
SELECT id INTO NEW.stage_id FROM public.crm_stages WHERE pipeline_id=NEW.pipeline_id AND kind='lead' AND board_initial AND is_active LIMIT 1;
END IF; END IF; RETURN NEW; END $$;
CREATE TRIGGER lead_board_consistency BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.lead_board_consistency();
CREATE OR REPLACE FUNCTION public.lead_board_stage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF OLD.kind='lead' THEN
IF TG_OP='DELETE' THEN
IF OLD.board_initial OR OLD.board_closed THEN RAISE EXCEPTION 'The initial and Deal Closed stages cannot be deleted'; END IF;
IF EXISTS(SELECT 1 FROM public.leads WHERE stage_id=OLD.id) OR EXISTS(SELECT 1 FROM public.deals WHERE stage_id=OLD.id) OR EXISTS(SELECT 1 FROM public.automation_workflows WHERE config::text LIKE '%'||OLD.id::text||'%' OR config::text LIKE '%'||OLD.name||'%') THEN RAISE EXCEPTION 'Stage is in use; keep it to preserve history'; END IF;
RETURN OLD;
END IF;
IF OLD.board_initial AND (NOT NEW.is_active OR NEW.position<>0 OR NOT NEW.board_initial) THEN RAISE EXCEPTION 'The initial stage must remain active and first'; END IF;
IF OLD.board_closed AND (NOT NEW.is_active OR NOT NEW.board_closed) THEN RAISE EXCEPTION 'Deal Closed must remain active'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER lead_board_stage_guard BEFORE UPDATE OR DELETE ON public.crm_stages FOR EACH ROW EXECUTE FUNCTION public.lead_board_stage_guard();
CREATE OR REPLACE FUNCTION public.lead_status_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.crm_stages; pid uuid; sid uuid; ids uuid[]; expected uuid[]; BEGIN
IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Only authorized Admins can manage shared lead statuses'; END IF;
pid:=(_payload->>'pipeline_id')::uuid;
PERFORM pg_advisory_xact_lock(hashtext('lead-status-'||pid::text));
IF NOT EXISTS(SELECT 1 FROM public.crm_pipelines WHERE id=pid) THEN RAISE EXCEPTION 'Pipeline not found'; END IF;
IF _action='reorder' THEN
SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(_payload->'ids');
SELECT array_agg(id ORDER BY position,id) INTO expected FROM public.crm_stages WHERE pipeline_id=pid AND kind='lead';
IF ids IS NULL OR cardinality(ids)<>cardinality(expected) OR NOT ids @> expected OR (SELECT count(DISTINCT x) FROM unnest(ids) x)<>cardinality(expected) OR NOT EXISTS(SELECT 1 FROM public.crm_stages WHERE id=ids[1] AND board_initial) THEN RAISE EXCEPTION 'Invalid stage order'; END IF;
UPDATE public.crm_stages SET position=array_position(ids,id)-1 WHERE pipeline_id=pid AND kind='lead'; RETURN pid;
END IF;
IF _action='create' OR _action='edit' THEN
IF length(trim(coalesce(_payload->>'name',''))) NOT BETWEEN 1 AND 80 OR coalesce(_payload->>'color','') !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'Enter a name and valid color'; END IF;
IF EXISTS(SELECT 1 FROM public.crm_stages WHERE pipeline_id=pid AND kind='lead' AND lower(coalesce(board_label,name))=lower(trim(_payload->>'name')) AND id IS DISTINCT FROM nullif(_payload->>'id','')::uuid) THEN RAISE EXCEPTION 'That status already exists'; END IF;
END IF;
IF _action='create' THEN INSERT INTO public.crm_stages(pipeline_id,kind,name,board_label,color,position) SELECT pid,'lead',trim(_payload->>'name'),trim(_payload->>'name'),_payload->>'color',coalesce(max(position),-1)+1 FROM public.crm_stages WHERE pipeline_id=pid AND kind='lead' RETURNING id INTO sid;
ELSE SELECT * INTO s FROM public.crm_stages WHERE id=(_payload->>'id')::uuid AND pipeline_id=pid AND kind='lead' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Status not found'; END IF;
IF _action='edit' THEN UPDATE public.crm_stages SET board_label=trim(_payload->>'name'),color=_payload->>'color' WHERE id=s.id;
ELSIF _action='delete' THEN DELETE FROM public.crm_stages WHERE id=s.id;
ELSE RAISE EXCEPTION 'Unsupported status action'; END IF; sid:=s.id; END IF;
RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.lead_status_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_status_action(text,jsonb) TO authenticated,service_role;