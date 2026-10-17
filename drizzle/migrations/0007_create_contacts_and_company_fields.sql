CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contacts" ON public.contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Members read own company contacts" ON public.contacts FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

ALTER TABLE public.companies ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN industry TEXT NOT NULL DEFAULT '';

CREATE INDEX contacts_company_id_idx ON public.contacts (company_id);

CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();