CREATE POLICY ad_routed_private_exact_boundary ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING(private_owner_id IS NULL OR company_id IS NULL OR public.routing_admin() OR public.ad_routed_private_access(id)) WITH CHECK(private_owner_id IS NULL OR company_id IS NULL OR public.routing_admin() OR public.ad_routed_private_access(id));
DO $migration$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.lead_company_stage_guard()'::regprocedure) INTO definition;
definition:=replace(definition,'NEW.company_id IS NOT NULL OR owner_id IS DISTINCT FROM','(NEW.company_id IS NOT NULL AND NEW.private_owner_id IS NULL) OR owner_id IS DISTINCT FROM');
definition:=replace(definition,'AND NEW.company_id IS NULL AND stage_id=NEW.stage_id','AND (NEW.company_id IS NULL OR NEW.private_owner_id IS NOT NULL) AND stage_id=NEW.stage_id');
EXECUTE definition;
END $migration$;