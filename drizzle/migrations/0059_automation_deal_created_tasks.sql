ALTER TABLE public.automation_workflows DROP CONSTRAINT automation_workflows_trigger_check;
ALTER TABLE public.automation_workflows ADD CONSTRAINT automation_workflows_trigger_check CHECK (trigger IN ('lead_created','whatsapp_received','stage_changed','followup_due','deal_created'));
ALTER TABLE public.automation_executions ADD COLUMN deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX automation_deal_event_once ON public.automation_executions(workflow_id,deal_id,event_key) WHERE deal_id IS NOT NULL;

CREATE FUNCTION public.automation_execute_record_event(_record uuid,_trigger text,_event_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; d public.deals; w public.automation_workflows; c jsonb; a jsonb; actual text; alias text;
 matched boolean; reason text; log_id uuid; task public.crm_work_items; tasks uuid[];
 task_day date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 IF _event_key IS NULL THEN RETURN; END IF;
 IF _trigger='deal_created' THEN
  IF _event_key<>'deal_created' THEN RETURN; END IF;
  SELECT * INTO d FROM public.deals WHERE id=_record AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  l.company_id:=d.company_id; l.assigned_to:=d.assigned_to; l.stage_id:=d.stage_id;
 ELSIF _trigger IN ('lead_created','stage_changed') THEN
  SELECT * INTO l FROM public.leads WHERE id=_record;
  IF NOT FOUND THEN RETURN; END IF;
 ELSE RETURN;
 END IF;
 FOR w IN SELECT * FROM public.automation_workflows WHERE trigger=_trigger AND status='active' ORDER BY id FOR SHARE LOOP
  log_id:=NULL;
  IF _trigger='deal_created' THEN
   INSERT INTO public.automation_executions(workflow_id,deal_id,company_id,status,detail,event_key)
    VALUES(w.id,d.id,d.company_id,'skipped','Evaluating deal_created event',_event_key)
    ON CONFLICT (workflow_id,deal_id,event_key) WHERE deal_id IS NOT NULL DO NOTHING RETURNING id INTO log_id;
  ELSE
   INSERT INTO public.automation_executions(workflow_id,lead_id,company_id,status,detail,event_key)
    VALUES(w.id,l.id,l.company_id,'skipped','Evaluating '||_trigger||' event',_event_key)
    ON CONFLICT (workflow_id,lead_id,event_key) WHERE lead_id IS NOT NULL DO NOTHING RETURNING id INTO log_id;
  END IF;
  IF log_id IS NULL THEN CONTINUE; END IF;
  BEGIN
   reason:=NULL; tasks:='{}';
   IF w.created_by IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=w.created_by AND p.account_status='active') OR NOT public.has_role(w.created_by,'super_admin') THEN reason:='Workflow creator is not an active Super Admin';
   ELSIF l.company_id IS NULL OR l.assigned_to IS NULL OR NOT public.routing_eligible(l.assigned_to,l.company_id) THEN reason:=CASE WHEN _trigger='deal_created' THEN 'Deal has no eligible company assignee' ELSE 'Lead has no eligible company assignee' END;
   ELSIF jsonb_typeof(w.conditions)<>'array' OR jsonb_typeof(w.actions)<>'array' OR jsonb_array_length(w.actions)=0 THEN reason:='Invalid workflow configuration';
   END IF;
   IF reason IS NULL THEN
    FOR c IN SELECT value FROM jsonb_array_elements(w.conditions) LOOP
     actual:=NULL; alias:=NULL;
     CASE c->>'field'
      WHEN 'stage' THEN SELECT s.name,s.id::text INTO actual,alias FROM public.crm_stages s WHERE s.id=l.stage_id;
      WHEN 'source' THEN
       IF _trigger='deal_created' THEN reason:='Unsupported condition field on deal';
       ELSE SELECT s.name,s.id::text INTO actual,alias FROM public.crm_options s WHERE s.id=l.source_id; END IF;
      WHEN 'campaign' THEN
       IF _trigger='deal_created' THEN reason:='Unsupported condition field on deal';
       ELSE actual:=l.meta_campaign_name; alias:=l.meta_campaign_id; END IF;
      WHEN 'assigned_user' THEN SELECT p.full_name,p.id::text INTO actual,alias FROM public.profiles p WHERE p.id=l.assigned_to;
      ELSE reason:=CASE WHEN _trigger='deal_created' THEN 'Unsupported condition field on deal' ELSE 'Unsupported condition field (lead has no priority field)' END;
     END CASE;
     IF reason IS NOT NULL THEN EXIT; END IF;
     IF coalesce(c->>'op','') NOT IN ('equals','not equals') OR nullif(trim(c->>'value'),'') IS NULL THEN reason:='Invalid condition'; EXIT; END IF;
     IF nullif(actual,'') IS NULL AND nullif(alias,'') IS NULL THEN reason:=CASE WHEN _trigger='deal_created' THEN 'Condition value missing on deal' ELSE 'Condition value missing on lead' END; EXIT; END IF;
     matched:=coalesce(lower(trim(actual))=lower(trim(c->>'value')),false) OR coalesce(lower(trim(alias))=lower(trim(c->>'value')),false);
     IF ((c->>'op')='equals' AND NOT matched) OR ((c->>'op')='not equals' AND matched) THEN reason:='Conditions did not match'; EXIT; END IF;
    END LOOP;
   END IF;
   IF reason IS NULL THEN
    FOR a IN SELECT value FROM jsonb_array_elements(w.actions) LOOP
     IF coalesce(a->>'type','')<>'create_task' OR coalesce(a->>'delayHours','')<>'0' THEN reason:='Executor supports only immediate Create Task actions'; EXIT; END IF;
     IF length(trim(coalesce(a->>'note','')))>200 THEN reason:='Task title exceeds 200 characters'; EXIT; END IF;
    END LOOP;
   END IF;
   IF reason IS NULL THEN
    FOR a IN SELECT value FROM jsonb_array_elements(w.actions) LOOP
     INSERT INTO public.crm_work_items(kind,company_id,lead_id,deal_id,assigned_to,title,notes,priority,status,start_date,due_date,created_by)
      VALUES('task',l.company_id,l.id,d.id,l.assigned_to,coalesce(nullif(trim(a->>'note'),''),CASE WHEN _trigger='deal_created' THEN 'Follow up new deal' ELSE 'Contact new lead' END),'','medium','not_started',task_day,task_day,w.created_by) RETURNING * INTO task;
     INSERT INTO public.crm_work_history(work_id,actor_id,action,after_record) VALUES(task.id,w.created_by,'created',to_jsonb(task));
     tasks:=array_append(tasks,task.id);
    END LOOP;
    UPDATE public.automation_executions SET status='success',detail='Created '||cardinality(tasks)||' task(s) for the eligible '||CASE WHEN _trigger='deal_created' THEN 'deal' ELSE 'lead' END||' assignee',task_ids=tasks WHERE id=log_id;
   ELSE UPDATE public.automation_executions SET status='skipped',detail=reason WHERE id=log_id;
   END IF;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.automation_executions SET status='failed',detail='Task execution rolled back ('||SQLSTATE||')',task_ids='{}' WHERE id=log_id;
  END;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.automation_execute_record_event(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.automation_execute_lead_event(_lead uuid,_trigger text,_event_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF _trigger IN ('lead_created','stage_changed') THEN
  PERFORM public.automation_execute_record_event(_lead,_trigger,_event_key);
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.automation_execute_lead_event(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.automation_deal_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.automation_execute_record_event(NEW.id,'deal_created','deal_created');
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.automation_deal_created() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER zz_automation_deal_created AFTER INSERT ON public.deals DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.automation_deal_created();
COMMENT ON FUNCTION public.automation_execute_record_event(uuid,text,text) IS 'Trigger-only shared condition evaluator and atomic task/history executor. Separate unique lead/deal event claims; existing ownership and eligibility; no transport, reassignment, delays or retries.';
COMMENT ON TRIGGER zz_automation_deal_created ON public.deals IS 'Deferred until transaction completion to read final authorized Deal creation fields, including user_deal_action insert-then-update. No event on subsequent edits.';