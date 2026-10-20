-- lovable-cron-fallback-reviewed: SQL-only bounded queue wakes on enqueue and stops after drain; one minute timing required, up to 1440 daily checks only while pending, cost explained.
ALTER TABLE public.automation_executions ADD COLUMN next_action integer NOT NULL DEFAULT 0;
ALTER TABLE public.automation_executions ADD COLUMN due_at timestamptz;
ALTER TABLE public.automation_executions ADD COLUMN action_plan jsonb;
ALTER TABLE public.automation_executions ADD COLUMN condition_plan jsonb;
ALTER TABLE public.automation_executions ADD COLUMN queued_assignee uuid;
ALTER TABLE public.automation_executions DROP CONSTRAINT automation_executions_status_check;
ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_status_check CHECK(status IN ('success','failed','skipped','queued'));
CREATE INDEX automation_delays_due ON public.automation_executions(due_at) WHERE status='queued';
CREATE FUNCTION public.automation_delay_schedule() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(882617);
 PERFORM cron.schedule('routiva-automation-delays','* * * * *','SELECT public.automation_process_delays()');
END; $$;
REVOKE ALL ON FUNCTION public.automation_delay_schedule() FROM PUBLIC,anon,authenticated,service_role;
DO $migration$
DECLARE s text;
BEGIN
SELECT pg_get_functiondef('public.automation_execute_record_event(uuid,text,text)'::regprocedure) INTO s;
s:=replace(s,'automation_execute_record_event(_record uuid, _trigger text, _event_key text)','automation_run_record_event(_record uuid, _trigger text, _event_key text, _resume uuid DEFAULT NULL)');
IF position('automation_run_record_event' in s)=0 THEN RAISE EXCEPTION 'Unexpected shared executor signature'; END IF;
s:=replace(s,'task_day date :=','e public.automation_executions; idx integer; delay_hours numeric; queued boolean; task_day date :=');
s:=replace(s,' IF _event_key IS NULL THEN RETURN; END IF;',' PERFORM pg_advisory_xact_lock(882617); IF _event_key IS NULL THEN RETURN; END IF;');
s:=replace(s,'WHERE id=_record AND deleted_at IS NULL;','WHERE id=_record AND deleted_at IS NULL FOR SHARE;');
s:=replace(s,'WHERE id=_record;','WHERE id=_record FOR SHARE;');
s:=replace(s,'WHERE trigger=_trigger AND status=''active'' ORDER BY id FOR SHARE LOOP','WHERE trigger=_trigger AND status=''active'' AND (_resume IS NULL OR id=(SELECT workflow_id FROM public.automation_executions WHERE id=_resume)) ORDER BY id FOR SHARE LOOP');
s:=replace(s,'  log_id:=NULL;',$part$  log_id:=NULL;
  IF _resume IS NOT NULL THEN
   SELECT * INTO e FROM public.automation_executions WHERE id=_resume AND status='queued' AND due_at<=now() FOR UPDATE;
   IF NOT FOUND THEN RETURN; END IF;
   IF e.queued_assignee IS DISTINCT FROM l.assigned_to OR e.company_id IS DISTINCT FROM l.company_id THEN
    UPDATE public.automation_executions SET status='skipped',detail='Queued ownership changed',due_at=NULL WHERE id=e.id; RETURN;
   END IF;
   log_id:=e.id; w.actions:=e.action_plan; w.conditions:=e.condition_plan;
  ELSE$part$);
s:=replace(s,'  IF log_id IS NULL THEN CONTINUE; END IF;','  END IF; IF log_id IS NULL THEN CONTINUE; END IF;');
s:=replace(s,$part$reason:=NULL; tasks:='{}'; followups:='{}';$part$,$part$reason:=NULL; queued:=false; tasks:=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.task_ids END; followups:=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.follow_up_ids END;$part$);
s:=replace(s,$part$IF coalesce(a->>'delayHours','')<>'0' OR NOT$part$,$part$IF coalesce(a->>'delayHours','') !~ '^[0-9]+([.][0-9]+)?$' THEN reason:='Invalid action delay'; EXIT; END IF;
     IF NOT$part$);
s:=replace(s,'Unsupported action or delay for this trigger','Unsupported action for this trigger');
s:=replace(s,$part$   IF reason IS NULL THEN
    FOR a IN SELECT value FROM jsonb_array_elements(w.actions) LOOP
     IF a->>'type'='create_follow_up' THEN$part$,$part$   IF reason IS NULL THEN
    IF _resume IS NULL THEN UPDATE public.automation_executions SET action_plan=w.actions,condition_plan=w.conditions,queued_assignee=l.assigned_to WHERE id=log_id; END IF;
    FOR idx IN coalesce(e.next_action,0)..jsonb_array_length(w.actions)-1 LOOP
     a:=w.actions->idx; delay_hours:=(a->>'delayHours')::numeric;
     IF delay_hours>0 AND NOT (_resume IS NOT NULL AND idx=e.next_action) THEN
      UPDATE public.automation_executions SET status='queued',detail='Queued action '||(idx+1)::text,next_action=idx,due_at=now()+delay_hours*interval '1 hour',task_ids=tasks,follow_up_ids=followups WHERE id=log_id;
      queued:=true; PERFORM public.automation_delay_schedule(); EXIT;
     END IF;
     IF a->>'type'='create_follow_up' THEN$part$);
s:=replace(s,$part$    UPDATE public.automation_executions SET status='success'$part$,$part$    IF NOT queued THEN UPDATE public.automation_executions SET due_at=NULL,next_action=jsonb_array_length(w.actions),status='success'$part$);
s:=replace(s,'   ELSE UPDATE public.automation_executions','    END IF; ELSE UPDATE public.automation_executions');
s:=replace(s,$part$SET status='skipped',detail=reason$part$,$part$SET due_at=NULL,status='skipped',detail=reason$part$);
s:=replace(s,$part$SET status='failed',detail$part$,$part$SET due_at=NULL,status='failed',detail$part$);
s:=replace(s,$part$task_ids='{}',follow_up_ids='{}'$part$,$part$task_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.task_ids END,follow_up_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.follow_up_ids END$part$);
IF position('FOR idx IN' in s)=0 OR position('IF NOT queued' in s)=0 THEN RAISE EXCEPTION 'Unexpected shared executor body'; END IF;
EXECUTE s;
END; $migration$;
REVOKE ALL ON FUNCTION public.automation_run_record_event(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.automation_execute_record_event(_record uuid,_trigger text,_event_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.automation_run_record_event(_record,_trigger,_event_key,NULL); END; $$;
REVOKE ALL ON FUNCTION public.automation_execute_record_event(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.automation_process_delays() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.automation_executions;
BEGIN
 PERFORM pg_advisory_xact_lock(882617);
 UPDATE public.automation_executions x SET status='skipped',due_at=NULL,detail='Queued workflow paused or cancelled' WHERE x.status='queued' AND NOT EXISTS(SELECT 1 FROM public.automation_workflows w WHERE w.id=x.workflow_id AND w.status='active');
 FOR e IN SELECT * FROM public.automation_executions WHERE status='queued' AND due_at<=now() ORDER BY due_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  IF (e.deal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.deals WHERE id=e.deal_id AND deleted_at IS NULL)) OR (e.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads WHERE id=e.lead_id)) THEN
   UPDATE public.automation_executions SET status='skipped',due_at=NULL,detail='Queued record unavailable' WHERE id=e.id;
  ELSE
   PERFORM public.automation_run_record_event(coalesce(e.deal_id,e.lead_id),CASE WHEN e.event_key LIKE 'deal_stage_changed:%' THEN 'deal_stage_changed' WHEN e.deal_id IS NOT NULL THEN 'deal_created' WHEN e.event_key='lead_created' THEN 'lead_created' ELSE 'stage_changed' END,e.event_key,e.id);
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.automation_executions WHERE status='queued') THEN PERFORM cron.unschedule('routiva-automation-delays'); END IF;
END; $$;
REVOKE ALL ON FUNCTION public.automation_process_delays() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.automation_cancel_delays() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status<>'active' THEN UPDATE public.automation_executions SET status='skipped',due_at=NULL,detail='Queued workflow paused or cancelled' WHERE workflow_id=NEW.id AND status='queued'; END IF; RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.automation_cancel_delays() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER automation_cancel_delays AFTER UPDATE OF status ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION public.automation_cancel_delays();
COMMENT ON FUNCTION public.automation_process_delays() IS 'Bounded ordered delays: wake on enqueue, stop after drain, terminal failure without retry; recheck conditions and company/assignee eligibility.';