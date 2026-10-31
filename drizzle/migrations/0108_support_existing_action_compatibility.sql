CREATE OR REPLACE FUNCTION public.support_write(_session uuid,_action text,_payload jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.org_support_sessions; l public.leads; lead_id uuid; result_status text;
BEGIN
 s:=public.support_session_require(_session,true);
 IF s.id IS NULL THEN RETURN jsonb_build_object('error','Not allowed: session expired or View Only'); END IF;
 IF NOT public.license_active() OR NOT public.org_feature_allowed(s.company_id,'leads') THEN RAISE EXCEPTION 'Customer leads feature unavailable'; END IF;
 IF _action<>'lead.update' THEN RAISE EXCEPTION 'Unknown support action'; END IF;
 lead_id:=(_payload->>'lead_id')::uuid;
 SELECT * INTO l FROM public.leads WHERE id=lead_id AND company_id=s.company_id AND private_owner_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found in this organization'; END IF;
 IF length(coalesce(_payload->>'status',''))>60 OR length(coalesce(_payload->>'requirements',''))>5000 THEN RAISE EXCEPTION 'Invalid lead update'; END IF;
 result_status:=coalesce(nullif(btrim(_payload->>'status'),''),l.status);
 PERFORM set_config('app.support_session',s.id::text,true);
 UPDATE public.leads SET status=result_status,requirements=coalesce(_payload->>'requirements',requirements),updated_at=now() WHERE id=l.id;
 PERFORM set_config('app.support_session','',true);
 PERFORM public.support_audit(s,'lead.update',l.id::text,jsonb_build_object('before',jsonb_build_object('status',l.status,'requirements',l.requirements),'after',jsonb_build_object('status',result_status,'requirements',coalesce(_payload->>'requirements',l.requirements))));
 RETURN jsonb_build_object('ok',true);
END $$;