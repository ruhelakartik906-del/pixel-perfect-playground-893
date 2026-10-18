CREATE TABLE public.user_work_grid_settings (owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('task','follow_up')), settings jsonb NOT NULL DEFAULT '{}'::jsonb, custom_values jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,kind));
GRANT SELECT ON public.user_work_grid_settings TO authenticated;
GRANT ALL ON public.user_work_grid_settings TO service_role;
ALTER TABLE public.user_work_grid_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY grid_owner_read ON public.user_work_grid_settings FOR SELECT TO authenticated USING (public.user_workspace_allowed() AND (owner_id=auth.uid() OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY work_table_admin_oversight ON public.user_work_tables FOR SELECT TO authenticated USING (public.user_workspace_allowed() AND public.has_role(auth.uid(),'super_admin'));
CREATE POLICY work_row_admin_oversight ON public.user_work_rows FOR SELECT TO authenticated USING (public.user_workspace_allowed() AND public.has_role(auth.uid(),'super_admin'));
CREATE FUNCTION public.user_work_grid_save(_kind text, _settings jsonb DEFAULT NULL, _record uuid DEFAULT NULL, _column text DEFAULT NULL, _value jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT public.user_workspace_allowed() OR _kind NOT IN ('task','follow_up') THEN RAISE EXCEPTION 'Grid access denied'; END IF;
INSERT INTO public.user_work_grid_settings(owner_id,kind) VALUES(auth.uid(),_kind) ON CONFLICT DO NOTHING;
PERFORM 1 FROM public.user_work_grid_settings WHERE owner_id=auth.uid() AND kind=_kind FOR UPDATE;
IF _settings IS NOT NULL THEN
IF jsonb_typeof(_settings)<>'object' THEN RAISE EXCEPTION 'Invalid settings'; END IF;
UPDATE public.user_work_grid_settings SET settings=_settings,updated_at=now() WHERE owner_id=auth.uid() AND kind=_kind;
ELSE
IF _record IS NULL OR _column IS NULL OR length(_column)>200 OR NOT (EXISTS(SELECT 1 FROM public.personal_crm_tasks WHERE id=_record AND owner_id=auth.uid() AND kind=_kind AND deleted_at IS NULL) OR EXISTS(SELECT 1 FROM public.crm_work_items WHERE id=_record AND assigned_to=auth.uid() AND kind=_kind AND deleted_at IS NULL AND public.routing_eligible(auth.uid(),company_id))) THEN RAISE EXCEPTION 'Record access denied'; END IF;
UPDATE public.user_work_grid_settings SET custom_values=jsonb_set(custom_values,ARRAY[_record::text],coalesce(custom_values->_record::text,'{}'::jsonb)||jsonb_build_object(_column,_value),true),updated_at=now() WHERE owner_id=auth.uid() AND kind=_kind;
END IF;
END $$;
REVOKE ALL ON FUNCTION public.user_work_grid_save(text,jsonb,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.user_work_grid_save(text,jsonb,uuid,text,jsonb) TO authenticated;