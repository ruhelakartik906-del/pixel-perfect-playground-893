CREATE TABLE public.support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE, user_id uuid NOT NULL, user_name text NOT NULL, user_email text NOT NULL, company_id uuid REFERENCES public.companies(id), subject text NOT NULL, category text NOT NULL CHECK(category IN ('Technical Issue','Login / Account','Leads / CRM','Billing / Payment','Integrations','Other')), priority text NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Urgent')), description text NOT NULL, status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Waiting for User','Resolved','Closed')), user_read_at timestamptz NOT NULL DEFAULT now(), admin_read_at timestamptz, last_user_message_at timestamptz NOT NULL DEFAULT now(), last_admin_message_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.support_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'super_admin') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') $$;
CREATE FUNCTION public.support_access(_ticket uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=_ticket AND (t.user_id=auth.uid() OR public.support_admin()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active')) $$;
REVOKE ALL ON FUNCTION public.support_admin(),public.support_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_admin(),public.support_access(uuid) TO authenticated;
CREATE POLICY support_ticket_read ON public.support_tickets FOR SELECT TO authenticated USING (public.support_access(id));
CREATE TABLE public.support_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE, sender_id uuid NOT NULL, sender_name text NOT NULL, sender_role text NOT NULL CHECK(sender_role IN ('user','admin')), body text NOT NULL, is_private boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_message_read ON public.support_messages FOR SELECT TO authenticated USING(public.support_access(ticket_id) AND (NOT is_private OR public.support_admin()));
CREATE TABLE public.support_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,uploaded_by uuid NOT NULL,filename text NOT NULL,path text NOT NULL UNIQUE,mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','application/pdf')),size bigint NOT NULL CHECK(size>0 AND size<=5242880),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.support_attachments TO authenticated;
GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_attachment_read ON public.support_attachments FOR SELECT TO authenticated USING(public.support_access(ticket_id) AND (message_id IS NULL OR EXISTS(SELECT 1 FROM public.support_messages m WHERE m.id=message_id AND (NOT m.is_private OR public.support_admin()))));
CREATE TABLE public.support_ticket_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,actor_id uuid NOT NULL,action text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.support_ticket_events TO authenticated;
GRANT ALL ON public.support_ticket_events TO service_role;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_event_read ON public.support_ticket_events FOR SELECT TO authenticated USING(public.support_access(ticket_id));
CREATE INDEX support_ticket_owner ON public.support_tickets(user_id,updated_at DESC);
CREATE INDEX support_message_ticket ON public.support_messages(ticket_id,created_at);
CREATE INDEX support_event_ticket ON public.support_ticket_events(ticket_id,created_at);
CREATE FUNCTION public.support_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.profiles; t public.support_tickets; cid uuid; mid uuid; aid uuid; adm boolean; field text; value text;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=auth.uid() AND account_status='active';
 IF p.id IS NULL THEN RAISE EXCEPTION 'Active authenticated account required'; END IF;
 adm:=public.support_admin();
 IF _action='create' THEN
  cid:=NULLIF(_payload->>'company_id','')::uuid;
  IF cid IS NULL THEN
   IF (SELECT count(*) FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id AND c.is_active WHERE cm.user_id=p.id)>1 THEN RAISE EXCEPTION 'Choose your company'; END IF;
   SELECT cm.company_id INTO cid FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id AND c.is_active WHERE cm.user_id=p.id LIMIT 1;
  END IF;
  IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_members cm JOIN public.companies c ON c.id=cm.company_id AND c.is_active WHERE cm.company_id=cid AND cm.user_id=p.id) THEN RAISE EXCEPTION 'Company membership required'; END IF;
  IF length(trim(coalesce(_payload->>'subject','')))=0 OR length(_payload->>'subject')>200 OR length(trim(coalesce(_payload->>'description','')))=0 OR length(_payload->>'description')>10000 THEN RAISE EXCEPTION 'Subject and description required'; END IF;
  INSERT INTO public.support_tickets(user_id,user_name,user_email,company_id,subject,category,priority,description) VALUES(p.id,p.full_name,p.email,cid,trim(_payload->>'subject'),_payload->>'category',_payload->>'priority',trim(_payload->>'description')) RETURNING * INTO t;
 ELSE
  SELECT * INTO t FROM public.support_tickets WHERE id=(_payload->>'id')::uuid FOR UPDATE;
  IF t.id IS NULL OR NOT public.support_access(t.id) THEN RAISE EXCEPTION 'Ticket not found or access denied'; END IF;
  IF _action='reply' THEN
   IF coalesce((_payload->>'private')::boolean,false) AND NOT adm THEN RAISE EXCEPTION 'Private notes require Super Admin'; END IF;
   IF length(trim(coalesce(_payload->>'body','')))=0 OR length(_payload->>'body')>10000 THEN RAISE EXCEPTION 'Message required'; END IF;
   IF t.status IN ('Resolved','Closed') AND NOT adm THEN RAISE EXCEPTION 'Reopen ticket before replying'; END IF;
   INSERT INTO public.support_messages(ticket_id,sender_id,sender_name,sender_role,body,is_private) VALUES(t.id,p.id,p.full_name,CASE WHEN adm THEN 'admin' ELSE 'user' END,trim(_payload->>'body'),coalesce((_payload->>'private')::boolean,false)) RETURNING id INTO mid;
   UPDATE public.support_tickets SET updated_at=now(),last_admin_message_at=CASE WHEN adm AND NOT coalesce((_payload->>'private')::boolean,false) THEN now() ELSE last_admin_message_at END,last_user_message_at=CASE WHEN NOT adm THEN now() ELSE last_user_message_at END WHERE id=t.id;
   IF coalesce((_payload->>'private')::boolean,false) THEN RETURN mid; END IF;
  ELSIF _action='status' OR _action='priority' THEN
   IF NOT adm THEN RAISE EXCEPTION 'Super Admin required'; END IF;
   value:=_payload->>'value';
   IF _action='status' THEN UPDATE public.support_tickets SET status=value,updated_at=now() WHERE id=t.id;
   ELSE UPDATE public.support_tickets SET priority=value,updated_at=now() WHERE id=t.id; END IF;
  ELSIF _action='reopen' THEN
   IF t.user_id<>p.id OR t.status NOT IN ('Resolved','Closed') THEN RAISE EXCEPTION 'Only the owner may reopen a resolved or closed ticket'; END IF;
   UPDATE public.support_tickets SET status='Open',updated_at=now(),last_user_message_at=now() WHERE id=t.id;
  ELSIF _action='read' THEN
   IF coalesce((_payload->>'admin')::boolean,false) THEN
    IF NOT adm THEN RAISE EXCEPTION 'Super Admin required'; END IF;
    UPDATE public.support_tickets SET admin_read_at=now() WHERE id=t.id;
   ELSE
    IF t.user_id<>p.id THEN RAISE EXCEPTION 'Owner required'; END IF;
    UPDATE public.support_tickets SET user_read_at=now() WHERE id=t.id;
   END IF;
   RETURN t.id;
  ELSIF _action='attachment' THEN
   IF left(_payload->>'path',length(t.id::text)+1)<>t.id::text||'/' THEN RAISE EXCEPTION 'Invalid attachment path'; END IF;
   mid:=NULLIF(_payload->>'message_id','')::uuid;
   IF mid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.support_messages WHERE id=mid AND ticket_id=t.id AND sender_id=p.id) THEN RAISE EXCEPTION 'Invalid attachment message'; END IF;
   INSERT INTO public.support_attachments(ticket_id,message_id,uploaded_by,filename,path,mime,size) VALUES(t.id,mid,p.id,_payload->>'filename',_payload->>'path',_payload->>'mime',(_payload->>'size')::bigint) RETURNING id INTO aid;
  ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 END IF;
 INSERT INTO public.support_ticket_events(ticket_id,actor_id,action,detail) VALUES(t.id,p.id,_action,CASE WHEN _action IN ('status','priority') THEN jsonb_build_object('before',CASE WHEN _action='status' THEN t.status ELSE t.priority END,'after',value) ELSE '{}'::jsonb END);
 RETURN coalesce(mid,aid,t.id);
END $$;
REVOKE ALL ON FUNCTION public.support_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_action(text,jsonb) TO authenticated;
CREATE POLICY support_private_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='support-private-files' AND EXISTS(SELECT 1 FROM public.support_attachments a WHERE a.path=name));
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets,public.support_messages;