ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS expected_close_date date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS form_id uuid;

CREATE TABLE public.custom_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT 'lead' CHECK (module IN ('lead','deal')),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_forms TO authenticated;
GRANT ALL ON public.custom_forms TO service_role;
ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage forms" ON public.custom_forms FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Signed-in read active forms" ON public.custom_forms FOR SELECT TO authenticated USING (is_active);

CREATE OR REPLACE FUNCTION public.protect_system_forms()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_system THEN RAISE EXCEPTION 'System default templates cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER custom_forms_protect BEFORE DELETE ON public.custom_forms FOR EACH ROW EXECUTE FUNCTION public.protect_system_forms();

INSERT INTO public.custom_forms(name, description, module, is_system, fields) VALUES
('Default Lead Form','System template for capturing new leads','lead',true,
 '[{"id":"customer_name","label":"Customer Name","type":"short_text","required":true},{"id":"phone","label":"Contact Number","type":"phone","required":true},{"id":"email","label":"Email","type":"email","required":false},{"id":"business_name","label":"Business Name","type":"short_text","required":false},{"id":"requirements","label":"Required Service","type":"long_text","required":false}]'),
('Default Deal Form','System template for creating deals','deal',true,
 '[{"id":"title","label":"Deal Name","type":"short_text","required":true},{"id":"amount","label":"Deal Value (INR)","type":"number","required":true},{"id":"expected_close_date","label":"Expected Closing Date","type":"short_text","required":false}]');