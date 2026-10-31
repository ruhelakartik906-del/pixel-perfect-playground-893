CREATE TABLE public.integration_platform_policies (
 provider text PRIMARY KEY CHECK(provider IN ('whatsapp','meta_ads','google_calendar','google_meet','zoom')),
 enabled boolean NOT NULL DEFAULT true,
 plan_ids uuid[],
 max_connections integer CHECK(max_connections IS NULL OR max_connections>=0),
 required_permissions text[] NOT NULL DEFAULT '{}',
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_platform_policies TO authenticated;
GRANT ALL ON public.integration_platform_policies TO service_role;
ALTER TABLE public.integration_platform_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_policy_read ON public.integration_platform_policies FOR SELECT TO authenticated USING(public.lead_workspace_active());
CREATE POLICY license_gate ON public.integration_platform_policies AS RESTRICTIVE FOR ALL TO authenticated USING(public.license_active()) WITH CHECK(public.license_active());
CREATE TABLE public.integration_platform_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, actor uuid NOT NULL, before_values jsonb, after_values jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_platform_audit TO authenticated;
GRANT ALL ON public.integration_platform_audit TO service_role;
ALTER TABLE public.integration_platform_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_audit_read ON public.integration_platform_audit FOR SELECT TO authenticated USING(public.routing_admin());
CREATE POLICY license_gate ON public.integration_platform_audit AS RESTRICTIVE FOR ALL TO authenticated USING(public.license_active()) WITH CHECK(public.license_active());
CREATE TABLE public.integration_oauth_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, company_id uuid NOT NULL REFERENCES public.companies(id), provider text NOT NULL CHECK(provider IN ('whatsapp','meta_ads','zoom')), nonce_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.integration_oauth_attempts TO service_role;
ALTER TABLE public.integration_oauth_attempts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.integration_provider_allowed(_company uuid,_provider text,_action text DEFAULT 'view') RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.integration_platform_policies; pid uuid; perm text;
BEGIN
 IF _provider NOT IN ('whatsapp','meta_ads','google_calendar','google_meet','zoom') OR _action NOT IN ('view','manage','use') OR NOT public.license_active() OR NOT public.lead_workspace_active() OR NOT public.is_company_member(auth.uid(),_company) OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND is_active) THEN RETURN false; END IF;
 IF NOT public.org_feature_allowed(_company,CASE WHEN _provider='whatsapp' THEN 'whatsapp' ELSE 'integrations' END) THEN RETURN false; END IF;
 SELECT * INTO p FROM public.integration_platform_policies WHERE provider=_provider;
 IF FOUND THEN
  IF NOT p.enabled THEN RETURN false; END IF;
  IF p.plan_ids IS NOT NULL THEN SELECT plan_id INTO pid FROM public.org_subscriptions WHERE company_id=_company; IF pid IS NULL OR NOT pid=ANY(p.plan_ids) THEN RETURN false; END IF; END IF;
 END IF;
 IF _action='manage' THEN RETURN public.org_customer_admin(auth.uid(),_company); END IF;
 IF _action='use' AND NOT public.org_customer_admin(auth.uid(),_company) THEN
  IF cardinality(coalesce(p.required_permissions,'{}'))=0 THEN RETURN false; END IF;
  FOREACH perm IN ARRAY p.required_permissions LOOP
   IF NOT EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=auth.uid() AND perm=ANY(r.permissions)) THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.integration_provider_allowed(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.integration_provider_allowed(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.master_save_integration_policy(_provider text,_enabled boolean,_plans uuid[],_max integer,_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous jsonb; saved jsonb;
BEGIN
 IF NOT public.routing_admin() OR NOT public.license_active() THEN RAISE EXCEPTION 'Active Super Admin required'; END IF;
 IF _provider IS NULL OR _provider NOT IN ('whatsapp','meta_ads','google_calendar','google_meet','zoom') OR _enabled IS NULL OR _max<0 OR cardinality(_permissions)>40 OR cardinality(_plans)>100 THEN RAISE EXCEPTION 'Invalid integration policy'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_plans) id WHERE NOT EXISTS(SELECT 1 FROM public.plans WHERE plans.id=id)) THEN RAISE EXCEPTION 'Unknown plan'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_permissions) p WHERE p IS NULL OR p !~ '^[a-z_]+\.(view|create|edit|delete)$' OR length(p)>80) THEN RAISE EXCEPTION 'Invalid permission'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('integration-policy:'||_provider,0));
 SELECT to_jsonb(p) INTO previous FROM public.integration_platform_policies p WHERE provider=_provider;
 INSERT INTO public.integration_platform_policies(provider,enabled,plan_ids,max_connections,required_permissions,updated_by) VALUES(_provider,_enabled,_plans,_max,coalesce(_permissions,'{}'),auth.uid()) ON CONFLICT(provider) DO UPDATE SET enabled=EXCLUDED.enabled,plan_ids=EXCLUDED.plan_ids,max_connections=EXCLUDED.max_connections,required_permissions=EXCLUDED.required_permissions,updated_by=auth.uid(),updated_at=now() RETURNING to_jsonb(integration_platform_policies) INTO saved;
 INSERT INTO public.integration_platform_audit(provider,actor,before_values,after_values) VALUES(_provider,auth.uid(),previous,saved);
END $$;
REVOKE ALL ON FUNCTION public.master_save_integration_policy(text,boolean,uuid[],integer,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.master_save_integration_policy(text,boolean,uuid[],integer,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.integration_whatsapp_platform_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cap integer;
BEGIN
 IF NEW.status IN ('disconnected','revoked') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.company_id=NEW.company_id AND OLD.status NOT IN ('disconnected','revoked') THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('integration-wa:'||NEW.company_id::text,0));
 SELECT max_connections INTO cap FROM public.integration_platform_policies WHERE provider='whatsapp';
 IF cap IS NOT NULL AND (SELECT count(*) FROM public.org_whatsapp_connections WHERE company_id=NEW.company_id AND status NOT IN ('disconnected','revoked') AND id<>NEW.id)>=cap THEN RAISE EXCEPTION 'Platform WhatsApp connection limit reached'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER integration_whatsapp_platform_limit BEFORE INSERT OR UPDATE ON public.org_whatsapp_connections FOR EACH ROW EXECUTE FUNCTION public.integration_whatsapp_platform_limit();
CREATE OR REPLACE FUNCTION public.integration_consume_attempt(_user uuid,_company uuid,_provider text,_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE found_id uuid;
BEGIN
 UPDATE public.integration_oauth_attempts SET consumed_at=now() WHERE user_id=_user AND company_id=_company AND provider=_provider AND nonce_hash=_hash AND consumed_at IS NULL AND expires_at>now() RETURNING id INTO found_id;
 RETURN found_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.integration_consume_attempt(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_consume_attempt(uuid,uuid,text,text) TO service_role;