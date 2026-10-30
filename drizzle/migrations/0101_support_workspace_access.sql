ALTER TABLE public.org_support_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ended_by uuid,
  ADD COLUMN IF NOT EXISTS end_reason text;

CREATE TABLE public.org_support_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.org_support_sessions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX org_support_audit_session_idx ON public.org_support_audit(session_id, created_at DESC);
CREATE INDEX org_support_audit_company_idx ON public.org_support_audit(company_id, created_at DESC);
GRANT SELECT ON public.org_support_audit TO authenticated;
GRANT ALL ON public.org_support_audit TO service_role;
ALTER TABLE public.org_support_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read support audit" ON public.org_support_audit FOR SELECT TO authenticated USING (public.routing_admin());
CREATE POLICY "Customer admins read own support audit" ON public.org_support_audit FOR SELECT TO authenticated USING (public.org_customer_admin(auth.uid(), company_id));
CREATE POLICY license_gate ON public.org_support_audit AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());

-- Sessions are read-only through the Data API; all changes go through the RPCs below.
DROP POLICY IF EXISTS "Admins manage support sessions" ON public.org_support_sessions;
REVOKE INSERT, UPDATE, DELETE ON public.org_support_sessions FROM authenticated;
CREATE POLICY "Admins read support sessions" ON public.org_support_sessions FOR SELECT TO authenticated USING (public.routing_admin());
CREATE POLICY "Customer admins read own support sessions" ON public.org_support_sessions FOR SELECT TO authenticated USING (public.org_customer_admin(auth.uid(), company_id));
DROP POLICY IF EXISTS license_gate ON public.org_support_sessions;
CREATE POLICY license_gate ON public.org_support_sessions AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());

CREATE OR REPLACE FUNCTION public.support_audit(_s public.org_support_sessions, _action text, _target text, _detail jsonb)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.org_support_audit(session_id, company_id, actor_id, action, target, detail)
  VALUES (_s.id, _s.company_id, auth.uid(), _action, _target, coalesce(_detail, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.support_audit(public.org_support_sessions, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Returns the caller's live session, or raises. Expired sessions are closed and audited.
CREATE OR REPLACE FUNCTION public.support_session_require(_session uuid, _need_support boolean)
RETURNS public.org_support_sessions LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.org_support_sessions;
BEGIN
  IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
  SELECT * INTO s FROM public.org_support_sessions WHERE id = _session AND master_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Support session not found'; END IF;
  IF s.revoked OR s.ended_at IS NOT NULL THEN RAISE EXCEPTION 'Support session has ended'; END IF;
  IF s.expires_at <= now() THEN
    UPDATE public.org_support_sessions SET ended_at = now(), end_reason = 'expired' WHERE id = s.id RETURNING * INTO s;
    PERFORM public.support_audit(s, 'session.expired', NULL, '{}'::jsonb);
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = s.company_id AND is_active) THEN RAISE EXCEPTION 'Customer organization is not active'; END IF;
  IF _need_support AND s.mode <> 'support' THEN
    PERFORM public.support_audit(s, 'denied.write_in_view_mode', NULL, '{}'::jsonb);
    RETURN NULL;
  END IF;
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.support_session_require(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.support_session_start(_company uuid, _mode text, _reason text, _minutes integer)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.org_support_sessions;
BEGIN
  IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
  IF _mode NOT IN ('view','support') THEN RAISE EXCEPTION 'Invalid access mode'; END IF;
  IF _minutes IS NULL OR _minutes < 5 OR _minutes > 60 THEN RAISE EXCEPTION 'Duration must be 5 to 60 minutes'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 OR length(_reason) > 500 THEN RAISE EXCEPTION 'A reason of 5 to 500 characters is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company AND is_active) THEN RAISE EXCEPTION 'Customer organization is not active'; END IF;
  -- One live session per Master Admin: close any previous one.
  FOR s IN UPDATE public.org_support_sessions SET ended_at = now(), ended_by = auth.uid(), end_reason = 'replaced'
    WHERE master_user_id = auth.uid() AND ended_at IS NULL AND NOT revoked RETURNING * LOOP
    PERFORM public.support_audit(s, 'session.replaced', NULL, '{}'::jsonb);
  END LOOP;
  INSERT INTO public.org_support_sessions(company_id, master_user_id, mode, reason, expires_at)
  VALUES (_company, auth.uid(), _mode, btrim(_reason), now() + make_interval(mins => _minutes)) RETURNING * INTO s;
  PERFORM public.support_audit(s, 'session.start', NULL, jsonb_build_object('mode', _mode, 'minutes', _minutes, 'reason', btrim(_reason)));
  RETURN s.id;
END $$;

CREATE OR REPLACE FUNCTION public.support_session_end(_session uuid, _reason text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.org_support_sessions; is_owner boolean;
BEGIN
  SELECT * INTO s FROM public.org_support_sessions WHERE id = _session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Support session not found'; END IF;
  is_owner := s.master_user_id = auth.uid() AND public.routing_admin();
  IF NOT (is_owner OR public.routing_admin() OR public.org_customer_admin(auth.uid(), s.company_id)) THEN
    RAISE EXCEPTION 'Not allowed to end this support session';
  END IF;
  IF s.ended_at IS NOT NULL OR s.revoked THEN RETURN; END IF;
  UPDATE public.org_support_sessions
     SET ended_at = now(), ended_by = auth.uid(), revoked = NOT is_owner,
         end_reason = CASE WHEN is_owner THEN 'exited' ELSE 'revoked' END
   WHERE id = s.id RETURNING * INTO s;
  PERFORM public.support_audit(s, CASE WHEN is_owner THEN 'session.exit' ELSE 'session.revoked' END, NULL,
    jsonb_build_object('reason', left(coalesce(_reason,''), 500)));
END $$;

CREATE OR REPLACE FUNCTION public.support_read(_session uuid, _resource text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.org_support_sessions; r jsonb;
BEGIN
  s := public.support_session_require(_session, false);
  IF s.id IS NULL THEN RETURN jsonb_build_object('error', 'Support session has expired'); END IF;
  IF _resource = 'overview' THEN
    SELECT jsonb_build_object(
      'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'contact_person', c.contact_person) FROM companies c WHERE c.id = s.company_id),
      'session', jsonb_build_object('id', s.id, 'mode', s.mode, 'expires_at', s.expires_at, 'started_at', s.started_at, 'reason', s.reason),
      'counts', jsonb_build_object(
        'members', (SELECT count(*) FROM company_members WHERE company_id = s.company_id),
        'leads', (SELECT count(*) FROM leads WHERE company_id = s.company_id)))
    INTO r;
  ELSIF _resource = 'leads' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO r FROM (
      SELECT jsonb_build_object('id', l.id, 'customer_name', l.customer_name, 'phone', l.phone, 'email', l.email,
        'status', l.status, 'requirements', l.requirements, 'assigned_to', p.full_name, 'created_at', l.created_at) x
      FROM leads l LEFT JOIN profiles p ON p.id = l.assigned_to
      WHERE l.company_id = s.company_id ORDER BY l.created_at DESC LIMIT 200) q;
  ELSIF _resource = 'employees' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'status', p.account_status,
      'roles', (SELECT coalesce(jsonb_agg(ur.role), '[]'::jsonb) FROM user_roles ur WHERE ur.user_id = p.id)) ORDER BY p.full_name), '[]'::jsonb)
    INTO r FROM company_members m JOIN profiles p ON p.id = m.user_id WHERE m.company_id = s.company_id;
  ELSE RAISE EXCEPTION 'Unknown resource';
  END IF;
  PERFORM public.support_audit(s, 'view.' || _resource, NULL, '{}'::jsonb);
  RETURN jsonb_build_object('data', r);
END $$;

CREATE OR REPLACE FUNCTION public.support_write(_session uuid, _action text, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.org_support_sessions; before jsonb; lead_id uuid; new_status text; new_req text;
BEGIN
  s := public.support_session_require(_session, true);
  IF s.id IS NULL THEN RETURN jsonb_build_object('error', 'Not allowed: session expired or View Only'); END IF;
  IF _action <> 'lead.update' THEN RAISE EXCEPTION 'Unknown support action'; END IF;
  lead_id := (_payload->>'lead_id')::uuid;
  new_status := nullif(btrim(coalesce(_payload->>'status','')), '');
  new_req := _payload->>'requirements';
  IF new_status IS NOT NULL AND length(new_status) > 60 THEN RAISE EXCEPTION 'Status too long'; END IF;
  IF new_req IS NOT NULL AND length(new_req) > 5000 THEN RAISE EXCEPTION 'Requirements too long'; END IF;
  SELECT jsonb_build_object('status', status, 'requirements', requirements) INTO before
    FROM leads WHERE id = lead_id AND company_id = s.company_id FOR UPDATE;
  IF before IS NULL THEN RAISE EXCEPTION 'Lead not found in this organization'; END IF;
  UPDATE leads SET status = coalesce(new_status, status), requirements = coalesce(new_req, requirements), updated_at = now()
   WHERE id = lead_id AND company_id = s.company_id;
  PERFORM public.support_audit(s, 'lead.update', lead_id::text,
    jsonb_build_object('before', before, 'after', jsonb_build_object('status', coalesce(new_status, before->>'status'), 'requirements', coalesce(new_req, before->>'requirements'))));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.support_session_start(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_session_end(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_read(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_write(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_session_start(uuid, text, text, integer), public.support_session_end(uuid, text), public.support_read(uuid, text), public.support_write(uuid, text, jsonb) TO authenticated;