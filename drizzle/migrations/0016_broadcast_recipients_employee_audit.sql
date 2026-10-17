CREATE TABLE public.wa_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.wa_broadcasts(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^[0-9]{8,15}$'),
  name text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'lead',
  source_id uuid,
  status text NOT NULL DEFAULT 'pending',
  wa_message_id text UNIQUE,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, phone)
);
CREATE INDEX wa_broadcast_recipients_b_idx ON public.wa_broadcast_recipients (broadcast_id);
GRANT SELECT, INSERT, DELETE ON public.wa_broadcast_recipients TO authenticated;
GRANT ALL ON public.wa_broadcast_recipients TO service_role;
ALTER TABLE public.wa_broadcast_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read recipients" ON public.wa_broadcast_recipients FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins stage recipients" ON public.wa_broadcast_recipients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin') AND status = 'pending' AND wa_message_id IS NULL AND EXISTS (SELECT 1 FROM public.wa_broadcasts b WHERE b.id = broadcast_id AND b.status = 'draft'));
CREATE POLICY "Admins remove draft recipients" ON public.wa_broadcast_recipients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') AND EXISTS (SELECT 1 FROM public.wa_broadcasts b WHERE b.id = broadcast_id AND b.status = 'draft'));

ALTER TABLE public.whatsapp_messages ADD COLUMN template_name text, ADD COLUMN sent_at timestamptz, ADD COLUMN delivered_at timestamptz, ADD COLUMN read_at timestamptz, ADD COLUMN failure_reason text, ADD COLUMN broadcast_id uuid REFERENCES public.wa_broadcasts(id) ON DELETE SET NULL;
CREATE INDEX whatsapp_messages_conv_idx ON public.whatsapp_messages (conversation_id, created_at);

ALTER TABLE public.hr_employees ADD COLUMN phone text NOT NULL DEFAULT '', ADD COLUMN employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')), ADD COLUMN reporting_manager_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL, ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE TABLE public.hr_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid DEFAULT auth.uid(),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hr_access_audit TO authenticated;
GRANT ALL ON public.hr_access_audit TO service_role;
ALTER TABLE public.hr_access_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read hr audit" ON public.hr_access_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

-- Approve/reject atomically: updates HR record, login status and audit; never touches roles.
CREATE OR REPLACE FUNCTION public.hr_set_access(_employee uuid, _decision text, _note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.hr_employees%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Super Admin authorization required'; END IF;
  IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO e FROM public.hr_employees WHERE id = _employee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF e.profile_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own access'; END IF;
  UPDATE public.hr_employees SET access_status = _decision WHERE id = _employee;
  UPDATE public.profiles SET account_status = CASE WHEN _decision = 'approved' THEN 'active'::account_status ELSE 'blocked'::account_status END WHERE id = e.profile_id;
  INSERT INTO public.hr_access_audit(employee_id, action, note) VALUES (_employee, _decision, coalesce(_note,''));
END $$;
REVOKE EXECUTE ON FUNCTION public.hr_set_access(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_set_access(uuid,text,text) TO authenticated;