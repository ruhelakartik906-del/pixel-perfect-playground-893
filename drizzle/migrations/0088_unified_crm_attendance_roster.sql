ALTER TABLE public.personal_attendance ADD COLUMN status text NOT NULL DEFAULT 'present' CHECK(status IN('present','half_day'));
ALTER TABLE public.personal_attendance ADD CONSTRAINT personal_attendance_checkout_order CHECK(check_out IS NULL OR check_out>=check_in) NOT VALID;
CREATE TABLE public.attendance_roster_exclusions(user_id uuid PRIMARY KEY REFERENCES public.profiles(id),excluded boolean NOT NULL DEFAULT true,updated_by uuid NOT NULL REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.attendance_roster_exclusions TO authenticated;
GRANT ALL ON public.attendance_roster_exclusions TO service_role;
ALTER TABLE public.attendance_roster_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_roster_admin_read ON public.attendance_roster_exclusions FOR SELECT TO authenticated USING(public.routing_admin());
CREATE OR REPLACE FUNCTION public.attendance_account_active(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT (_user=auth.uid() OR public.routing_admin()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=_user AND account_status='active') AND (public.has_role(_user,'client') OR public.has_role(_user,'employee')) AND NOT public.has_role(_user,'super_admin') AND NOT EXISTS(SELECT 1 FROM public.hr_employees WHERE profile_id=_user AND (NOT is_active OR access_status<>'approved')) $$;
REVOKE ALL ON FUNCTION public.attendance_account_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_account_active(uuid) TO authenticated,service_role;
ALTER POLICY "Own or admin attendance read" ON public.personal_attendance USING(public.routing_admin() OR (owner_id=auth.uid() AND public.attendance_account_active(auth.uid())));
CREATE OR REPLACE FUNCTION public.personal_attendance_action(_action text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date:=(now() AT TIME ZONE 'Asia/Kolkata')::date; a public.personal_attendance%ROWTYPE; e public.hr_employees%ROWTYPE; h public.hr_attendance%ROWTYPE;
BEGIN
IF NOT public.attendance_account_active(auth.uid()) THEN RAISE EXCEPTION 'An active authorized Client or Employee account is required'; END IF;
IF _action IS NULL OR _action NOT IN('check_in','check_out','half_day') THEN RAISE EXCEPTION 'Unsupported action'; END IF;
PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
SELECT * INTO e FROM public.hr_employees WHERE profile_id=auth.uid();
SELECT * INTO a FROM public.personal_attendance WHERE owner_id=auth.uid() AND attendance_date=d FOR UPDATE;
IF e.id IS NOT NULL THEN SELECT * INTO h FROM public.hr_attendance WHERE employee_id=e.id AND attendance_date=d FOR UPDATE; END IF;
IF h.id IS NOT NULL OR (a.id IS NULL AND e.company_id IS NOT NULL AND public.hrm_owns_employee(e.id,e.company_id)) THEN
 IF _action IN('check_in','check_out') THEN RETURN public.hrm_attendance_action(_action,'{}'::jsonb); END IF;
 IF NOT public.hrm_owns_employee(e.id,e.company_id) THEN RAISE EXCEPTION 'Approved company attendance access required'; END IF;
 IF h.id IS NULL THEN PERFORM public.hrm_attendance_action('check_in','{}'::jsonb); SELECT * INTO h FROM public.hr_attendance WHERE employee_id=e.id AND attendance_date=d FOR UPDATE; END IF;
 IF h.check_in IS NULL OR h.source_leave_id IS NOT NULL OR h.status NOT IN('present','half_day') THEN RAISE EXCEPTION 'Only your own check-in status may change'; END IF;
 IF h.status='half_day' THEN RETURN h.id; END IF;
 UPDATE public.hr_attendance SET status='half_day',updated_at=now() WHERE id=h.id;
 INSERT INTO public.hr_attendance_events(attendance_id,employee_id,company_id,event,reason) VALUES(h.id,e.id,e.company_id,'correction','Self Half Day');
 INSERT INTO public.hr_audit_logs(entity_type,entity_id,company_id,action,reason,before_data,after_data) SELECT 'hr_attendance',h.id,e.company_id,'half_day','Self Half Day',to_jsonb(h),to_jsonb(x) FROM public.hr_attendance x WHERE id=h.id;
 RETURN h.id;
END IF;
IF _action IN('check_in','half_day') THEN
 IF a.id IS NULL THEN INSERT INTO public.personal_attendance(owner_id,attendance_date,status) VALUES(auth.uid(),d,CASE WHEN _action='half_day' THEN 'half_day' ELSE 'present' END) RETURNING * INTO a;
 ELSIF _action='half_day' THEN UPDATE public.personal_attendance SET status='half_day' WHERE id=a.id; END IF;
ELSE
 IF a.id IS NULL THEN RAISE EXCEPTION 'Check in before checking out'; END IF;
 IF a.check_out IS NULL THEN UPDATE public.personal_attendance SET check_out=now() WHERE id=a.id; END IF;
END IF;
RETURN a.id; END $$;
REVOKE ALL ON FUNCTION public.personal_attendance_action(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.personal_attendance_action(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.attendance_roster_action(_user uuid,_excluded boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Active Super Admin required'; END IF;
IF _excluded IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user) OR public.has_role(_user,'super_admin') THEN RAISE EXCEPTION 'Invalid attendance user'; END IF;
INSERT INTO public.attendance_roster_exclusions(user_id,excluded,updated_by) VALUES(_user,_excluded,auth.uid()) ON CONFLICT(user_id) DO UPDATE SET excluded=EXCLUDED.excluded,updated_by=auth.uid(),updated_at=now(); END $$;
REVOKE ALL ON FUNCTION public.attendance_roster_action(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_roster_action(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_attendance_workspace(_month text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; isadmin boolean:=public.routing_admin(); BEGIN
IF NOT isadmin AND NOT public.attendance_account_active(auth.uid()) THEN RAISE EXCEPTION 'Active attendance access required'; END IF;
IF _month IS NOT NULL AND _month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Invalid month'; END IF;
WITH people AS (
 SELECT p.id,p.id AS profile_id,e.id AS hr_employee_id,e.company_id,e.branch_id,p.full_name AS name,p.email,true AS is_active,(p.created_at AT TIME ZONE 'Asia/Kolkata')::date AS attendance_start,
 COALESCE((SELECT jsonb_agg(cm.company_id) FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id WHERE cm.user_id=p.id AND c.is_active),'[]'::jsonb) AS company_ids,COALESCE(x.excluded,false) AS excluded
 FROM public.profiles p LEFT JOIN public.hr_employees e ON e.profile_id=p.id LEFT JOIN public.attendance_roster_exclusions x ON x.user_id=p.id
 WHERE public.attendance_account_active(p.id) AND (isadmin OR p.id=auth.uid())
), records AS (
 SELECT a.id,p.id AS employee_id,a.employee_id AS hr_employee_id,a.company_id,a.attendance_date,a.status,a.check_in,a.check_out,a.source_leave_id,a.notes,'hr' AS storage FROM public.hr_attendance a JOIN people p ON p.hr_employee_id=a.employee_id WHERE (_month IS NULL OR to_char(a.attendance_date,'YYYY-MM')=_month)
 UNION ALL
 SELECT a.id,p.id,NULL::uuid,p.company_id,a.attendance_date,a.status,a.check_in,a.check_out,NULL::uuid,''::text,'personal'::text FROM public.personal_attendance a JOIN people p ON p.id=a.owner_id WHERE (_month IS NULL OR to_char(a.attendance_date,'YYYY-MM')=_month) AND NOT EXISTS(SELECT 1 FROM public.hr_attendance h WHERE h.employee_id=p.hr_employee_id AND h.attendance_date=a.attendance_date)
), holidays AS (
 SELECT h.* FROM public.hr_holidays h WHERE EXISTS(SELECT 1 FROM people p WHERE h.company_id=p.company_id OR p.company_ids @> to_jsonb(ARRAY[h.company_id]))
), leaves AS (
 SELECT l.id,p.id AS employee_id,l.company_id,l.start_date,l.end_date,l.status,l.half_day FROM public.hr_leave_requests l JOIN people p ON p.hr_employee_id=l.employee_id WHERE l.status='approved'
)
SELECT jsonb_build_object('people',COALESCE((SELECT jsonb_agg(p ORDER BY p.name,p.id) FROM people p),'[]'::jsonb),'attendance',COALESCE((SELECT jsonb_agg(r ORDER BY r.attendance_date DESC,r.id) FROM records r),'[]'::jsonb),'holidays',COALESCE((SELECT jsonb_agg(h) FROM holidays h),'[]'::jsonb),'leaves',COALESCE((SELECT jsonb_agg(l) FROM leaves l),'[]'::jsonb),'isAdmin',isadmin) INTO result;
RETURN result; END $$;
REVOKE ALL ON FUNCTION public.crm_attendance_workspace(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_attendance_workspace(text) TO authenticated;
COMMENT ON FUNCTION public.crm_attendance_workspace(text) IS 'Unified attendance projection: existing HR summaries take precedence; personal records are read without copying. Exclusion changes roster display only.';