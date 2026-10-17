CREATE OR REPLACE FUNCTION public.hrm_leave_request_with_status(_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; state text:=coalesce(_payload->>'status','pending');
BEGIN
 IF state NOT IN ('pending','approved','rejected','cancelled') THEN RAISE EXCEPTION 'Invalid leave status'; END IF;
 IF _payload->>'self'='true' AND state<>'pending' THEN RAISE EXCEPTION 'Employee requests must start pending'; END IF;
 rid:=public.hrm_leave_action('request',_payload-'status');
 IF state<>'pending' THEN PERFORM public.hrm_leave_action(CASE state WHEN 'approved' THEN 'approve' WHEN 'rejected' THEN 'reject' ELSE 'cancel' END,jsonb_build_object('id',rid,'reason',_payload->>'reason')); END IF;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.hrm_leave_request_with_status(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hrm_leave_request_with_status(jsonb) TO authenticated;