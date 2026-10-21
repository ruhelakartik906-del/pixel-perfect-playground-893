CREATE OR REPLACE FUNCTION public.lead_status_allowed(_action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT auth.uid() IS NOT NULL AND _action IN ('create','edit','delete','reorder') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (public.routing_admin() OR (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('employee','manager','client')) AND EXISTS(SELECT 1 FROM public.company_members m JOIN public.companies c ON c.id=m.company_id WHERE m.user_id=auth.uid() AND c.is_active AND public.user_crm_company(c.id)) AND EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=auth.uid() AND ('lead_status.'||CASE WHEN _action='reorder' THEN 'edit' ELSE _action END)=ANY(r.permissions))))
$$;
REVOKE ALL ON FUNCTION public.lead_status_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_status_allowed(text) TO authenticated,service_role;
COMMENT ON FUNCTION public.lead_status_allowed(text) IS 'Shared global stage management requires an explicit lead_status action grant and active authorized company membership; lead edit permission alone is insufficient.';
CREATE OR REPLACE FUNCTION public.lead_status_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.crm_stages; pid uuid; sid uuid; ids uuid[]; expected uuid[]; BEGIN
IF NOT public.lead_status_allowed(_action) THEN RAISE EXCEPTION 'Shared lead status permission required'; END IF;
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