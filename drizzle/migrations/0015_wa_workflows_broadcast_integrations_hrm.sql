CREATE TABLE public.wa_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  trigger text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_workflows TO authenticated;
GRANT ALL ON public.wa_workflows TO service_role;
ALTER TABLE public.wa_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage wa workflows" ON public.wa_workflows FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER wa_workflows_updated BEFORE UPDATE ON public.wa_workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.wa_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','event')),
  event_trigger text,
  audience jsonb NOT NULL DEFAULT '{}',
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_params jsonb NOT NULL DEFAULT '[]',
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','processing','completed','cancelled')),
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  read_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_broadcasts TO authenticated;
GRANT ALL ON public.wa_broadcasts TO service_role;
ALTER TABLE public.wa_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage wa broadcasts" ON public.wa_broadcasts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER wa_broadcasts_updated BEFORE UPDATE ON public.wa_broadcasts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE FUNCTION public.guard_broadcast_counts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.sent_count IS DISTINCT FROM OLD.sent_count OR NEW.delivered_count IS DISTINCT FROM OLD.delivered_count OR NEW.read_count IS DISTINCT FROM OLD.read_count OR NEW.failed_count IS DISTINCT FROM OLD.failed_count OR (NEW.status IN ('processing','completed') AND NEW.status IS DISTINCT FROM OLD.status)) THEN
    RAISE EXCEPTION 'Delivery progress is recorded only by the WhatsApp integration';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wa_broadcasts_guard BEFORE UPDATE ON public.wa_broadcasts FOR EACH ROW EXECUTE FUNCTION public.guard_broadcast_counts();

CREATE TABLE public.wa_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{8,15}$'),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_suppression TO authenticated;
GRANT ALL ON public.wa_suppression TO service_role;
ALTER TABLE public.wa_suppression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suppression" ON public.wa_suppression FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.integration_settings (
  key text PRIMARY KEY,
  status text NOT NULL DEFAULT 'setup_needed' CHECK (status IN ('setup_needed','pending','connected','disabled')),
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage integration settings" ON public.integration_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin') AND status <> 'connected');

CREATE TABLE public.hr_branches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, city text NOT NULL DEFAULT '', is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.hr_departments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.hr_designations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text,
  department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  designation_id uuid REFERENCES public.hr_designations(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.hr_branches(id) ON DELETE SET NULL,
  joining_date date,
  access_status text NOT NULL DEFAULT 'pending' CHECK (access_status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hr_employees_code_uq ON public.hr_employees (employee_code) WHERE employee_code IS NOT NULL AND employee_code <> '';
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['hr_branches','hr_departments','hr_designations','hr_employees'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''super_admin'')) WITH CHECK (public.has_role(auth.uid(),''super_admin''))', t, t);
  END LOOP;
END $$;
CREATE POLICY "Employees read own record" ON public.hr_employees FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE TRIGGER hr_employees_updated BEFORE UPDATE ON public.hr_employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();