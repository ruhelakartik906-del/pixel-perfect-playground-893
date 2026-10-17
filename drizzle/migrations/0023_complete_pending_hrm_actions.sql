ALTER TABLE public.hr_attendance ADD COLUMN source_leave_id uuid REFERENCES public.hr_leave_requests(id);
ALTER TABLE public.hr_attendance DROP CONSTRAINT hr_attendance_status_check;
ALTER TABLE public.hr_attendance ADD CONSTRAINT hr_attendance_status_check CHECK (status IN ('present','absent','half_day','leave','weekend'));
ALTER TABLE public.hr_announcements DROP CONSTRAINT hr_announcements_status_check;
ALTER TABLE public.hr_announcements ADD CONSTRAINT hr_announcements_status_check CHECK (status IN ('draft','published','expired','archived'));
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.hrm_attendance_action(text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'''present'',''absent'',''half_day'',''leave''','''present'',''absent'',''half_day'',''leave'',''weekend''');
 definition:=replace(definition,'notes=EXCLUDED.notes,updated_at=now()','notes=EXCLUDED.notes,source_leave_id=NULL,updated_at=now()');
 definition:=replace(definition,'INSERT INTO public.hr_attendance(company_id,employee_id,attendance_date,status,check_in,check_out,notes)', 'IF _payload->>''status''=''leave'' AND NOT EXISTS(SELECT 1 FROM public.hr_leave_requests WHERE employee_id=e.id AND status=''approved'' AND d BETWEEN start_date AND end_date) THEN RAISE EXCEPTION ''Approved leave required for this date''; END IF; INSERT INTO public.hr_attendance(company_id,employee_id,attendance_date,status,check_in,check_out,notes)');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.hrm_record_guard()'::regprocedure) INTO definition;
 definition:=replace(definition,'IF TG_TABLE_NAME=''hr_announcements'' AND OLD.status<>''draft'' THEN RAISE EXCEPTION ''Archive published announcements instead''; END IF;','');
 EXECUTE definition;
END $migration$;
CREATE OR REPLACE FUNCTION public.hrm_attendance_bulk(_payload jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE employee text; total integer:=0;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(_payload->'employee_ids')<>'array' OR jsonb_array_length(_payload->'employee_ids') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Select 1 to 500 employees'; END IF;
 FOR employee IN SELECT DISTINCT value FROM jsonb_array_elements_text(_payload->'employee_ids') ORDER BY value LOOP
 PERFORM public.hrm_attendance_action('manual',(_payload-'employee_ids')||jsonb_build_object('employee_id',employee,'check_in',null,'check_out',null)); total:=total+1;
 END LOOP; RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.hrm_attendance_bulk(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hrm_attendance_bulk(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.hrm_reconcile_leave_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.hr_employees%ROWTYPE; a public.hr_attendance%ROWTYPE; day date; rid uuid;
BEGIN
 SELECT * INTO e FROM public.hr_employees WHERE id=NEW.employee_id FOR UPDATE;
 IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
 IF EXISTS(SELECT 1 FROM public.hr_leave_requests WHERE employee_id=NEW.employee_id AND id<>NEW.id AND status='approved' AND start_date<=NEW.end_date AND end_date>=NEW.start_date) THEN RAISE EXCEPTION 'Leave conflicts with another approved request'; END IF;
 FOR day IN SELECT d::date FROM generate_series(NEW.start_date::timestamp,NEW.end_date::timestamp,'1 day') d LOOP
 IF public.hrm_leave_days(e.id,day,day,false)>0 THEN
 SELECT * INTO a FROM public.hr_attendance WHERE employee_id=e.id AND attendance_date=day FOR UPDATE;
 IF a.id IS NULL THEN
 INSERT INTO public.hr_attendance(company_id,employee_id,attendance_date,status,source_leave_id,notes) VALUES(e.company_id,e.id,day,CASE WHEN NEW.half_day THEN 'half_day' ELSE 'leave' END,NEW.id,'Approved leave') RETURNING id INTO rid;
 INSERT INTO public.hr_audit_logs(entity_type,entity_id,company_id,action,reason,after_data) SELECT 'hr_attendance',rid,e.company_id,'leave_approved','Approved leave',to_jsonb(x) FROM public.hr_attendance x WHERE id=rid;
 END IF; END IF; END LOOP;
 ELSIF TG_OP='UPDATE' AND OLD.status='approved' AND NEW.status<>'approved' THEN
 FOR a IN SELECT * FROM public.hr_attendance WHERE source_leave_id=NEW.id FOR UPDATE LOOP
 INSERT INTO public.hr_audit_logs(entity_type,entity_id,company_id,action,reason,before_data) VALUES('hr_attendance',a.id,a.company_id,'leave_reversed','Leave approval reversed',to_jsonb(a));
 DELETE FROM public.hr_attendance WHERE id=a.id AND source_leave_id=NEW.id;
 END LOOP;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER hr_leave_attendance_reconcile AFTER INSERT OR UPDATE OF status ON public.hr_leave_requests FOR EACH ROW EXECUTE FUNCTION public.hrm_reconcile_leave_attendance();
CREATE OR REPLACE FUNCTION public.hrm_pending_page_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='hr_holidays' THEN
 PERFORM 1 FROM public.companies WHERE id=NEW.company_id FOR UPDATE;
 IF NEW.kind='optional' THEN NEW.details:=NEW.details||jsonb_build_object('optional',true); END IF;
 IF EXISTS(SELECT 1 FROM public.hr_holidays h WHERE h.id<>NEW.id AND h.company_id=NEW.company_id AND h.branch_id IS NOT DISTINCT FROM NEW.branch_id AND lower(trim(h.title))=lower(trim(NEW.title)) AND h.start_date<=NEW.end_date AND h.end_date>=NEW.start_date) THEN RAISE EXCEPTION 'A matching holiday already exists in this scope'; END IF;
 ELSIF TG_TABLE_NAME='hr_announcements' THEN
 IF NEW.status='published' AND length(trim(coalesce(NEW.details->>'description','')))=0 THEN RAISE EXCEPTION 'Announcement message required'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER hr_holiday_pending_guard BEFORE INSERT OR UPDATE ON public.hr_holidays FOR EACH ROW EXECUTE FUNCTION public.hrm_pending_page_guard();
CREATE TRIGGER hr_announcement_pending_guard BEFORE INSERT OR UPDATE ON public.hr_announcements FOR EACH ROW EXECUTE FUNCTION public.hrm_pending_page_guard();