DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.support_workspace_crm(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'actor uuid; r jsonb; enabled boolean;','actor uuid; r jsonb;');
 EXECUTE definition;
END $$;