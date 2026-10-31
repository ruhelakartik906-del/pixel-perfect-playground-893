ALTER TABLE public.whatsapp_conversations ADD COLUMN provider_phone text;
COMMENT ON COLUMN public.whatsapp_conversations.wa_phone IS 'Legacy contact number; organization-connected records use a connection-scoped key here and retain the actual number in provider_phone.';
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
 INSERT INTO public.whatsapp_conversations(connection_id,company_id,wa_phone,provider_phone,contact_name) VALUES(conn.id,conn.company_id,conn.id::text||':'||(m->>'from'),m->>'from',coalesce(v->'contacts'->0->'profile'->>'name',m->>'from')) ON CONFLICT(connection_id,wa_phone) WHERE connection_id IS NOT NULL DO NOTHING;
 SELECT id INTO c FROM public.whatsapp_conversations WHERE connection_id=conn.id AND provider_phone=m->>'from' FOR UPDATE;
 INSERT INTO public.whatsapp_messages(conversation_id,direction,body,wa_message_id,status,created_at,message_type,media_id,media_mime,media_filename) VALUES(c,'inbound',coalesce(m->'text'->>'body',m->kind->>'caption',m->'button'->>'text',m->'interactive'->'button_reply'->>'title',m->'interactive'->'list_reply'->>'title',''),m->>'id','received',stamp,kind,m->kind->>'id',m->kind->>'mime_type',m->kind->>'filename') ON CONFLICT(wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING RETURNING id INTO mid;
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
CREATE OR REPLACE FUNCTION public.wa_reserve_send(_conversation uuid,_client uuid,_actor uuid,_body text,_type text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.whatsapp_conversations; mid uuid; cap bigint; used bigint;
BEGIN
 SELECT * INTO c FROM public.whatsapp_conversations WHERE id=_conversation FOR UPDATE;
 IF c.connection_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.org_whatsapp_connections WHERE id=c.connection_id AND status='connected' AND token_ok AND webhook_subscribed) THEN RAISE EXCEPTION 'Verified connection required'; END IF;
 IF NOT public.org_feature_allowed(c.company_id,'whatsapp') OR EXISTS(SELECT 1 FROM public.integration_platform_policies WHERE provider='whatsapp' AND NOT enabled) THEN RAISE EXCEPTION 'WhatsApp unavailable'; END IF;
 SELECT id INTO mid FROM public.whatsapp_messages WHERE conversation_id=_conversation AND client_id=_client; IF FOUND THEN RETURN mid; END IF;
 IF _type<>'template' AND (c.last_inbound_at IS NULL OR c.last_inbound_at<=now()-interval '24 hours') THEN RAISE EXCEPTION 'Approved template required outside the 24-hour customer window'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wa-month:'||c.company_id::text,0));
 SELECT monthly_whatsapp_messages INTO cap FROM public.org_usage_limits WHERE company_id=c.company_id;
 SELECT count(*) INTO used FROM public.whatsapp_messages m JOIN public.whatsapp_conversations wc ON wc.id=m.conversation_id WHERE wc.company_id=c.company_id AND m.direction='outbound' AND m.created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' AND m.status<>'failed';
 IF cap IS NOT NULL AND used>=cap THEN RAISE EXCEPTION 'Monthly WhatsApp message limit reached'; END IF;
 INSERT INTO public.whatsapp_messages(conversation_id,direction,body,status,client_id,actor_id,message_type) VALUES(_conversation,'outbound',_body,'sending',_client,_actor,_type) RETURNING id INTO mid;
 UPDATE public.whatsapp_conversations SET human_takeover=true,inbox_version=inbox_version+1 WHERE id=_conversation;
 RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.wa_reserve_send(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.wa_reserve_send(uuid,uuid,uuid,text,text) TO service_role;