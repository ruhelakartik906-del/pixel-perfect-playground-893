CREATE OR REPLACE FUNCTION public.make_authenticated_intake(_key uuid,_source uuid,_payload jsonb,_dry_run boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.make_lead_sources; candidate public.make_lead_sources; r public.ad_routing_rules; result jsonb; score integer; tied integer;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Authorization required'; END IF;
 PERFORM 1 FROM public.make_api_keys WHERE id=_key AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Key revoked'; END IF;
 PERFORM pg_advisory_xact_lock(84219631);
 SELECT * INTO s FROM public.make_lead_sources WHERE id=_source;
 SELECT * INTO candidate FROM public.make_lead_sources WHERE page_id=_payload->>'page_id' AND form_id=_payload->>'form_id' AND (campaign_id='' OR campaign_id=_payload->>'campaign_id') AND (ad_id='' OR ad_id=_payload->>'ad_id') ORDER BY (CASE WHEN campaign_id<>'' THEN 1 ELSE 0 END)+(CASE WHEN ad_id<>'' THEN 2 ELSE 0 END) DESC LIMIT 1;
 IF candidate.id IS DISTINCT FROM _source OR NOT candidate.active OR candidate.archived THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Source unavailable'; END IF;
 score:=(CASE WHEN candidate.campaign_id<>'' THEN 1 ELSE 0 END)+(CASE WHEN candidate.ad_id<>'' THEN 2 ELSE 0 END);
 SELECT count(*) INTO tied FROM public.make_lead_sources WHERE page_id=_payload->>'page_id' AND form_id=_payload->>'form_id' AND (campaign_id='' OR campaign_id=_payload->>'campaign_id') AND (ad_id='' OR ad_id=_payload->>'ad_id') AND (CASE WHEN campaign_id<>'' THEN 1 ELSE 0 END)+(CASE WHEN ad_id<>'' THEN 2 ELSE 0 END)=score;
 IF tied<>1 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Ambiguous source'; END IF;
 IF s.rule_id IS NOT NULL THEN
  SELECT * INTO r FROM public.ad_routing_rules WHERE id=s.rule_id;
  IF r.company_id IS DISTINCT FROM s.company_id OR r.account_id IS DISTINCT FROM s.account_id OR r.status='deleted' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Routing mapping unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.ad_routing_rules other WHERE other.status='active' AND other.company_id=s.company_id AND other.account_id=s.account_id AND (other.page_id='' OR other.page_id=_payload->>'page_id') AND (other.campaign_id='' OR other.campaign_id=_payload->>'campaign_id') AND (other.ad_id='' OR other.ad_id=_payload->>'ad_id') AND (other.adset_id='' OR other.adset_id=_payload->>'adset_id') AND (other.creative_id='' OR other.creative_id=_payload->>'creative_id') AND (CASE WHEN other.creative_id<>'' THEN 4 WHEN other.ad_id<>'' THEN 3 WHEN other.campaign_id<>'' THEN 2 ELSE 1 END)>(CASE WHEN r.creative_id<>'' THEN 4 WHEN r.ad_id<>'' THEN 3 WHEN r.campaign_id<>'' THEN 2 ELSE 1 END)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='More specific routing rule exists'; END IF;
 END IF;
 result:=public.make_lead_intake(s.company_id,s.account_id,_payload,_dry_run,s.id);
 UPDATE public.make_api_keys SET last_used_at=now() WHERE id=_key;
 INSERT INTO public.make_intake_logs(key_id,source_id,status,http_status,code,lead_id,is_test) VALUES(_key,_source,result->>'status',CASE WHEN result->>'status'='created' THEN 201 ELSE 200 END,'OK',nullif(result->>'lead_id','')::uuid,_dry_run);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.make_authenticated_intake(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.make_authenticated_intake(uuid,uuid,jsonb,boolean) TO service_role;