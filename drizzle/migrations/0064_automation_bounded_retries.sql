ALTER TABLE public.automation_executions ADD COLUMN attempts integer NOT NULL DEFAULT 1;
ALTER TABLE public.automation_executions ADD COLUMN last_error text;
ALTER TABLE public.automation_executions ADD COLUMN last_attempt_at timestamptz;
ALTER TABLE public.automation_executions ADD COLUMN finished_at timestamptz;
ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_attempts_check CHECK (attempts BETWEEN 1 AND 3);
DO $migration$
DECLARE s text; old text; new text;
BEGIN
SELECT pg_get_functiondef('public.automation_run_record_event(uuid,text,text,uuid)'::regprocedure) INTO s;
old:=$p$  EXCEPTION WHEN OTHERS THEN
   UPDATE public.automation_executions SET due_at=NULL,status='failed',detail='Work execution rolled back ('||SQLSTATE||')',task_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.task_ids END,follow_up_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.follow_up_ids END WHERE id=log_id;$p$;
new:=$p$  EXCEPTION WHEN OTHERS THEN
   IF (SQLSTATE IN ('40001','40P01','55P03','57014','55006') OR left(SQLSTATE,2) IN ('08','53')) AND (SELECT attempts FROM public.automation_executions WHERE id=log_id)<3 THEN
    UPDATE public.automation_executions SET status='queued',attempts=attempts+1,last_error=SQLSTATE||': '||left(SQLERRM,300),last_attempt_at=now(),
     due_at=now()+(CASE attempts WHEN 1 THEN 1 ELSE 3 END)*interval '1 minute',
     next_action=CASE WHEN _resume IS NULL THEN 0 ELSE e.next_action END,
     action_plan=coalesce(action_plan,w.actions),condition_plan=coalesce(condition_plan,w.conditions),queued_assignee=coalesce(queued_assignee,l.assigned_to),
     detail='Transient failure; retry '||(attempts+1)::text||' of 3 scheduled ('||SQLSTATE||')',
     task_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.task_ids END,follow_up_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.follow_up_ids END WHERE id=log_id;
    PERFORM public.automation_delay_schedule();
   ELSE
   UPDATE public.automation_executions SET due_at=NULL,status='failed',last_error=SQLSTATE||': '||left(SQLERRM,300),last_attempt_at=now(),finished_at=now(),detail='Permanently failed after '||attempts::text||' attempt(s); work rolled back ('||SQLSTATE||')',task_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.task_ids END,follow_up_ids=CASE WHEN _resume IS NULL THEN '{}'::uuid[] ELSE e.follow_up_ids END WHERE id=log_id;
   END IF;$p$;
IF position(old in s)=0 THEN RAISE EXCEPTION 'Unexpected executor failure handler'; END IF;
s:=replace(s,old,new);
s:=replace(s,$p$status='success',detail=$p$,$p$status='success',last_attempt_at=now(),finished_at=now(),detail=$p$);
s:=replace(s,$p$SET due_at=NULL,status='skipped',detail=reason$p$,$p$SET due_at=NULL,status='skipped',finished_at=now(),detail=reason$p$);
EXECUTE s;
END; $migration$;
REVOKE ALL ON FUNCTION public.automation_run_record_event(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON COLUMN public.automation_executions.attempts IS 'Total attempts; transient SQLSTATEs retry with 1/3 minute backoff, max 3, then permanent failure.';