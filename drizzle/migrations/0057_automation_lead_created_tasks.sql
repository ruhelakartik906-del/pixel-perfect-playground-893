ALTER TABLE public.automation_executions ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.automation_executions ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.automation_executions ADD COLUMN task_ids uuid[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX automation_lead_event_once ON public.automation_executions(workflow_id,lead_id) WHERE lead_id IS NOT NULL;

CREATE FUNCTION public.automation_execute_lead(_lead uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE l public.leads; w public.automation_workflows; c jsonb; a jsonb; actual text; alias text;
 matched boolean; reason text; log_id uuid; task public.crm_work_items; tasks uuid[];
 task_day date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 SELECT * INTO l FROM public.leads WHERE id=_lead;
 IF NOT FOUND THEN RETURN; END IF;
 FOR w IN SELECT * FROM public.automation_workflows WHERE trigger='lead_created' AND status='active' ORDER BY id FOR SHARE LOOP
  log_id:=NULL;
  INSERT INTO public.automation_executions(workflow_id,lead_id,company_id,status,detail)
   VALUES(w.id,l.id,l.company_id,'skipped','Evaluating Lead Created event')
   ON CONFLICT (workflow_id,lead_id) WHERE lead_id IS NOT NULL DO NOTHING RETURNING id INTO log_id;
  IF log_id IS NULL THEN CONTINUE; END IF;
  BEGIN
   reason:=NULL; tasks:='{}';
   IF w.created_by IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=w.created_by AND p.account_status='active') OR NOT public.has_role(w.created_by,'super_admin') THEN reason:='Workflow creator is not an active Super Admin';
   ELSIF l.company_id IS NULL OR l.assigned_to IS NULL OR NOT public.routing_eligible(l.assigned_to,l.company_id) THEN reason:='Lead has no eligible company assignee';
   ELSIF jsonb_typeof(w.conditions)<>'array' OR jsonb_typeof(w.actions)<>'array' OR jsonb_array_length(w.actions)=0 THEN reason:='Invalid workflow configuration';
   END IF;
   IF reason IS NULL THEN
    FOR c IN SELECT value FROM jsonb_array_elements(w.conditions) LOOP
     actual:=NULL; alias:=NULL;
     CASE c->>'field'
      WHEN 'stage' THEN SELECT s.name,s.id::text INTO actual,alias FROM public.crm_stages s WHERE s.id=l.stage_id;
      WHEN 'source' THEN SELECT s.name,s.id::text INTO actual,alias FROM public.crm_options s WHERE s.id=l.source_id;
      WHEN 'campaign' THEN actual:=l.meta_campaign_name; alias:=l.meta_campaign_id;
      WHEN 'assigned_user' THEN SELECT p.full_name,p.id::text INTO actual,alias FROM public.profiles p WHERE p.id=l.assigned_to;
      ELSE reason:='Unsupported condition field (lead has no priority field)';
     END CASE;
     IF reason IS NOT NULL THEN EXIT; END IF;
     IF coalesce(c->>'op','') NOT IN ('equals','not equals') OR nullif(trim(c->>'value'),'') IS NULL THEN reason:='Invalid condition'; EXIT; END IF;
     IF nullif(actual,'') IS NULL AND nullif(alias,'') IS NULL THEN reason:='Condition value missing on lead'; EXIT; END IF;
     matched:=coalesce(lower(trim(actual))=lower(trim(c->>'value')),false) OR coalesce(lower(trim(alias))=lower(trim(c->>'value')),false);
     IF ((c->>'op')='equals' AND NOT matched) OR ((c->>'op')='not equals' AND matched) THEN reason:='Conditions did not match'; EXIT; END IF;
    END LOOP;
   END IF;
   IF reason IS NULL THEN
    FOR a IN SELECT value FROM jsonb_array_elements(w.actions) LOOP
     IF coalesce(a->>'type','')<>'create_task' OR coalesce(a->>'delayHours','')<>'0' THEN reason:='Phase 1 supports only immediate Create Task actions'; EXIT; END IF;
     IF length(trim(coalesce(a->>'note','')))>200 THEN reason:='Task title exceeds 200 characters'; EXIT; END IF;
    END LOOP;
   END IF;
   IF reason IS NULL THEN
    FOR a IN SELECT value FROM jsonb_array_elements(w.actions) LOOP
     INSERT INTO public.crm_work_items(kind,company_id,lead_id,assigned_to,title,notes,priority,status,start_date,due_date,created_by)
      VALUES('task',l.company_id,l.id,l.assigned_to,coalesce(nullif(trim(a->>'note'),''),'Contact new lead'),'','medium','not_started',task_day,task_day,w.created_by) RETURNING * INTO task;
     INSERT INTO public.crm_work_history(work_id,actor_id,action,after_record) VALUES(task.id,w.created_by,'created',to_jsonb(task));
     tasks:=array_append(tasks,task.id);
    END LOOP;
    UPDATE public.automation_executions SET status='success',detail='Created '||cardinality(tasks)||' task(s) for the eligible lead assignee',task_ids=tasks WHERE id=log_id;
   ELSE UPDATE public.automation_executions SET status='skipped',detail=reason WHERE id=log_id;
   END IF;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.automation_executions SET status='failed',detail='Task execution rolled back ('||SQLSTATE||')',task_ids='{}' WHERE id=log_id;
  END;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.automation_execute_lead(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.automation_new_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
 -- This AFTER INSERT trigger sorts after routing_new_meta_lead. Read the stored row,
 -- not NEW, because routing can update its assignee in the same transaction.
 PERFORM public.automation_execute_lead(NEW.id);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.automation_new_lead() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_automation_lead_created AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.automation_new_lead();
COMMENT ON FUNCTION public.automation_execute_lead(uuid) IS 'Internal trigger-only Phase 1 executor. Unique workflow/lead claims, existing eligible company task ownership, fail-closed conditions and atomic task/history writes. No reassignment or transport actions.';