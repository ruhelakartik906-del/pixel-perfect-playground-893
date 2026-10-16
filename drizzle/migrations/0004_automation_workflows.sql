CREATE TABLE public.automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  trigger text NOT NULL CHECK (trigger IN ('lead_created','whatsapp_received','stage_changed','followup_due')),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'paused' CHECK (status IN ('active','paused')),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_workflows TO authenticated;
GRANT ALL ON public.automation_workflows TO service_role;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage workflows" ON public.automation_workflows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_automation_workflows_updated_at BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success','failed','skipped')),
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_executions_workflow_idx ON public.automation_executions(workflow_id, created_at DESC);
GRANT SELECT ON public.automation_executions TO authenticated;
GRANT ALL ON public.automation_executions TO service_role;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read executions" ON public.automation_executions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));