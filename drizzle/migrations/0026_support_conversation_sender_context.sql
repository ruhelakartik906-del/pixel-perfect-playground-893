REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.support_tickets,public.support_messages,public.support_attachments,public.support_ticket_events FROM authenticated,anon;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.support_action(text,jsonb)'::regprocedure) INTO definition;
 IF position('IF _action=''reply'' THEN' IN definition)=0 THEN RAISE EXCEPTION 'Support action definition not recognized'; END IF;
 definition:=replace(definition,'IF _action=''reply'' THEN','IF _action=''reply'' THEN
   IF coalesce((_payload->>''admin'')::boolean,false) AND NOT adm THEN RAISE EXCEPTION ''Super Admin required''; END IF;
   IF NOT coalesce((_payload->>''admin'')::boolean,false) THEN
    IF t.user_id<>p.id THEN RAISE EXCEPTION ''Owner required''; END IF;
    adm:=false;
   END IF;');
 EXECUTE definition;
END $migration$;