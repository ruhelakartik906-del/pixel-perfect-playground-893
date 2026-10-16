CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'deal' CHECK (kind IN ('lead','deal')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lead','deal')),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2684FF',
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.crm_stages(pipeline_id, kind, position);
CREATE TABLE public.crm_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('source','tag','category','contract_type')),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2684FF',
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);
CREATE TABLE public.crm_list_views (
  module text PRIMARY KEY CHECK (module IN ('leads','deals')),
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.crm_options(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  business_category text NOT NULL DEFAULT '',
  requirements text NOT NULL DEFAULT '',
  interest_level text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  form_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_account_id text, meta_page_id text, meta_campaign_id text, meta_campaign_name text,
  meta_adset_id text, meta_ad_id text, meta_ad_name text, meta_form_id text, meta_lead_id text UNIQUE,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.leads(assigned_to);
CREATE INDEX ON public.leads(company_id);
CREATE INDEX ON public.leads(created_at DESC);
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  title text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  contract_type_id uuid REFERENCES public.crm_options(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.deals(assigned_to);
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  actor_id uuid,
  type text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lead_activities(lead_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies, public.company_members, public.crm_pipelines, public.crm_stages,
  public.crm_options, public.crm_list_views, public.leads, public.deals, public.lead_activities TO authenticated;
GRANT ALL ON public.companies, public.company_members, public.crm_pipelines, public.crm_stages,
  public.crm_options, public.crm_list_views, public.leads, public.deals, public.lead_activities TO service_role;

CREATE OR REPLACE FUNCTION public.is_company_member(_user uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _company IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user AND company_id = _company)
$$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_list_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Members read own companies" ON public.companies FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "Admins manage members" ON public.company_members FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Users read own memberships" ON public.company_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage pipelines" ON public.crm_pipelines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Signed-in read pipelines" ON public.crm_pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stages" ON public.crm_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Signed-in read stages" ON public.crm_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage options" ON public.crm_options FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Signed-in read options" ON public.crm_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage list views" ON public.crm_list_views FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Signed-in read list views" ON public.crm_list_views FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Assignees read leads" ON public.leads FOR SELECT TO authenticated USING (assigned_to = auth.uid() AND public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Assignees update leads" ON public.leads FOR UPDATE TO authenticated USING (assigned_to = auth.uid() AND public.is_company_member(auth.uid(), company_id)) WITH CHECK (assigned_to = auth.uid() AND public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins manage deals" ON public.deals FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Assignees read deals" ON public.deals FOR SELECT TO authenticated USING (assigned_to = auth.uid() AND public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Assignees update deals" ON public.deals FOR UPDATE TO authenticated USING (assigned_to = auth.uid() AND public.is_company_member(auth.uid(), company_id)) WITH CHECK (assigned_to = auth.uid() AND public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins manage activities" ON public.lead_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Assignees read activities" ON public.lead_activities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid() AND public.is_company_member(auth.uid(), l.company_id)));
CREATE POLICY "Assignees add activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid() AND public.is_company_member(auth.uid(), l.company_id)));

-- Non-admins can never change assignment, company or Meta identifiers
CREATE OR REPLACE FUNCTION public.guard_crm_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'super_admin') THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Only an administrator can reassign records';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leads_guard BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_crm_record();
CREATE TRIGGER deals_guard BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.guard_crm_record();

-- Activity history for lead create / stage / assignment changes
CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_activities(lead_id, actor_id, type, detail) VALUES (NEW.id, auth.uid(), 'created', 'Lead created');
  ELSE
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      INSERT INTO public.lead_activities(lead_id, actor_id, type, detail) VALUES (NEW.id, auth.uid(), 'stage_changed', COALESCE((SELECT name FROM public.crm_stages WHERE id = NEW.stage_id), 'No stage'));
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.lead_activities(lead_id, actor_id, type, detail) VALUES (NEW.id, auth.uid(), 'reassigned', COALESCE(NEW.assigned_to::text, 'Unassigned'));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.lead_activities(lead_id, actor_id, type, detail) VALUES (NEW.id, auth.uid(), 'status_changed', NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leads_activity AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_activity();

-- Default configuration
WITH p AS (INSERT INTO public.crm_pipelines(name, kind, is_default, position) VALUES ('Sales', 'deal', true, 0) RETURNING id)
INSERT INTO public.crm_stages(pipeline_id, kind, name, color, position)
SELECT p.id, s.kind, s.name, s.color, s.pos FROM p, (VALUES
  ('lead','New','#2684FF',0),('lead','Contacted','#F59E0B',1),('lead','Qualified','#22C55E',2),
  ('deal','New Contact','#2684FF',0),('deal','Follow-up','#7C4DF6',1),('deal','Processing','#F59E0B',2),
  ('deal','Pending','#94A3B8',3),('deal','Won','#22C55E',4),('deal','Lost','#EF4444',5)) AS s(kind,name,color,pos);
INSERT INTO public.crm_options(category, name, position) VALUES
  ('source','Facebook Ads',0),('source','Instagram Ads',1),('source','Website',2),('source','Referral',3),('source','Manual',4);
INSERT INTO public.crm_list_views(module, columns) VALUES
  ('leads','["phone","stage","customer_name","source","assignee","company","campaign","email","business_name","business_category","requirements","interest_level","created_at","status"]'),
  ('deals','["title","stage","amount","assignee","company","created_at","status"]');