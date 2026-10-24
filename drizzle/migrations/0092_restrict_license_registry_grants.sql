REVOKE ALL ON public.crm_installations, public.crm_installation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crm_installations, public.crm_installation_audit TO authenticated;
GRANT ALL ON public.crm_installations, public.crm_installation_audit TO service_role;