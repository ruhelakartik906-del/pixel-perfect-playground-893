CREATE FUNCTION public.spreadsheet_commit(_page text,_draft uuid,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.user_work_grid_settings; result uuid; custom jsonb:='{}'; c jsonb;
BEGIN
IF NOT public.user_workspace_allowed() OR _page NOT IN ('task','follow_up','admin_task','admin_follow_up') OR (_page LIKE 'admin_%' AND NOT public.routing_admin()) THEN RAISE EXCEPTION 'Grid access denied'; END IF;
SELECT * INTO g FROM public.user_work_grid_settings WHERE owner_id=auth.uid() AND kind=_page FOR UPDATE;
IF NOT FOUND OR g.drafts->_draft::text IS NULL THEN RAISE EXCEPTION 'Draft already saved or removed'; END IF;
IF _payload->>'kind' IS DISTINCT FROM replace(_page,'admin_','') OR nullif(_payload->>'id','') IS NOT NULL THEN RAISE EXCEPTION 'Invalid draft record'; END IF;
IF _page LIKE 'admin_%' AND nullif(_payload->>'assigned_to','') IS NULL THEN RAISE EXCEPTION 'Select an eligible active user'; END IF;
result:=public.user_work_action('save',_payload);
FOR c IN SELECT * FROM jsonb_array_elements(coalesce(g.settings->'columns','[]')) LOOP
IF c->>'custom'='true' AND g.drafts->_draft::text ? (c->>'id') THEN custom:=custom||jsonb_build_object(c->>'id',g.drafts->_draft::text->(c->>'id')); END IF;
END LOOP;
UPDATE public.user_work_grid_settings SET drafts=drafts-_draft::text,custom_values=jsonb_set(custom_values,ARRAY[result::text],custom,true),updated_at=now() WHERE owner_id=auth.uid() AND kind=_page;
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.spreadsheet_commit(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spreadsheet_commit(text,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.spreadsheet_table_cell(_table uuid,_row uuid,_field text,_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.user_work_tables; r public.user_work_rows;
BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Workspace access required'; END IF;
SELECT * INTO t FROM public.user_work_tables WHERE id=_table AND owner_id=auth.uid() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Private table access denied'; END IF;
IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'id'=_field) THEN RAISE EXCEPTION 'Column not found'; END IF;
SELECT * INTO r FROM public.user_work_rows WHERE id=_row AND table_id=_table FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Row not found'; END IF;
RETURN public.user_table_action('save_row',jsonb_build_object('table_id',_table,'id',_row,'version',r.version,'values',r.values||jsonb_build_object(_field,_value),'lead_id',r.lead_id,'deal_id',r.deal_id,'task_id',r.task_id));
END $$;
REVOKE ALL ON FUNCTION public.spreadsheet_table_cell(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.spreadsheet_table_cell(uuid,uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.personal_work_creator_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid(); ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Original creator is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER personal_work_creator_guard BEFORE INSERT OR UPDATE ON public.personal_crm_tasks FOR EACH ROW EXECUTE FUNCTION public.personal_work_creator_guard();