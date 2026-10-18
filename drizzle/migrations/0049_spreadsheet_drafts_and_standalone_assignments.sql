ALTER TABLE public.personal_crm_tasks ADD COLUMN created_by uuid REFERENCES public.profiles(id), ADD COLUMN customer_name text NOT NULL DEFAULT '', ADD COLUMN customer_phone text NOT NULL DEFAULT '';
UPDATE public.personal_crm_tasks SET created_by=owner_id WHERE created_by IS NULL;
ALTER TABLE public.personal_crm_tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.user_work_grid_settings ADD COLUMN drafts jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.user_work_grid_settings DROP CONSTRAINT user_work_grid_settings_kind_check;
ALTER TABLE public.user_work_grid_settings ADD CONSTRAINT user_work_grid_settings_kind_check CHECK(kind IN ('task','follow_up','admin_task','admin_follow_up'));
CREATE OR REPLACE FUNCTION public.user_work_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oldrow public.personal_crm_tasks; newrow public.personal_crm_tasks; result uuid; k text; recipient uuid; admin boolean:=public.routing_admin(); sd date; dd date; scheduled timestamptz;
BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Workspace access required'; END IF;
IF NOT public.user_checklist_valid(coalesce(_payload->'checklist','[]')) THEN RAISE EXCEPTION 'Invalid checklist'; END IF;
IF coalesce(_payload->>'origin','company')='company' THEN
result:=public.crm_work_action(_action,_payload);
IF _action='save' THEN UPDATE public.crm_work_items SET checklist=coalesce(_payload->'checklist','[]') WHERE id=result; UPDATE public.crm_work_history SET after_record=(SELECT to_jsonb(w) FROM public.crm_work_items w WHERE w.id=result) WHERE id=(SELECT id FROM public.crm_work_history WHERE work_id=result ORDER BY created_at DESC,id DESC LIMIT 1); END IF;
RETURN result; END IF;
IF nullif(_payload->>'id','') IS NOT NULL THEN
SELECT * INTO oldrow FROM public.personal_crm_tasks WHERE id=(_payload->>'id')::uuid AND (owner_id=auth.uid() OR admin) AND deleted_at IS NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Personal work access denied'; END IF;
IF oldrow.version<>coalesce((_payload->>'version')::integer,0) THEN RAISE EXCEPTION 'Record changed. Refresh before saving'; END IF;
END IF;
IF _action='save' THEN
k:=coalesce(_payload->>'kind','task'); recipient:=coalesce(nullif(_payload->>'assigned_to','')::uuid,oldrow.owner_id,auth.uid());
IF NOT admin AND recipient IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Reassignment denied'; END IF;
IF oldrow.id IS NOT NULL AND k IS DISTINCT FROM oldrow.kind THEN RAISE EXCEPTION 'Record kind cannot change'; END IF;
IF (oldrow.id IS NULL AND recipient<>auth.uid()) OR (oldrow.id IS NOT NULL AND recipient<>oldrow.owner_id) THEN
IF NOT admin OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=recipient AND account_status='active') THEN RAISE EXCEPTION 'Select an eligible active user'; END IF;
END IF;
IF k NOT IN ('task','follow_up') OR nullif(_payload->>'lead_id','') IS NOT NULL OR nullif(_payload->>'deal_id','') IS NOT NULL THEN RAISE EXCEPTION 'Linked records must use their authorized company'; END IF;
scheduled:=nullif(_payload->>'scheduled_at','')::timestamptz;
sd:=nullif(_payload->>'start_date','')::date; dd:=nullif(_payload->>'due_date','')::date;
IF k='task' AND (sd IS NULL OR dd IS NULL OR dd<sd OR scheduled IS NOT NULL OR nullif(_payload->>'interaction_type','') IS NOT NULL OR coalesce(_payload->>'status','') NOT IN ('not_started','in_progress','completed')) THEN RAISE EXCEPTION 'Tasks require valid start/due dates and status'; END IF;
IF k='follow_up' AND (scheduled IS NULL OR coalesce(_payload->>'interaction_type','') NOT IN ('call','whatsapp','email','meeting') OR coalesce(_payload->>'status','') NOT IN ('scheduled','completed','skipped')) THEN RAISE EXCEPTION 'Follow-ups require schedule, interaction and valid status'; END IF;
IF k='follow_up' THEN sd:=(scheduled AT TIME ZONE 'Asia/Kolkata')::date;dd:=sd; END IF;
IF length(coalesce(_payload->>'customer_name',''))>200 OR length(coalesce(_payload->>'customer_phone',''))>100 THEN RAISE EXCEPTION 'Customer details are too long'; END IF;
IF oldrow.id IS NULL THEN
INSERT INTO public.personal_crm_tasks(owner_id,created_by,kind,title,notes,priority,status,start_date,due_date,scheduled_at,interaction_type,checklist,customer_name,customer_phone) VALUES(recipient,auth.uid(),k,trim(_payload->>'title'),coalesce(_payload->>'notes',''),_payload->>'priority',_payload->>'status',sd,dd,scheduled,nullif(_payload->>'interaction_type',''),coalesce(_payload->'checklist','[]'),coalesce(_payload->>'customer_name',''),coalesce(_payload->>'customer_phone','')) RETURNING * INTO newrow;
ELSE UPDATE public.personal_crm_tasks SET owner_id=recipient,title=trim(_payload->>'title'),notes=coalesce(_payload->>'notes',''),priority=_payload->>'priority',status=_payload->>'status',start_date=sd,due_date=dd,scheduled_at=scheduled,interaction_type=nullif(_payload->>'interaction_type',''),checklist=coalesce(_payload->'checklist','[]'),customer_name=coalesce(_payload->>'customer_name',customer_name),customer_phone=coalesce(_payload->>'customer_phone',customer_phone),version=version+1,updated_at=now() WHERE id=oldrow.id RETURNING * INTO newrow; END IF;
ELSIF oldrow.id IS NULL THEN RAISE EXCEPTION 'Record required';
ELSIF _action='delete' THEN
IF NOT admin AND oldrow.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Assigned records cannot be deleted'; END IF;
UPDATE public.personal_crm_tasks SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=oldrow.id RETURNING * INTO newrow;
ELSIF _action='status' THEN UPDATE public.personal_crm_tasks SET status=_payload->>'status',updated_at=now(),version=version+1 WHERE id=oldrow.id RETURNING * INTO newrow;
ELSE RAISE EXCEPTION 'Unsupported work action'; END IF;
INSERT INTO public.personal_task_history(task_id,actor_id,action,before_record,after_record) VALUES(newrow.id,auth.uid(),CASE WHEN oldrow.id IS NULL THEN 'created' ELSE _action END,CASE WHEN oldrow.id IS NULL THEN NULL ELSE to_jsonb(oldrow) END,to_jsonb(newrow));RETURN newrow.id;
END $$;
CREATE FUNCTION public.spreadsheet_grid_action(_page text,_action text,_id uuid DEFAULT NULL,_field text DEFAULT NULL,_value jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; k text;
BEGIN
IF NOT public.user_workspace_allowed() OR _page NOT IN ('task','follow_up','admin_task','admin_follow_up') OR (_page LIKE 'admin_%' AND NOT public.routing_admin()) THEN RAISE EXCEPTION 'Grid access denied';END IF;
INSERT INTO public.user_work_grid_settings(owner_id,kind) VALUES(auth.uid(),_page) ON CONFLICT DO NOTHING;
PERFORM 1 FROM public.user_work_grid_settings WHERE owner_id=auth.uid() AND kind=_page FOR UPDATE;
IF _action='columns' THEN
IF jsonb_typeof(_value)<>'object' THEN RAISE EXCEPTION 'Invalid columns';END IF;
UPDATE public.user_work_grid_settings SET settings=_value,updated_at=now() WHERE owner_id=auth.uid() AND kind=_page;
ELSIF _action='add' THEN
IF _id IS NULL THEN RAISE EXCEPTION 'Draft ID required';END IF;
UPDATE public.user_work_grid_settings SET drafts=jsonb_set(drafts,ARRAY[_id::text],coalesce(drafts->_id::text,_value),true),updated_at=now() WHERE owner_id=auth.uid() AND kind=_page;
ELSIF _action='draft_cell' THEN
SELECT drafts->_id::text INTO d FROM public.user_work_grid_settings WHERE owner_id=auth.uid() AND kind=_page;
IF d IS NULL OR length(_field)>200 THEN RAISE EXCEPTION 'Draft not found';END IF;
UPDATE public.user_work_grid_settings SET drafts=jsonb_set(drafts,ARRAY[_id::text],d||jsonb_build_object(_field,_value),true),updated_at=now() WHERE owner_id=auth.uid() AND kind=_page;
ELSIF _action='delete_draft' THEN
UPDATE public.user_work_grid_settings SET drafts=drafts-_id::text,updated_at=now() WHERE owner_id=auth.uid() AND kind=_page;
ELSIF _action='custom' THEN
k:=replace(_page,'admin_','');
IF NOT (EXISTS(SELECT 1 FROM public.personal_crm_tasks WHERE id=_id AND kind=k AND deleted_at IS NULL AND (owner_id=auth.uid() OR public.routing_admin())) OR EXISTS(SELECT 1 FROM public.crm_work_items WHERE id=_id AND kind=k AND deleted_at IS NULL AND (public.routing_admin() OR (assigned_to=auth.uid() AND public.routing_eligible(auth.uid(),company_id))))) THEN RAISE EXCEPTION 'Record access denied';END IF;
UPDATE public.user_work_grid_settings SET custom_values=jsonb_set(custom_values,ARRAY[_id::text],coalesce(custom_values->_id::text,'{}')||jsonb_build_object(_field,_value),true),updated_at=now() WHERE owner_id=auth.uid() AND kind=_page;
ELSE RAISE EXCEPTION 'Unsupported grid action';END IF;
RETURN (SELECT to_jsonb(g) FROM public.user_work_grid_settings g WHERE owner_id=auth.uid() AND kind=_page);
END $$;
REVOKE ALL ON FUNCTION public.spreadsheet_grid_action(text,text,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spreadsheet_grid_action(text,text,uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.spreadsheet_work_cell(_id uuid,_origin text,_field text,_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payload jsonb; result uuid;
BEGIN
IF NOT public.user_workspace_allowed() OR _field NOT IN ('title','notes','priority','status','start_date','due_date','scheduled_at','interaction_type','customer_name','customer_phone','assigned_to') THEN RAISE EXCEPTION 'Field edit denied';END IF;
IF _origin='personal' THEN
SELECT to_jsonb(w)||jsonb_build_object('origin','personal','assigned_to',w.owner_id,'lead_id',NULL,'deal_id',NULL) INTO payload FROM public.personal_crm_tasks w WHERE w.id=_id AND w.deleted_at IS NULL AND (w.owner_id=auth.uid() OR public.routing_admin()) FOR UPDATE;
ELSE SELECT to_jsonb(w)||jsonb_build_object('origin','company') INTO payload FROM public.crm_work_items w WHERE w.id=_id AND w.deleted_at IS NULL AND (public.routing_admin() OR (w.assigned_to=auth.uid() AND public.routing_eligible(auth.uid(),w.company_id))) FOR UPDATE;END IF;
IF payload IS NULL THEN RAISE EXCEPTION 'Record access denied';END IF;
IF _field='assigned_to' AND NOT public.routing_admin() THEN RAISE EXCEPTION 'Reassignment denied';END IF;
IF _field IN ('customer_name','customer_phone') AND _origin<>'personal' THEN RAISE EXCEPTION 'Edit linked customer through authorized CRM';END IF;
payload:=payload||jsonb_build_object(_field,_value);
RETURN public.user_work_action('save',payload);
END $$;
REVOKE ALL ON FUNCTION public.spreadsheet_work_cell(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spreadsheet_work_cell(uuid,text,text,jsonb) TO authenticated;