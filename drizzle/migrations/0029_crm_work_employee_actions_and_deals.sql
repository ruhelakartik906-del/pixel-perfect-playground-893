ALTER TABLE public.crm_work_items ADD COLUMN deal_id uuid REFERENCES public.deals(id);
ALTER TABLE public.crm_work_items ADD CONSTRAINT crm_work_related_record CHECK (deal_id IS NULL OR (kind='task' AND lead_id IS NULL));
CREATE OR REPLACE FUNCTION public.crm_work_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE old_row public.crm_work_items; new_row public.crm_work_items; item_id uuid; event text:=_action; company uuid; assignee uuid; lead uuid; item_kind text; deal uuid; is_admin boolean:=public.routing_admin();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _action NOT IN ('save','status','delete') THEN RAISE EXCEPTION 'Unsupported action'; END IF;
 item_id:=nullif(_payload->>'id','')::uuid;
 IF item_id IS NOT NULL THEN
  SELECT * INTO old_row FROM public.crm_work_items WHERE id=item_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF NOT is_admin AND (old_row.assigned_to<>auth.uid() OR NOT public.routing_eligible(auth.uid(),old_row.company_id)) THEN RAISE EXCEPTION 'Not authorized for this record'; END IF;
  IF (_payload->>'version') IS NULL OR (_payload->>'version')::integer<>old_row.version THEN RAISE EXCEPTION 'This record changed. Refresh before saving.'; END IF;
 END IF;
 IF _action='save' THEN
  company:=(_payload->>'company_id')::uuid; assignee:=(_payload->>'assigned_to')::uuid; lead:=nullif(_payload->>'lead_id','')::uuid; item_kind:=_payload->>'kind'; deal:=nullif(_payload->>'deal_id','')::uuid;
  IF NOT is_admin AND (assignee<>auth.uid() OR NOT public.routing_eligible(auth.uid(),company)) THEN RAISE EXCEPTION 'Only your own company-authorized work may be managed'; END IF;
  IF item_kind IS NULL OR item_kind NOT IN ('task','follow_up') THEN RAISE EXCEPTION 'Invalid record type'; END IF;
  IF item_id IS NOT NULL AND (old_row.kind<>item_kind OR old_row.company_id<>company) THEN RAISE EXCEPTION 'Record type and company cannot change'; END IF;
  IF assignee IS NULL OR company IS NULL OR NOT public.routing_eligible(assignee,company) THEN RAISE EXCEPTION 'Select an active eligible company employee'; END IF;
  IF lead IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads WHERE id=lead AND company_id=company) THEN RAISE EXCEPTION 'Lead must belong to the selected company'; END IF;
  IF lead IS NOT NULL AND NOT is_admin AND NOT EXISTS(SELECT 1 FROM public.leads WHERE id=lead AND assigned_to=auth.uid()) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
  IF deal IS NOT NULL AND (item_kind<>'task' OR lead IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.deals WHERE id=deal AND company_id=company AND (is_admin OR assigned_to=auth.uid()))) THEN RAISE EXCEPTION 'Invalid related deal'; END IF;
  IF item_id IS NULL THEN
   INSERT INTO public.crm_work_items(kind,company_id,lead_id,deal_id,assigned_to,title,notes,priority,status,start_date,due_date,scheduled_at,interaction_type,created_by)
   VALUES(item_kind,company,lead,deal,assignee,trim(_payload->>'title'),coalesce(_payload->>'notes',''),_payload->>'priority',_payload->>'status',nullif(_payload->>'start_date','')::date,nullif(_payload->>'due_date','')::date,nullif(_payload->>'scheduled_at','')::timestamptz,nullif(_payload->>'interaction_type',''),auth.uid()) RETURNING * INTO new_row;
   item_id:=new_row.id; event:='created';
  ELSE
   UPDATE public.crm_work_items SET lead_id=lead,deal_id=deal,assigned_to=assignee,title=trim(_payload->>'title'),notes=coalesce(_payload->>'notes',''),priority=_payload->>'priority',status=_payload->>'status',start_date=nullif(_payload->>'start_date','')::date,due_date=nullif(_payload->>'due_date','')::date,scheduled_at=nullif(_payload->>'scheduled_at','')::timestamptz,interaction_type=nullif(_payload->>'interaction_type',''),updated_at=now(),version=version+1 WHERE id=item_id RETURNING * INTO new_row;
   event:=CASE WHEN old_row.kind='follow_up' AND old_row.scheduled_at IS DISTINCT FROM new_row.scheduled_at THEN 'rescheduled' ELSE 'updated' END;
  END IF;
 ELSE
  IF item_id IS NULL THEN RAISE EXCEPTION 'Record required'; END IF;
  IF _action='delete' THEN UPDATE public.crm_work_items SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=item_id RETURNING * INTO new_row;
  ELSE UPDATE public.crm_work_items SET status=_payload->>'status',updated_at=now(),version=version+1 WHERE id=item_id RETURNING * INTO new_row; END IF;
 END IF;
 INSERT INTO public.crm_work_history(work_id,actor_id,action,before_record,after_record) VALUES(item_id,auth.uid(),event,CASE WHEN old_row.id IS NULL THEN NULL ELSE to_jsonb(old_row) END,to_jsonb(new_row));
 RETURN item_id;
END $fn$;
REVOKE ALL ON FUNCTION public.crm_work_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_work_action(text,jsonb) TO authenticated,service_role;