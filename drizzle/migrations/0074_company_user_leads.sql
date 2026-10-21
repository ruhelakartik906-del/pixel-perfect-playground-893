ALTER TABLE public.crm_stages ADD COLUMN company_id uuid REFERENCES public.companies(id);
CREATE TABLE public.company_lead_status (company_id uuid NOT NULL REFERENCES public.companies(id),stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,label text NOT NULL,color text NOT NULL CHECK(color ~ '^#[0-9a-fA-F]{6}$'),position integer NOT NULL,hidden boolean NOT NULL DEFAULT false,is_default boolean NOT NULL DEFAULT false,PRIMARY KEY(company_id,stage_id));
GRANT SELECT ON public.company_lead_status TO authenticated;
GRANT ALL ON public.company_lead_status TO service_role;
ALTER TABLE public.company_lead_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_status_read ON public.company_lead_status FOR SELECT TO authenticated USING(public.user_crm_company(company_id) OR public.routing_admin());
CREATE POLICY company_stage_boundary ON public.crm_stages AS RESTRICTIVE FOR ALL TO authenticated USING(company_id IS NULL OR public.user_crm_company(company_id) OR public.routing_admin()) WITH CHECK(company_id IS NULL OR public.routing_admin());
CREATE OR REPLACE FUNCTION public.lead_company_allowed(_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND coalesce(public.user_crm_company(_company),false) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('employee','manager')) $$;
REVOKE ALL ON FUNCTION public.lead_company_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_company_allowed(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.lead_company_stages(_company uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR NOT coalesce(public.user_crm_company(_company),false) THEN RAISE EXCEPTION 'Company access denied'; END IF;
RETURN coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('board_label',coalesce(c.label,s.board_label,s.name),'color',coalesce(c.color,s.color),'position',coalesce(c.position,s.position),'is_default',coalesce(c.is_default,s.board_initial AND NOT EXISTS(SELECT 1 FROM public.company_lead_status d JOIN public.crm_stages ds ON ds.id=d.stage_id WHERE d.company_id=_company AND ds.pipeline_id=s.pipeline_id AND d.is_default AND NOT d.hidden))) ORDER BY s.pipeline_id,coalesce(c.position,s.position),s.id) FROM public.crm_stages s LEFT JOIN public.company_lead_status c ON c.stage_id=s.id AND c.company_id=_company WHERE s.kind='lead' AND (s.company_id IS NULL OR s.company_id=_company) AND NOT coalesce(c.hidden,false)),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.lead_company_stages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_company_stages(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.lead_company_status_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid:=(_payload->>'company_id')::uuid; pid uuid:=(_payload->>'pipeline_id')::uuid; sid uuid:=nullif(_payload->>'id','')::uuid; s public.crm_stages; ids uuid[]; expected uuid[]; stages jsonb; make_default boolean:=coalesce((_payload->>'is_default')::boolean,false); BEGIN
IF NOT coalesce(public.lead_company_allowed(cid),false) THEN RAISE EXCEPTION 'Company status access denied'; END IF;
PERFORM pg_advisory_xact_lock(hashtext('company-lead-status-'||cid::text||pid::text));
IF NOT EXISTS(SELECT 1 FROM public.crm_pipelines WHERE id=pid AND is_active) THEN RAISE EXCEPTION 'Pipeline not found'; END IF;
stages:=public.lead_company_stages(cid);
IF _action='reorder' THEN
SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(_payload->'ids');
SELECT array_agg((v->>'id')::uuid ORDER BY (v->>'position')::integer,v->>'id') INTO expected FROM jsonb_array_elements(stages) v WHERE v->>'pipeline_id'=pid::text;
IF ids IS NULL OR cardinality(ids)<>cardinality(expected) OR NOT ids @> expected OR (SELECT count(DISTINCT x) FROM unnest(ids) x)<>cardinality(expected) OR NOT EXISTS(SELECT 1 FROM public.crm_stages WHERE id=ids[1] AND board_initial) THEN RAISE EXCEPTION 'Invalid stage order'; END IF;
INSERT INTO public.company_lead_status(company_id,stage_id,label,color,position,is_default) SELECT cid,(v->>'id')::uuid,v->>'board_label',v->>'color',array_position(ids,(v->>'id')::uuid)-1,(v->>'is_default')::boolean FROM jsonb_array_elements(stages) v WHERE v->>'pipeline_id'=pid::text ON CONFLICT(company_id,stage_id) DO UPDATE SET position=EXCLUDED.position; RETURN pid;
END IF;
IF _action IN ('create','edit') THEN
IF length(trim(coalesce(_payload->>'name',''))) NOT BETWEEN 1 AND 80 OR coalesce(_payload->>'color','') !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'Enter a name and valid color'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(stages) v WHERE v->>'pipeline_id'=pid::text AND lower(v->>'board_label')=lower(trim(_payload->>'name')) AND (v->>'id')::uuid IS DISTINCT FROM sid) THEN RAISE EXCEPTION 'That status already exists'; END IF;
END IF;
IF _action='create' THEN
INSERT INTO public.crm_stages(pipeline_id,kind,name,board_label,color,position,company_id) SELECT pid,'lead',trim(_payload->>'name'),trim(_payload->>'name'),_payload->>'color',coalesce(max((v->>'position')::integer),-1)+1,cid FROM jsonb_array_elements(stages) v WHERE v->>'pipeline_id'=pid::text RETURNING * INTO s; sid:=s.id;
ELSE SELECT * INTO s FROM public.crm_stages WHERE id=sid AND pipeline_id=pid AND kind='lead' AND (company_id IS NULL OR company_id=cid) FOR UPDATE;
IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(stages) v WHERE v->>'id'=sid::text) THEN RAISE EXCEPTION 'Status not found'; END IF; END IF;
IF _action='delete' THEN
IF s.board_initial OR s.board_closed THEN RAISE EXCEPTION 'Protected status cannot be deleted'; END IF;
IF EXISTS(SELECT 1 FROM public.leads WHERE company_id=cid AND stage_id=sid) OR EXISTS(SELECT 1 FROM public.deals WHERE company_id=cid AND stage_id=sid) OR EXISTS(SELECT 1 FROM public.automation_workflows WHERE conditions::text LIKE '%'||sid::text||'%' OR conditions::text LIKE '%'||s.name||'%' OR actions::text LIKE '%'||sid::text||'%') THEN RAISE EXCEPTION 'Status is in use; preserve history'; END IF;
INSERT INTO public.company_lead_status(company_id,stage_id,label,color,position,hidden) VALUES(cid,sid,s.name,s.color,s.position,true) ON CONFLICT(company_id,stage_id) DO UPDATE SET hidden=true,is_default=false;
ELSIF _action IN ('create','edit') THEN
IF make_default AND s.board_closed THEN RAISE EXCEPTION 'Deal Closed cannot be the new-lead default'; END IF;
IF make_default THEN UPDATE public.company_lead_status c SET is_default=false FROM public.crm_stages ds WHERE c.stage_id=ds.id AND c.company_id=cid AND ds.pipeline_id=pid; END IF;
INSERT INTO public.company_lead_status(company_id,stage_id,label,color,position,is_default) VALUES(cid,sid,trim(_payload->>'name'),_payload->>'color',coalesce((SELECT (v->>'position')::integer FROM jsonb_array_elements(stages) v WHERE v->>'id'=sid::text),s.position),make_default) ON CONFLICT(company_id,stage_id) DO UPDATE SET label=EXCLUDED.label,color=EXCLUDED.color,is_default=EXCLUDED.is_default;
ELSE RAISE EXCEPTION 'Unsupported status action'; END IF; RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.lead_company_status_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_company_status_action(text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.lead_company_stage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
PERFORM 1 FROM public.crm_stages WHERE id=NEW.stage_id FOR SHARE;
IF EXISTS(SELECT 1 FROM public.crm_stages WHERE id=NEW.stage_id AND company_id IS NOT NULL AND company_id IS DISTINCT FROM NEW.company_id) OR EXISTS(SELECT 1 FROM public.company_lead_status WHERE company_id=NEW.company_id AND stage_id=NEW.stage_id AND hidden) THEN RAISE EXCEPTION 'Status unavailable in this company'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER lead_company_stage_guard BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.lead_company_stage_guard();
CREATE OR REPLACE FUNCTION public.user_board_lead_create(_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid:=(_payload->>'company_id')::uuid; s public.crm_stages; lid uuid; BEGIN
IF NOT coalesce(public.lead_company_allowed(cid),false) THEN RAISE EXCEPTION 'Company lead access denied'; END IF;
SELECT * INTO s FROM public.crm_stages WHERE id=(_payload->>'stage_id')::uuid AND kind='lead' AND is_active AND (company_id IS NULL OR company_id=cid) FOR SHARE;
IF NOT FOUND THEN RAISE EXCEPTION 'Select an active company status'; END IF;
IF length(trim(coalesce(_payload->>'customer_name',''))) NOT BETWEEN 1 AND 200 OR coalesce(_payload->>'phone','') !~ '^\+[1-9][0-9]{6,14}$' THEN RAISE EXCEPTION 'Enter valid customer details'; END IF;
IF (s.board_closed AND coalesce(_payload->>'status','') NOT IN ('won','lost')) OR (NOT s.board_closed AND coalesce(_payload->>'status','')<>'open') THEN RAISE EXCEPTION 'Invalid stage outcome'; END IF;
IF nullif(_payload->>'source_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.crm_options WHERE id=(_payload->>'source_id')::uuid AND category='source' AND is_active) THEN RAISE EXCEPTION 'Invalid source'; END IF;
INSERT INTO public.leads(company_id,pipeline_id,stage_id,source_id,customer_name,phone,email,business_name,status,form_answers,assigned_to,created_by) VALUES(cid,s.pipeline_id,s.id,nullif(_payload->>'source_id','')::uuid,trim(_payload->>'customer_name'),_payload->>'phone',coalesce(_payload->>'email',''),coalesce(_payload->>'business_name',''),_payload->>'status',coalesce(_payload->'form_answers','{}'::jsonb),auth.uid(),auth.uid()) RETURNING id INTO lid; RETURN lid; END $$;
REVOKE ALL ON FUNCTION public.user_board_lead_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_board_lead_create(jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.user_board_lead_delete(_id uuid,_updated_at timestamptz) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.leads; BEGIN
SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
IF NOT FOUND OR auth.uid() IS NULL OR l.assigned_to IS DISTINCT FROM auth.uid() OR NOT coalesce(public.lead_company_allowed(l.company_id),false) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
IF l.updated_at IS DISTINCT FROM _updated_at THEN RAISE EXCEPTION 'Lead changed. Refresh before deleting'; END IF;
IF EXISTS(SELECT 1 FROM public.deals WHERE lead_id=l.id) OR EXISTS(SELECT 1 FROM public.crm_work_items WHERE lead_id=l.id) OR EXISTS(SELECT 1 FROM public.sales_proposals WHERE lead_id=l.id) OR EXISTS(SELECT 1 FROM public.lead_assignment_events WHERE lead_id=l.id) OR EXISTS(SELECT 1 FROM public.automation_executions WHERE lead_id=l.id) OR EXISTS(SELECT 1 FROM public.whatsapp_conversations WHERE lead_id=l.id) THEN RAISE EXCEPTION 'Lead has linked history and cannot be deleted'; END IF;
DELETE FROM public.leads WHERE id=l.id; RETURN l.id; END $$;
REVOKE ALL ON FUNCTION public.user_board_lead_delete(uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_board_lead_delete(uuid,timestamptz) TO authenticated,service_role;