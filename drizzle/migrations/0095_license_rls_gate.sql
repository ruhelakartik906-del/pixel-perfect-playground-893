-- Server-verified license state, mirrored into the local database by the server gate
-- (service_role only). Fails closed: the seed row blocks direct Data API access until
-- the server verifies the installation with the Master and rewrites this row.
CREATE TABLE public.license_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mode text NOT NULL CHECK (mode IN ('master','customer')),
  verified_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.license_state TO service_role;
ALTER TABLE public.license_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.license_state (id, mode, verified_until) VALUES (true, 'customer', '1970-01-01T00:00:00Z');

CREATE FUNCTION public.license_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.license_state
    WHERE id AND (mode = 'master' OR (verified_until IS NOT NULL AND verified_until > now()))
  );
$$;
REVOKE ALL ON FUNCTION public.license_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.license_active() TO anon, authenticated;

-- Restrictive policies AND with the existing permissive policies, so every current
-- company-isolation, role and record-access condition stays exactly as it is; an
-- inactive/suspended/expired/stale license now also blocks direct browser access.
CREATE POLICY license_gate ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
CREATE POLICY license_gate ON public.companies AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
CREATE POLICY license_gate ON public.crm_stages AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
CREATE POLICY license_gate ON public.crm_pipelines AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
CREATE POLICY license_gate ON public.products_services AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
CREATE POLICY license_gate ON public.sales_customers AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active());
CREATE POLICY license_gate ON public.contact_submissions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (public.license_active()) WITH CHECK (public.license_active());