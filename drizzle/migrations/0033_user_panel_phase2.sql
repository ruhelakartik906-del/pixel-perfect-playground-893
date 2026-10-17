CREATE OR REPLACE FUNCTION public.user_workspace_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'super_admin')) $$;
REVOKE ALL ON FUNCTION public.user_workspace_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.user_workspace_allowed() TO authenticated,service_role;
ALTER POLICY "Active CRM activity access" ON public.lead_activities USING (EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND (public.routing_admin() OR (l.assigned_to=auth.uid() AND public.user_crm_company(l.company_id))))) WITH CHECK (EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND (public.routing_admin() OR (l.assigned_to=auth.uid() AND public.user_crm_company(l.company_id)))));
CREATE TABLE public.user_work_tables (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL DEFAULT auth.uid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),columns jsonb NOT NULL DEFAULT '[]',preferences jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.user_work_tables TO authenticated; GRANT ALL ON public.user_work_tables TO service_role;
ALTER TABLE public.user_work_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_work_tables ON public.user_work_tables FOR SELECT TO authenticated USING(owner_id=auth.uid() AND public.user_workspace_allowed());
CREATE INDEX user_work_tables_owner ON public.user_work_tables(owner_id,updated_at);
CREATE TABLE public.user_work_rows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),table_id uuid NOT NULL REFERENCES public.user_work_tables(id) ON DELETE CASCADE,values jsonb NOT NULL DEFAULT '{}',lead_id uuid REFERENCES public.leads(id),deal_id uuid REFERENCES public.deals(id),task_id uuid REFERENCES public.crm_work_items(id),position bigint NOT NULL DEFAULT 0,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.user_work_rows TO authenticated; GRANT ALL ON public.user_work_rows TO service_role;
ALTER TABLE public.user_work_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_work_rows ON public.user_work_rows FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.user_work_tables t WHERE t.id=table_id AND t.owner_id=auth.uid() AND public.user_workspace_allowed()));
CREATE INDEX user_work_rows_page ON public.user_work_rows(table_id,position,id);
CREATE OR REPLACE FUNCTION public.user_table_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.user_work_tables; r public.user_work_rows; other public.user_work_rows; result uuid; col jsonb; opt jsonb; val jsonb; cols jsonb; vals jsonb; oldcol jsonb; link uuid;
BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Active workspace access required'; END IF;
IF _action='create' THEN INSERT INTO public.user_work_tables(name,owner_id) VALUES(trim(_payload->>'name'),auth.uid()) RETURNING id INTO result; RETURN result; END IF;
SELECT * INTO t FROM public.user_work_tables WHERE id=(_payload->>'table_id')::uuid AND owner_id=auth.uid() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Private table access denied'; END IF;
IF _action IN ('configure','delete_table','duplicate_table') AND coalesce((_payload->>'version')::integer,0)<>t.version THEN RAISE EXCEPTION 'Table changed. Refresh before saving'; END IF;
IF _action='delete_table' THEN DELETE FROM public.user_work_tables WHERE id=t.id; RETURN t.id;
ELSIF _action='duplicate_table' THEN
INSERT INTO public.user_work_tables(owner_id,name,columns,preferences) VALUES(auth.uid(),left(t.name,190)||' (copy)',t.columns,t.preferences) RETURNING id INTO result;
INSERT INTO public.user_work_rows(table_id,values,lead_id,deal_id,task_id,position) SELECT result,values,lead_id,deal_id,task_id,position FROM public.user_work_rows WHERE table_id=t.id; RETURN result;
ELSIF _action='configure' THEN
cols:=coalesce(_payload->'columns',t.columns);
IF jsonb_typeof(cols)<>'array' THEN RAISE EXCEPTION 'Invalid columns'; END IF;
IF (SELECT count(*) FROM jsonb_array_elements(cols))<>(SELECT count(DISTINCT c->>'id') FROM jsonb_array_elements(cols) c) THEN RAISE EXCEPTION 'Column IDs must be unique'; END IF;
FOR col IN SELECT * FROM jsonb_array_elements(cols) LOOP
IF coalesce(col->>'id','') !~ '^[A-Za-z0-9_-]+$' OR length(trim(coalesce(col->>'name','')))=0 OR length(col->>'name')>200 OR coalesce(col->>'type','') NOT IN ('text','long_text','number','currency','date','status','priority','dropdown','checkbox','url','phone','email') THEN RAISE EXCEPTION 'Invalid column definition'; END IF;
IF col->>'type' IN ('status','priority','dropdown') THEN
IF jsonb_typeof(col->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Select columns require options'; END IF;
IF (SELECT count(*) FROM jsonb_array_elements(col->'options'))<>(SELECT count(DISTINCT o->>'id') FROM jsonb_array_elements(col->'options') o) THEN RAISE EXCEPTION 'Option IDs must be unique'; END IF;
FOR opt IN SELECT * FROM jsonb_array_elements(col->'options') LOOP IF length(trim(coalesce(opt->>'name','')))=0 OR coalesce(opt->>'color','blue') NOT IN ('blue','green','orange','red','purple','gray') THEN RAISE EXCEPTION 'Invalid option'; END IF; END LOOP;
SELECT c INTO oldcol FROM jsonb_array_elements(t.columns) c WHERE c->>'id'=col->>'id';
IF oldcol IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_work_rows w WHERE w.table_id=t.id AND coalesce(w.values->>(col->>'id'),'')<>'' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(col->'options') o WHERE o->>'id'=w.values->>(col->>'id'))) THEN RAISE EXCEPTION 'An option is still used by records'; END IF;
END IF;
END LOOP;
UPDATE public.user_work_tables SET name=coalesce(trim(_payload->>'name'),name),columns=cols,preferences=coalesce(_payload->'preferences',preferences),version=version+1,updated_at=now() WHERE id=t.id; RETURN t.id;
END IF;
IF nullif(_payload->>'id','') IS NOT NULL THEN
SELECT * INTO r FROM public.user_work_rows WHERE id=(_payload->>'id')::uuid AND table_id=t.id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Row not found'; END IF;
IF coalesce((_payload->>'version')::integer,0)<>r.version THEN RAISE EXCEPTION 'Row changed. Refresh before saving'; END IF;
END IF;
IF _action='delete_row' THEN DELETE FROM public.user_work_rows WHERE id=r.id; RETURN r.id;
ELSIF _action='move_row' THEN
SELECT * INTO other FROM public.user_work_rows WHERE id=(_payload->>'neighbor')::uuid AND table_id=t.id FOR UPDATE;
IF r.id IS NULL OR other.id IS NULL THEN RAISE EXCEPTION 'Select an adjacent record'; END IF;
UPDATE public.user_work_rows SET position=other.position,version=version+1 WHERE id=r.id;
UPDATE public.user_work_rows SET position=r.position,version=version+1 WHERE id=other.id; RETURN r.id;
ELSIF _action='duplicate_row' THEN
IF r.id IS NULL THEN RAISE EXCEPTION 'Row required'; END IF;
INSERT INTO public.user_work_rows(table_id,values,lead_id,deal_id,task_id,position) VALUES(t.id,r.values,r.lead_id,r.deal_id,r.task_id,(SELECT coalesce(max(position),0)+1 FROM public.user_work_rows WHERE table_id=t.id)) RETURNING id INTO result; RETURN result;
ELSIF _action<>'save_row' THEN RAISE EXCEPTION 'Unsupported table action'; END IF;
vals:=coalesce(_payload->'values','{}');
IF jsonb_typeof(vals)<>'object' THEN RAISE EXCEPTION 'Invalid row values'; END IF;
FOR col IN SELECT * FROM jsonb_array_elements(t.columns) LOOP
val:=vals->(col->>'id');
IF val IS NULL OR val='null'::jsonb OR val='""'::jsonb THEN CONTINUE; END IF;
IF col->>'type' IN ('number','currency') AND jsonb_typeof(val)<>'number' THEN RAISE EXCEPTION 'Numeric value required'; END IF;
IF col->>'type'='checkbox' AND jsonb_typeof(val)<>'boolean' THEN RAISE EXCEPTION 'Checkbox value required'; END IF;
IF col->>'type' IN ('status','priority','dropdown') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(col->'options') o WHERE o->>'id'=vals->>(col->>'id')) THEN RAISE EXCEPTION 'Invalid option'; END IF;
IF col->>'type'='date' THEN PERFORM (vals->>(col->>'id'))::date; END IF;
IF col->>'type'='url' AND (vals->>(col->>'id')) !~ '^https?://' THEN RAISE EXCEPTION 'Use an http or https URL'; END IF;
IF col->>'type'='email' AND (vals->>(col->>'id')) !~ '^[^ @]+@[^ @]+\.[^ @]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
END LOOP;
link:=nullif(_payload->>'lead_id','')::uuid;
IF link IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads WHERE id=link AND assigned_to=auth.uid() AND public.user_crm_company(company_id)) THEN RAISE EXCEPTION 'Linked lead access denied'; END IF;
link:=nullif(_payload->>'deal_id','')::uuid;
IF link IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.deals WHERE id=link AND assigned_to=auth.uid() AND public.user_crm_company(company_id)) THEN RAISE EXCEPTION 'Linked deal access denied'; END IF;
link:=nullif(_payload->>'task_id','')::uuid;
IF link IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.crm_work_items WHERE id=link AND kind='task' AND deleted_at IS NULL AND assigned_to=auth.uid() AND public.routing_eligible(auth.uid(),company_id)) THEN RAISE EXCEPTION 'Linked task access denied'; END IF;
IF r.id IS NULL THEN
INSERT INTO public.user_work_rows(table_id,values,lead_id,deal_id,task_id,position) VALUES(t.id,vals,nullif(_payload->>'lead_id','')::uuid,nullif(_payload->>'deal_id','')::uuid,nullif(_payload->>'task_id','')::uuid,(SELECT coalesce(max(position),0)+1 FROM public.user_work_rows WHERE table_id=t.id)) RETURNING id INTO result;
ELSE UPDATE public.user_work_rows SET values=vals,lead_id=nullif(_payload->>'lead_id','')::uuid,deal_id=nullif(_payload->>'deal_id','')::uuid,task_id=nullif(_payload->>'task_id','')::uuid,version=version+1,updated_at=now() WHERE id=r.id RETURNING id INTO result; END IF;
RETURN result; END $$;
REVOKE ALL ON FUNCTION public.user_table_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.user_table_action(text,jsonb) TO authenticated,service_role;
CREATE TABLE public.personal_crm_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL DEFAULT auth.uid(),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),notes text NOT NULL DEFAULT '' CHECK(length(notes)<=5000),priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','highest')),status text NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','completed')),start_date date NOT NULL,due_date date NOT NULL,checklist jsonb NOT NULL DEFAULT '[]',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,CHECK(due_date>=start_date));
GRANT SELECT ON public.personal_crm_tasks TO authenticated; GRANT ALL ON public.personal_crm_tasks TO service_role;
ALTER TABLE public.personal_crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_task_read ON public.personal_crm_tasks FOR SELECT TO authenticated USING(public.user_workspace_allowed() AND (owner_id=auth.uid() OR public.routing_admin()));
CREATE INDEX personal_task_owner ON public.personal_crm_tasks(owner_id,due_date) WHERE deleted_at IS NULL;
CREATE TABLE public.personal_task_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES public.personal_crm_tasks(id),actor_id uuid NOT NULL DEFAULT auth.uid(),action text NOT NULL,before_record jsonb,after_record jsonb,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.personal_task_history TO authenticated; GRANT ALL ON public.personal_task_history TO service_role;
ALTER TABLE public.personal_task_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_task_history_read ON public.personal_task_history FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.personal_crm_tasks t WHERE t.id=task_id AND public.user_workspace_allowed() AND (t.owner_id=auth.uid() OR public.routing_admin())));
ALTER TABLE public.crm_work_items ADD COLUMN checklist jsonb NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION public.user_checklist_valid(_list jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_typeof(_list)='array' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_list)='array' THEN _list ELSE '[]' END) c WHERE jsonb_typeof(c->'done') IS DISTINCT FROM 'boolean' OR length(trim(coalesce(c->>'text','')))=0 OR length(c->>'text')>500) $$;
CREATE OR REPLACE FUNCTION public.work_employee_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.user_checklist_valid(NEW.checklist) THEN RAISE EXCEPTION 'Invalid checklist'; END IF;
IF auth.uid() IS NOT NULL AND NOT public.routing_admin() AND (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND OLD.created_by IS DISTINCT FROM auth.uid())) THEN RAISE EXCEPTION 'Assigned records cannot be reassigned or deleted'; END IF; RETURN NEW; END $$;
CREATE TRIGGER work_employee_guard BEFORE UPDATE ON public.crm_work_items FOR EACH ROW EXECUTE FUNCTION public.work_employee_guard();
CREATE OR REPLACE FUNCTION public.user_work_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oldrow public.personal_crm_tasks; newrow public.personal_crm_tasks; result uuid; BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Active workspace access required'; END IF;
IF NOT public.user_checklist_valid(coalesce(_payload->'checklist','[]')) THEN RAISE EXCEPTION 'Invalid checklist'; END IF;
IF coalesce(_payload->>'origin','company')='company' THEN
result:=public.crm_work_action(_action,_payload);
IF _action='save' THEN UPDATE public.crm_work_items SET checklist=coalesce(_payload->'checklist','[]') WHERE id=result; UPDATE public.crm_work_history SET after_record=(SELECT to_jsonb(w) FROM public.crm_work_items w WHERE w.id=result) WHERE id=(SELECT id FROM public.crm_work_history WHERE work_id=result ORDER BY created_at DESC,id DESC LIMIT 1); END IF;
RETURN result; END IF;
IF nullif(_payload->>'id','') IS NOT NULL THEN SELECT * INTO oldrow FROM public.personal_crm_tasks WHERE id=(_payload->>'id')::uuid AND owner_id=auth.uid() AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Personal task access denied'; END IF; IF oldrow.version<>coalesce((_payload->>'version')::integer,0) THEN RAISE EXCEPTION 'Task changed. Refresh before saving'; END IF; END IF;
IF _action='save' THEN
IF coalesce(_payload->>'kind','task')<>'task' OR nullif(_payload->>'lead_id','') IS NOT NULL OR nullif(_payload->>'deal_id','') IS NOT NULL THEN RAISE EXCEPTION 'Linked tasks must use their authorized company'; END IF;
IF oldrow.id IS NULL THEN INSERT INTO public.personal_crm_tasks(owner_id,title,notes,priority,status,start_date,due_date,checklist) VALUES(auth.uid(),trim(_payload->>'title'),coalesce(_payload->>'notes',''),_payload->>'priority',_payload->>'status',(_payload->>'start_date')::date,(_payload->>'due_date')::date,coalesce(_payload->'checklist','[]')) RETURNING * INTO newrow;
ELSE UPDATE public.personal_crm_tasks SET title=trim(_payload->>'title'),notes=coalesce(_payload->>'notes',''),priority=_payload->>'priority',status=_payload->>'status',start_date=(_payload->>'start_date')::date,due_date=(_payload->>'due_date')::date,checklist=coalesce(_payload->'checklist','[]'),version=version+1,updated_at=now() WHERE id=oldrow.id RETURNING * INTO newrow; END IF;
ELSIF oldrow.id IS NULL THEN RAISE EXCEPTION 'Task required';
ELSIF _action='delete' THEN UPDATE public.personal_crm_tasks SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=oldrow.id RETURNING * INTO newrow;
ELSIF _action='status' THEN UPDATE public.personal_crm_tasks SET status=_payload->>'status',updated_at=now(),version=version+1 WHERE id=oldrow.id RETURNING * INTO newrow;
ELSE RAISE EXCEPTION 'Unsupported task action'; END IF;
INSERT INTO public.personal_task_history(task_id,actor_id,action,before_record,after_record) VALUES(newrow.id,auth.uid(),CASE WHEN oldrow.id IS NULL THEN 'created' ELSE _action END,CASE WHEN oldrow.id IS NULL THEN NULL ELSE to_jsonb(oldrow) END,to_jsonb(newrow)); RETURN newrow.id; END $$;
REVOKE ALL ON FUNCTION public.user_work_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.user_work_action(text,jsonb) TO authenticated,service_role;
ALTER TABLE public.deals ADD COLUMN service_name text NOT NULL DEFAULT '',ADD COLUMN description text NOT NULL DEFAULT '',ADD COLUMN negotiated_amount numeric(14,2),ADD COLUMN final_amount numeric(14,2),ADD COLUMN currency text NOT NULL DEFAULT 'INR',ADD COLUMN actual_close_date date,ADD COLUMN notes text NOT NULL DEFAULT '',ADD COLUMN lost_reason text NOT NULL DEFAULT '',ADD COLUMN deleted_at timestamptz;
CREATE POLICY "Active CRM deal access" ON public.deals AS RESTRICTIVE FOR ALL TO authenticated USING(public.routing_admin() OR (assigned_to=auth.uid() AND public.user_crm_company(company_id))) WITH CHECK(public.routing_admin() OR (assigned_to=auth.uid() AND public.user_crm_company(company_id)));
CREATE TABLE public.deal_activity_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,actor_id uuid,action text NOT NULL,before_record jsonb,after_record jsonb,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.deal_activity_history TO authenticated; GRANT ALL ON public.deal_activity_history TO service_role;
ALTER TABLE public.deal_activity_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_history_read ON public.deal_activity_history FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.deals d WHERE d.id=deal_id AND (public.routing_admin() OR (d.assigned_to=auth.uid() AND public.user_crm_company(d.company_id)))));
CREATE INDEX deal_history_parent ON public.deal_activity_history(deal_id,created_at);
CREATE OR REPLACE FUNCTION public.user_deal_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.routing_admin() THEN
IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.contract_type_id IS DISTINCT FROM OLD.contract_type_id OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND OLD.created_by IS DISTINCT FROM auth.uid())) THEN RAISE EXCEPTION 'Protected deal ownership cannot change'; END IF;
IF NEW.assigned_to IS DISTINCT FROM auth.uid() OR NOT public.user_crm_company(NEW.company_id) THEN RAISE EXCEPTION 'Deal access denied'; END IF;
IF NEW.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=NEW.lead_id AND l.assigned_to=auth.uid() AND l.company_id=NEW.company_id) THEN RAISE EXCEPTION 'Related lead access denied'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.crm_stages s JOIN public.crm_pipelines p ON p.id=s.pipeline_id WHERE s.id=NEW.stage_id AND s.kind='deal' AND s.is_active AND s.pipeline_id=NEW.pipeline_id AND p.is_active) THEN RAISE EXCEPTION 'Select an active deal stage'; END IF;
IF NEW.status NOT IN ('open','won','lost') OR NEW.amount<0 OR NEW.negotiated_amount<0 OR NEW.final_amount<0 OR NEW.currency !~ '^[A-Z]{3}$' OR length(NEW.notes)>5000 OR length(NEW.description)>5000 OR length(trim(NEW.title))=0 THEN RAISE EXCEPTION 'Invalid deal values'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER user_deal_guard BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.user_deal_guard();
CREATE OR REPLACE FUNCTION public.deal_change_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.deal_activity_history(deal_id,actor_id,action,before_record,after_record) VALUES(NEW.id,auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,to_jsonb(NEW)); RETURN NEW; END $$;
CREATE TRIGGER deal_change_audit AFTER INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.deal_change_audit();
CREATE OR REPLACE FUNCTION public.user_deal_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.deals; result uuid; stage uuid; pipeline uuid; company uuid; lead uuid; BEGIN
IF NOT public.user_workspace_allowed() THEN RAISE EXCEPTION 'Active sales workspace access required'; END IF;
IF nullif(_payload->>'id','') IS NOT NULL THEN SELECT * INTO d FROM public.deals WHERE id=(_payload->>'id')::uuid AND assigned_to=auth.uid() AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND OR NOT public.user_crm_company(d.company_id) THEN RAISE EXCEPTION 'Deal access denied'; END IF; IF d.updated_at IS DISTINCT FROM (_payload->>'updated_at')::timestamptz THEN RAISE EXCEPTION 'Deal changed. Refresh before saving'; END IF; END IF;
IF _action='delete' THEN IF d.id IS NULL OR d.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only your own created deal may be deleted'; END IF; UPDATE public.deals SET deleted_at=now() WHERE id=d.id; RETURN d.id;
ELSIF _action='note' THEN IF d.id IS NULL OR length(trim(coalesce(_payload->>'note','')))=0 OR length(_payload->>'note')>5000 THEN RAISE EXCEPTION 'Valid note required'; END IF; UPDATE public.deals SET notes=left(notes||CASE WHEN notes='' THEN '' ELSE E'\n' END||trim(_payload->>'note'),5000) WHERE id=d.id; RETURN d.id;
ELSIF _action='status' THEN IF d.id IS NULL OR coalesce(_payload->>'status','') NOT IN ('open','won','lost') THEN RAISE EXCEPTION 'Valid status required'; END IF; UPDATE public.deals SET status=_payload->>'status',actual_close_date=CASE WHEN _payload->>'status' IN ('won','lost') THEN (now() AT TIME ZONE 'Asia/Kolkata')::date ELSE actual_close_date END WHERE id=d.id; RETURN d.id;
ELSIF _action<>'save' THEN RAISE EXCEPTION 'Unsupported deal action'; END IF;
company:=coalesce(d.company_id,(_payload->>'company_id')::uuid); lead:=nullif(_payload->>'lead_id','')::uuid; stage:=(_payload->>'stage_id')::uuid;
IF NOT public.user_crm_company(company) THEN RAISE EXCEPTION 'Company access denied'; END IF;
SELECT pipeline_id INTO pipeline FROM public.crm_stages WHERE id=stage AND kind='deal' AND is_active;
IF pipeline IS NULL OR (d.id IS NOT NULL AND d.pipeline_id IS DISTINCT FROM pipeline) THEN RAISE EXCEPTION 'Select a stage in the authorized pipeline'; END IF;
IF d.id IS NULL THEN INSERT INTO public.deals(company_id,lead_id,pipeline_id,stage_id,title,amount,assigned_to,created_by) VALUES(company,lead,pipeline,stage,trim(_payload->>'title'),(_payload->>'amount')::numeric,auth.uid(),auth.uid()) RETURNING id INTO result; ELSE result:=d.id; END IF;
UPDATE public.deals SET lead_id=lead,stage_id=stage,title=trim(_payload->>'title'),amount=(_payload->>'amount')::numeric,service_name=coalesce(_payload->>'service_name',''),description=coalesce(_payload->>'description',''),negotiated_amount=nullif(_payload->>'negotiated_amount','')::numeric,final_amount=nullif(_payload->>'final_amount','')::numeric,currency=upper(_payload->>'currency'),expected_close_date=nullif(_payload->>'expected_close_date','')::date,actual_close_date=nullif(_payload->>'actual_close_date','')::date,notes=coalesce(_payload->>'notes',''),lost_reason=coalesce(_payload->>'lost_reason',''),status=_payload->>'status' WHERE id=result; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.user_deal_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.user_deal_action(text,jsonb) TO authenticated,service_role;