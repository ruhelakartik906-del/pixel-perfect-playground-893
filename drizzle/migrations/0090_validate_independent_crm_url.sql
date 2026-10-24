CREATE FUNCTION public.crm_installation_url_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE host text;
BEGIN
 host := regexp_replace(regexp_replace(NEW.crm_url,'^https://',''),':443$','');
 IF NEW.crm_url !~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:443)?$'
 OR host IN ('pixel-perfect-playground-893.lovable.app','hatflow.in','app.hatflow.in')
 OR host ~ '^id-preview--.*\.lovable\.app$' THEN RAISE EXCEPTION 'Use a valid independent customer installation URL'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_installation_url_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_installation_validate_url BEFORE INSERT OR UPDATE OF crm_url ON public.crm_installations FOR EACH ROW EXECUTE FUNCTION public.crm_installation_url_guard();