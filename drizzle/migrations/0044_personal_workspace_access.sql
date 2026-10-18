CREATE OR REPLACE FUNCTION public.user_workspace_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked') $$;

ALTER TABLE public.personal_crm_tasks ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'task';
ALTER TABLE public.personal_crm_tasks ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.personal_crm_tasks ADD COLUMN IF NOT EXISTS interaction_type text;
ALTER TABLE public.personal_crm_tasks ADD CONSTRAINT personal_task_kind_chk CHECK (kind IN ('task','follow_up') AND (interaction_type IS NULL OR interaction_type IN ('call','whatsapp','email','meeting')));

CREATE OR REPLACE FUNCTION public.user_work_action(_action text, _payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE oldrow public.personal_crm_tasks; newrow public.personal_crm_tasks; result uuid; k text; BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Active workspace access required'; END IF;
IF NOT public.user_checklist_valid(coalesce(_payload->'checklist','[]')) THEN RAISE EXCEPTION 'Invalid checklist'; END IF;
IF coalesce(_payload->>'origin','company')='company' THEN
result:=public.crm_work_action(_action,_payload);
IF _action='save' THEN UPDATE public.crm_work_items SET checklist=coalesce(_payload->'checklist','[]') WHERE id=result; UPDATE public.crm_work_history SET after_record=(SELECT to_jsonb(w) FROM public.crm_work_items w WHERE w.id=result) WHERE id=(SELECT id FROM public.crm_work_history WHERE work_id=result ORDER BY created_at DESC,id DESC LIMIT 1); END IF;
RETURN result; END IF;
IF nullif(_payload->>'id','') IS NOT NULL THEN SELECT * INTO oldrow FROM public.personal_crm_tasks WHERE id=(_payload->>'id')::uuid AND owner_id=auth.uid() AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Personal task access denied'; END IF; IF oldrow.version<>coalesce((_payload->>'version')::integer,0) THEN RAISE EXCEPTION 'Task changed. Refresh before saving'; END IF; END IF;
IF _action='save' THEN
k:=coalesce(_payload->>'kind','task');
IF k NOT IN ('task','follow_up') OR nullif(_payload->>'lead_id','') IS NOT NULL OR nullif(_payload->>'deal_id','') IS NOT NULL THEN RAISE EXCEPTION 'Linked records must use their authorized company'; END IF;
IF k='follow_up' AND nullif(_payload->>'scheduled_at','') IS NULL THEN RAISE EXCEPTION 'Follow-ups need a scheduled time'; END IF;
IF oldrow.id IS NULL THEN INSERT INTO public.personal_crm_tasks(owner_id,kind,title,notes,priority,status,start_date,due_date,scheduled_at,interaction_type,checklist) VALUES(auth.uid(),k,trim(_payload->>'title'),coalesce(_payload->>'notes',''),_payload->>'priority',_payload->>'status',coalesce(nullif(_payload->>'start_date','')::date,(nullif(_payload->>'scheduled_at','')::timestamptz AT TIME ZONE 'Asia/Kolkata')::date),coalesce(nullif(_payload->>'due_date','')::date,(nullif(_payload->>'scheduled_at','')::timestamptz AT TIME ZONE 'Asia/Kolkata')::date),nullif(_payload->>'scheduled_at','')::timestamptz,nullif(_payload->>'interaction_type',''),coalesce(_payload->'checklist','[]')) RETURNING * INTO newrow;
ELSE UPDATE public.personal_crm_tasks SET title=trim(_payload->>'title'),notes=coalesce(_payload->>'notes',''),priority=_payload->>'priority',status=_payload->>'status',start_date=coalesce(nullif(_payload->>'start_date','')::date,(nullif(_payload->>'scheduled_at','')::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,start_date),due_date=coalesce(nullif(_payload->>'due_date','')::date,(nullif(_payload->>'scheduled_at','')::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,due_date),scheduled_at=nullif(_payload->>'scheduled_at','')::timestamptz,interaction_type=nullif(_payload->>'interaction_type',''),checklist=coalesce(_payload->'checklist','[]'),version=version+1,updated_at=now() WHERE id=oldrow.id RETURNING * INTO newrow; END IF;
ELSIF oldrow.id IS NULL THEN RAISE EXCEPTION 'Task required';
ELSIF _action='delete' THEN UPDATE public.personal_crm_tasks SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=oldrow.id RETURNING * INTO newrow;
ELSIF _action='status' THEN UPDATE public.personal_crm_tasks SET status=_payload->>'status',updated_at=now(),version=version+1 WHERE id=oldrow.id RETURNING * INTO newrow;
ELSE RAISE EXCEPTION 'Unsupported task action'; END IF;
INSERT INTO public.personal_task_history(task_id,actor_id,action,before_record,after_record) VALUES(newrow.id,auth.uid(),CASE WHEN oldrow.id IS NULL THEN 'created' ELSE _action END,CASE WHEN oldrow.id IS NULL THEN NULL ELSE to_jsonb(oldrow) END,to_jsonb(newrow)); RETURN newrow.id; END $function$;

-- personal deals: company_id NULL, owned by creator
CREATE OR REPLACE FUNCTION public.user_deal_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.routing_admin() THEN
IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.contract_type_id IS DISTINCT FROM OLD.contract_type_id OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND OLD.created_by IS DISTINCT FROM auth.uid())) THEN RAISE EXCEPTION 'Protected deal ownership cannot change'; END IF;
IF NEW.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Deal access denied'; END IF;
IF NEW.company_id IS NULL THEN
 IF NEW.created_by IS DISTINCT FROM auth.uid() OR NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Deal access denied'; END IF;
 IF NEW.lead_id IS NOT NULL THEN RAISE EXCEPTION 'Personal deals cannot link company leads'; END IF;
ELSE
 IF NOT public.user_crm_company(NEW.company_id) THEN RAISE EXCEPTION 'Deal access denied'; END IF;
 IF NEW.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=NEW.lead_id AND l.assigned_to=auth.uid() AND l.company_id=NEW.company_id) THEN RAISE EXCEPTION 'Related lead access denied'; END IF;
END IF;
IF NOT EXISTS(SELECT 1 FROM public.crm_stages s JOIN public.crm_pipelines p ON p.id=s.pipeline_id WHERE s.id=NEW.stage_id AND s.kind='deal' AND s.is_active AND s.pipeline_id=NEW.pipeline_id AND p.is_active) THEN RAISE EXCEPTION 'Select an active deal stage'; END IF;
IF NEW.status NOT IN ('open','won','lost') OR NEW.amount<0 OR NEW.negotiated_amount<0 OR NEW.final_amount<0 OR NEW.currency !~ '^[A-Z]{3}$' OR length(NEW.notes)>5000 OR length(NEW.description)>5000 OR length(trim(NEW.title))=0 THEN RAISE EXCEPTION 'Invalid deal values'; END IF;
END IF; RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.user_deal_action(_action text, _payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE d public.deals; result uuid; stage uuid; pipeline uuid; company uuid; lead uuid; BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Active sales workspace access required'; END IF;
IF nullif(_payload->>'id','') IS NOT NULL THEN SELECT * INTO d FROM public.deals WHERE id=(_payload->>'id')::uuid AND assigned_to=auth.uid() AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND OR (d.company_id IS NULL AND d.created_by IS DISTINCT FROM auth.uid()) OR (d.company_id IS NOT NULL AND NOT public.user_crm_company(d.company_id)) THEN RAISE EXCEPTION 'Deal access denied'; END IF; IF d.updated_at IS DISTINCT FROM (_payload->>'updated_at')::timestamptz THEN RAISE EXCEPTION 'Deal changed. Refresh before saving'; END IF; END IF;
IF _action='delete' THEN IF d.id IS NULL OR d.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only your own created deal may be deleted'; END IF; UPDATE public.deals SET deleted_at=now() WHERE id=d.id; RETURN d.id;
ELSIF _action='note' THEN IF d.id IS NULL OR length(trim(coalesce(_payload->>'note','')))=0 OR length(_payload->>'note')>5000 THEN RAISE EXCEPTION 'Valid note required'; END IF; UPDATE public.deals SET notes=left(notes||CASE WHEN notes='' THEN '' ELSE E'\n' END||trim(_payload->>'note'),5000) WHERE id=d.id; RETURN d.id;
ELSIF _action='status' THEN IF d.id IS NULL OR coalesce(_payload->>'status','') NOT IN ('open','won','lost') THEN RAISE EXCEPTION 'Valid status required'; END IF; UPDATE public.deals SET status=_payload->>'status',actual_close_date=CASE WHEN _payload->>'status' IN ('won','lost') THEN (now() AT TIME ZONE 'Asia/Kolkata')::date ELSE actual_close_date END WHERE id=d.id; RETURN d.id;
ELSIF _action<>'save' THEN RAISE EXCEPTION 'Unsupported deal action'; END IF;
company:=CASE WHEN d.id IS NOT NULL THEN d.company_id ELSE nullif(_payload->>'company_id','')::uuid END; lead:=nullif(_payload->>'lead_id','')::uuid; stage:=(_payload->>'stage_id')::uuid;
IF company IS NOT NULL AND NOT public.user_crm_company(company) THEN RAISE EXCEPTION 'Company access denied'; END IF;
IF company IS NULL AND lead IS NOT NULL THEN RAISE EXCEPTION 'Personal deals cannot link company leads'; END IF;
SELECT pipeline_id INTO pipeline FROM public.crm_stages WHERE id=stage AND kind='deal' AND is_active;
IF pipeline IS NULL OR (d.id IS NOT NULL AND d.pipeline_id IS DISTINCT FROM pipeline) THEN RAISE EXCEPTION 'Select a stage in the authorized pipeline'; END IF;
IF d.id IS NULL THEN INSERT INTO public.deals(company_id,lead_id,pipeline_id,stage_id,title,amount,assigned_to,created_by) VALUES(company,lead,pipeline,stage,trim(_payload->>'title'),(_payload->>'amount')::numeric,auth.uid(),auth.uid()) RETURNING id INTO result; ELSE result:=d.id; END IF;
UPDATE public.deals SET lead_id=lead,stage_id=stage,title=trim(_payload->>'title'),amount=(_payload->>'amount')::numeric,service_name=coalesce(_payload->>'service_name',''),description=coalesce(_payload->>'description',''),negotiated_amount=nullif(_payload->>'negotiated_amount','')::numeric,final_amount=nullif(_payload->>'final_amount','')::numeric,currency=upper(_payload->>'currency'),expected_close_date=nullif(_payload->>'expected_close_date','')::date,actual_close_date=nullif(_payload->>'actual_close_date','')::date,notes=coalesce(_payload->>'notes',''),lost_reason=coalesce(_payload->>'lost_reason',''),status=_payload->>'status' WHERE id=result; RETURN result;
END $function$;

CREATE POLICY "Owners read personal deals" ON public.deals FOR SELECT TO authenticated USING (company_id IS NULL AND assigned_to=auth.uid() AND created_by=auth.uid() AND public.user_workspace_allowed());

-- support: any non-blocked signed-in user
CREATE OR REPLACE FUNCTION public.support_action(_action text, _payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.profiles; t public.support_tickets; cid uuid; mid uuid; aid uuid; adm boolean; field text; value text;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked';
 IF p.id IS NULL THEN RAISE EXCEPTION 'Active authenticated account required'; END IF;
 adm:=public.support_admin();
 IF _action='create' THEN
  cid:=NULLIF(_payload->>'company_id','')::uuid;
  IF cid IS NULL THEN
   IF (SELECT count(*) FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id AND c.is_active WHERE cm.user_id=p.id)>1 THEN RAISE EXCEPTION 'Choose your company'; END IF;
   SELECT cm.company_id INTO cid FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id AND c.is_active WHERE cm.user_id=p.id LIMIT 1;
  END IF;
  IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id AND c.is_active WHERE cm.company_id=cid AND cm.user_id=p.id) THEN RAISE EXCEPTION 'Company membership required'; END IF;
  IF length(trim(coalesce(_payload->>'subject','')))=0 OR length(_payload->>'subject')>200 OR length(trim(coalesce(_payload->>'description','')))=0 OR length(_payload->>'description')>10000 THEN RAISE EXCEPTION 'Subject and description required'; END IF;
  INSERT INTO public.support_tickets(user_id,user_name,user_email,company_id,subject,category,priority,description) VALUES(p.id,p.full_name,p.email,cid,trim(_payload->>'subject'),_payload->>'category',_payload->>'priority',trim(_payload->>'description')) RETURNING * INTO t;
 ELSE
  SELECT * INTO t FROM public.support_tickets WHERE id=(_payload->>'id')::uuid FOR UPDATE;
  IF t.id IS NULL OR NOT public.support_access(t.id) THEN RAISE EXCEPTION 'Ticket not found or access denied'; END IF;
  IF _action='reply' THEN
   IF coalesce((_payload->>'admin')::boolean,false) AND NOT adm THEN RAISE EXCEPTION 'Super Admin required'; END IF;
   IF NOT coalesce((_payload->>'admin')::boolean,false) THEN
    IF t.user_id<>p.id THEN RAISE EXCEPTION 'Owner required'; END IF;
    adm:=false;
   END IF;
   IF coalesce((_payload->>'private')::boolean,false) AND NOT adm THEN RAISE EXCEPTION 'Private notes require Super Admin'; END IF;
   IF length(trim(coalesce(_payload->>'body','')))=0 OR length(_payload->>'body')>10000 THEN RAISE EXCEPTION 'Message required'; END IF;
   IF t.status IN ('Resolved','Closed') AND NOT adm THEN RAISE EXCEPTION 'Reopen ticket before replying'; END IF;
   INSERT INTO public.support_messages(ticket_id,sender_id,sender_name,sender_role,body,is_private) VALUES(t.id,p.id,p.full_name,CASE WHEN adm THEN 'admin' ELSE 'user' END,trim(_payload->>'body'),coalesce((_payload->>'private')::boolean,false)) RETURNING id INTO mid;
   UPDATE public.support_tickets SET updated_at=now(),last_admin_message_at=CASE WHEN adm AND NOT coalesce((_payload->>'private')::boolean,false) THEN now() ELSE last_admin_message_at END,last_user_message_at=CASE WHEN NOT adm THEN now() ELSE last_user_message_at END WHERE id=t.id;
   IF coalesce((_payload->>'private')::boolean,false) THEN RETURN mid; END IF;
  ELSIF _action='status' OR _action='priority' THEN
   IF NOT adm THEN RAISE EXCEPTION 'Super Admin required'; END IF;
   value:=_payload->>'value';
   IF _action='status' THEN UPDATE public.support_tickets SET status=value,updated_at=now() WHERE id=t.id;
   ELSE UPDATE public.support_tickets SET priority=value,updated_at=now() WHERE id=t.id; END IF;
  ELSIF _action='reopen' THEN
   IF t.user_id<>p.id OR t.status NOT IN ('Resolved','Closed') THEN RAISE EXCEPTION 'Only the owner may reopen a resolved or closed ticket'; END IF;
   UPDATE public.support_tickets SET status='Open',updated_at=now(),last_user_message_at=now() WHERE id=t.id;
  ELSIF _action='read' THEN
   IF coalesce((_payload->>'admin')::boolean,false) THEN
    IF NOT adm THEN RAISE EXCEPTION 'Super Admin required'; END IF;
    UPDATE public.support_tickets SET admin_read_at=now() WHERE id=t.id;
   ELSE
    IF t.user_id<>p.id THEN RAISE EXCEPTION 'Owner required'; END IF;
    UPDATE public.support_tickets SET user_read_at=now() WHERE id=t.id;
   END IF;
   RETURN t.id;
  ELSIF _action='attachment' THEN
   IF left(_payload->>'path',length(t.id::text)+1)<>t.id::text||'/' THEN RAISE EXCEPTION 'Invalid attachment path'; END IF;
   mid:=NULLIF(_payload->>'message_id','')::uuid;
   IF mid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.support_messages WHERE id=mid AND ticket_id=t.id AND sender_id=p.id) THEN RAISE EXCEPTION 'Invalid attachment message'; END IF;
   INSERT INTO public.support_attachments(ticket_id,message_id,uploaded_by,filename,path,mime,size) VALUES(t.id,mid,p.id,_payload->>'filename',_payload->>'path',_payload->>'mime',(_payload->>'size')::bigint) RETURNING id INTO aid;
  ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 END IF;
 INSERT INTO public.support_ticket_events(ticket_id,actor_id,action,detail) VALUES(t.id,p.id,_action,CASE WHEN _action IN ('status','priority') THEN jsonb_build_object('before',CASE WHEN _action='status' THEN t.status ELSE t.priority END,'after',value) ELSE '{}'::jsonb END);
 RETURN coalesce(mid,aid,t.id);
END $function$;

-- personal WhatsApp template drafts (company_id NULL, owner only)
CREATE POLICY "Owners manage personal template drafts" ON public.whatsapp_templates FOR ALL TO authenticated
 USING (company_id IS NULL AND created_by=auth.uid() AND public.user_workspace_allowed())
 WITH CHECK (company_id IS NULL AND created_by=auth.uid() AND status='draft' AND sync_status='not_synced' AND public.user_workspace_allowed());

-- personal attendance (separate from official company attendance)
CREATE TABLE public.personal_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 attendance_date date NOT NULL,
 check_in timestamptz NOT NULL DEFAULT now(),
 check_out timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id, attendance_date)
);
GRANT SELECT ON public.personal_attendance TO authenticated;
GRANT ALL ON public.personal_attendance TO service_role;
ALTER TABLE public.personal_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin attendance read" ON public.personal_attendance FOR SELECT TO authenticated USING (owner_id=auth.uid() OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.personal_attendance_action(_action text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE d date:=(now() AT TIME ZONE 'Asia/Kolkata')::date; a public.personal_attendance; BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Sign in required'; END IF;
SELECT * INTO a FROM public.personal_attendance WHERE owner_id=auth.uid() AND attendance_date=d FOR UPDATE;
IF _action='check_in' THEN IF a.id IS NOT NULL THEN RAISE EXCEPTION 'Already checked in today'; END IF;
 INSERT INTO public.personal_attendance(owner_id,attendance_date) VALUES(auth.uid(),d) RETURNING * INTO a;
ELSIF _action='check_out' THEN IF a.id IS NULL OR a.check_out IS NOT NULL THEN RAISE EXCEPTION 'Check in once before checking out once'; END IF;
 UPDATE public.personal_attendance SET check_out=now() WHERE id=a.id;
ELSE RAISE EXCEPTION 'Unsupported action'; END IF; RETURN a.id; END $$;
REVOKE ALL ON FUNCTION public.personal_attendance_action(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.personal_attendance_action(text) TO authenticated;