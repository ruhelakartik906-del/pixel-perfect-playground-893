DROP POLICY IF EXISTS "Signed-in read pipelines" ON public.crm_pipelines;
CREATE POLICY "Active users read pipelines" ON public.crm_pipelines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active'));
DROP POLICY IF EXISTS "Signed-in read stages" ON public.crm_stages;
CREATE POLICY "Active users read stages" ON public.crm_stages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active'));
DROP POLICY IF EXISTS "Signed-in read options" ON public.crm_options;
CREATE POLICY "Active users read options" ON public.crm_options FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active'));
DROP POLICY IF EXISTS "Signed-in read list views" ON public.crm_list_views;
CREATE POLICY "Active users read list views" ON public.crm_list_views FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active'));
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit valid contact form" ON public.contact_submissions FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(coalesce(name,''))) BETWEEN 1 AND 120
  AND length(coalesce(email,'')) BETWEEN 3 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(coalesce(company,'')) <= 160
  AND length(coalesce(phone,'')) <= 40
  AND length(btrim(coalesce(message,''))) BETWEEN 1 AND 5000
);