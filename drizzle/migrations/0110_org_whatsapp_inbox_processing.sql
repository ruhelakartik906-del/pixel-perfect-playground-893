ALTER TABLE public.whatsapp_conversations ADD COLUMN connection_id uuid REFERENCES public.org_whatsapp_connections(id), ADD COLUMN inbox_status text NOT NULL DEFAULT 'open' CHECK(inbox_status IN ('open','pending','resolved')), ADD COLUMN human_takeover boolean NOT NULL DEFAULT false, ADD COLUMN inbox_version integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX wa_connection_contact ON public.whatsapp_conversations(connection_id,wa_phone) WHERE connection_id IS NOT NULL;
ALTER TABLE public.whatsapp_messages ADD COLUMN message_type text NOT NULL DEFAULT 'text', ADD COLUMN media_id text, ADD COLUMN media_mime text, ADD COLUMN media_filename text, ADD COLUMN provider_errors jsonb, ADD COLUMN client_id uuid, ADD COLUMN actor_id uuid;
CREATE UNIQUE INDEX wa_outbound_client ON public.whatsapp_messages(conversation_id,client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX wa_provider_message ON public.whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
ALTER TABLE public.org_whatsapp_webhook_events ADD COLUMN delivery_key text, ADD COLUMN attempts integer NOT NULL DEFAULT 0, ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX wa_event_delivery ON public.org_whatsapp_webhook_events(delivery_key) WHERE delivery_key IS NOT NULL;
CREATE TABLE public.whatsapp_internal_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id), actor_id uuid NOT NULL, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.whatsapp_internal_notes TO authenticated; GRANT ALL ON public.whatsapp_internal_notes TO service_role;
ALTER TABLE public.whatsapp_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.wa_inbox_access(_conversation uuid,_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.license_active() AND public.lead_workspace_active() AND EXISTS(SELECT 1 FROM public.whatsapp_conversations c WHERE c.id=_conversation AND c.connection_id IS NOT NULL AND public.is_company_member(auth.uid(),c.company_id) AND public.org_feature_allowed(c.company_id,'whatsapp') AND (public.org_customer_admin(auth.uid(),c.company_id) OR (c.assigned_to=auth.uid() AND public.messaging_allowed(CASE WHEN _write THEN 'whatsapp.create' ELSE 'whatsapp.view' END)))) $$;
REVOKE ALL ON FUNCTION public.wa_inbox_access(uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.wa_inbox_access(uuid,boolean) TO authenticated;
CREATE POLICY wa_notes_read ON public.whatsapp_internal_notes FOR SELECT TO authenticated USING(public.wa_inbox_access(conversation_id,false));
CREATE POLICY wa_org_conversation_read ON public.whatsapp_conversations FOR SELECT TO authenticated USING(public.wa_inbox_access(id,false));
CREATE POLICY wa_org_conversation_boundary ON public.whatsapp_conversations AS RESTRICTIVE FOR ALL TO authenticated USING(connection_id IS NULL OR public.wa_inbox_access(id,false)) WITH CHECK(connection_id IS NULL);
CREATE POLICY wa_org_message_read ON public.whatsapp_messages FOR SELECT TO authenticated USING(public.wa_inbox_access(conversation_id,false));
CREATE POLICY wa_org_message_boundary ON public.whatsapp_messages AS RESTRICTIVE FOR ALL TO authenticated USING(NOT EXISTS(SELECT 1 FROM public.whatsapp_conversations c WHERE c.id=conversation_id AND c.connection_id IS NOT NULL) OR public.wa_inbox_access(conversation_id,false)) WITH CHECK(NOT EXISTS(SELECT 1 FROM public.whatsapp_conversations c WHERE c.id=conversation_id AND c.connection_id IS NOT NULL));
CREATE OR REPLACE FUNCTION public.wa_inbox_action(_id uuid,_action text,_payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.whatsapp_conversations; target uuid;
BEGIN
 IF NOT public.wa_inbox_access(_id,_action<>'read') THEN RAISE EXCEPTION 'Inbox access denied'; END IF;
 SELECT * INTO c FROM public.whatsapp_conversations WHERE id=_id FOR UPDATE;
 IF _action='read' THEN UPDATE public.whatsapp_conversations SET unread_count=0 WHERE id=_id;
 ELSIF _action='status' THEN IF coalesce(_payload->>'status','') NOT IN ('open','pending','resolved') THEN RAISE EXCEPTION 'Invalid status'; END IF; UPDATE public.whatsapp_conversations SET inbox_status=_payload->>'status',inbox_version=inbox_version+1 WHERE id=_id;
 ELSIF _action='takeover' THEN UPDATE public.whatsapp_conversations SET human_takeover=true,inbox_version=inbox_version+1 WHERE id=_id;
 ELSIF _action='note' THEN IF length(trim(coalesce(_payload->>'body',''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Invalid note'; END IF; INSERT INTO public.whatsapp_internal_notes(conversation_id,actor_id,body) VALUES(_id,auth.uid(),trim(_payload->>'body'));
 ELSIF _action='assign' THEN
 IF NOT public.org_customer_admin(auth.uid(),c.company_id) THEN RAISE EXCEPTION 'Customer Admin required'; END IF;
 target:=nullif(_payload->>'user_id','')::uuid;
 IF target IS NOT NULL AND (NOT public.is_company_member(target,c.company_id) OR NOT public.ad_routing_eligible(target,c.company_id) OR NOT EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=target AND 'whatsapp.view'=ANY(r.permissions) AND 'whatsapp.create'=ANY(r.permissions))) THEN RAISE EXCEPTION 'Employee is not authorized for this inbox'; END IF;
 UPDATE public.whatsapp_conversations SET assigned_to=target,human_takeover=true,inbox_version=inbox_version+1 WHERE id=_id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 INSERT INTO public.org_whatsapp_audit(company_id,connection_id,actor,action,detail) VALUES(c.company_id,c.connection_id,auth.uid(),'inbox_'||_action,jsonb_build_object('conversation_id',_id,'assigned_to',target));
END $$;
REVOKE ALL ON FUNCTION public.wa_inbox_action(uuid,text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.wa_inbox_action(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.wa_process_event(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.org_whatsapp_webhook_events; conn public.org_whatsapp_connections; v jsonb; m jsonb; s jsonb; c uuid; mid uuid; kind text; stamp timestamptz; current_status text;
BEGIN
 SELECT * INTO e FROM public.org_whatsapp_webhook_events WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RETURN false; END IF; IF e.processed_at IS NOT NULL THEN RETURN true; END IF;
 SELECT * INTO conn FROM public.org_whatsapp_connections WHERE id=e.connection_id AND company_id=e.company_id AND status NOT IN ('disconnected','revoked');
 IF NOT FOUND THEN UPDATE public.org_whatsapp_webhook_events SET attempts=attempts+1,next_attempt_at=now()+interval '10 minutes',processing_error='Unmatched or inactive connection' WHERE id=_id; RETURN false; END IF;
 BEGIN
 v:=e.payload->'value';
 FOR m IN SELECT value FROM jsonb_array_elements(coalesce(v->'messages','[]')) LOOP
 IF coalesce(m->>'id','')='' OR coalesce(m->>'from','') !~ '^[0-9]{8,15}$' THEN RAISE EXCEPTION 'Invalid message identity'; END IF;
 stamp:=to_timestamp((m->>'timestamp')::bigint); kind:=coalesce(m->>'type','unknown');
 INSERT INTO public.whatsapp_conversations(connection_id,company_id,wa_phone,contact_name) VALUES(conn.id,conn.company_id,m->>'from',coalesce(v->'contacts'->0->'profile'->>'name',m->>'from')) ON CONFLICT(connection_id,wa_phone) WHERE connection_id IS NOT NULL DO NOTHING;
 SELECT id INTO c FROM public.whatsapp_conversations WHERE connection_id=conn.id AND wa_phone=m->>'from' FOR UPDATE;
 INSERT INTO public.whatsapp_messages(conversation_id,direction,body,wa_message_id,status,created_at,message_type,media_id,media_mime,media_filename) VALUES(c,'inbound',coalesce(m->'text'->>'body',m->kind->>'caption',m->'button'->>'text',m->'interactive'->'button_reply'->>'title',m->'interactive'->'list_reply'->>'title',''),' '||m->>'id','received',stamp,kind,m->kind->>'id',m->kind->>'mime_type',m->kind->>'filename') ON CONFLICT(wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING RETURNING id INTO mid;
 IF mid IS NOT NULL THEN UPDATE public.whatsapp_conversations SET unread_count=unread_count+1,last_message_at=greatest(last_message_at,stamp),last_inbound_at=greatest(last_inbound_at,stamp),inbox_status='open' WHERE id=c; END IF;
 END LOOP;
 FOR s IN SELECT value FROM jsonb_array_elements(coalesce(v->'statuses','[]')) LOOP
 SELECT w.id,w.status INTO mid,current_status FROM public.whatsapp_messages w JOIN public.whatsapp_conversations wc ON wc.id=w.conversation_id WHERE w.wa_message_id=s->>'id' AND wc.connection_id=conn.id FOR UPDATE OF w;
 IF mid IS NULL THEN RAISE EXCEPTION 'Status awaiting outbound message'; END IF;
 stamp:=to_timestamp((s->>'timestamp')::bigint);
 UPDATE public.whatsapp_messages SET sent_at=CASE WHEN s->>'status'='sent' THEN coalesce(sent_at,stamp) ELSE sent_at END,delivered_at=CASE WHEN s->>'status'='delivered' THEN coalesce(delivered_at,stamp) ELSE delivered_at END,read_at=CASE WHEN s->>'status'='read' THEN coalesce(read_at,stamp) ELSE read_at END,provider_errors=CASE WHEN s ? 'errors' THEN s->'errors' ELSE provider_errors END,failure_reason=CASE WHEN s->>'status'='failed' THEN 'Meta reported delivery failure' ELSE failure_reason END,status=CASE WHEN s->>'status'='read' THEN 'read' WHEN s->>'status'='delivered' AND current_status<>'read' THEN 'delivered' WHEN s->>'status'='sent' AND current_status NOT IN ('read','delivered','failed') THEN 'sent' WHEN s->>'status'='failed' AND current_status NOT IN ('read','delivered') THEN 'failed' ELSE current_status END WHERE id=mid;
 END LOOP;
 UPDATE public.org_whatsapp_webhook_events SET processed_at=now(),processing_error=NULL WHERE id=_id; RETURN true;
 EXCEPTION WHEN OTHERS THEN UPDATE public.org_whatsapp_webhook_events SET attempts=attempts+1,next_attempt_at=now()+interval '1 minute'*least(60,power(2,least(e.attempts,5))::integer),processing_error=left(SQLERRM,200) WHERE id=_id; RETURN false;
 END;
END $$;
REVOKE ALL ON FUNCTION public.wa_process_event(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.wa_process_event(uuid) TO service_role;