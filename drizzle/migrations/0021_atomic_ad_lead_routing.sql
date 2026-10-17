ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_creative_id text;
CREATE FUNCTION public.routing_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'super_admin') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') $$;
CREATE FUNCTION public.routing_eligible(_user uuid,_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.company_members m ON m.user_id=p.id JOIN public.companies c ON c.id=m.company_id WHERE p.id=_user AND c.id=_company AND p.account_status='active' AND c.is_active AND NOT public.has_role(p.id,'client') AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('employee','manager','super_admin')) AND NOT EXISTS(SELECT 1 FROM public.hr_employees e WHERE e.profile_id=p.id AND e.company_id=c.id AND (NOT e.is_active OR e.access_status<>'approved'))) $$;
CREATE TABLE public.ad_routing_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(id),name text NOT NULL CHECK(length(trim(name))>0),account_id text NOT NULL CHECK(length(trim(account_id))>0),page_id text NOT NULL DEFAULT '',campaign_id text NOT NULL DEFAULT '',campaign_name text NOT NULL DEFAULT '',adset_id text NOT NULL DEFAULT '',ad_id text NOT NULL DEFAULT '',creative_id text NOT NULL DEFAULT '',creative_name text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','deleted')),total_leads bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ad_routing_rules TO authenticated; GRANT ALL ON public.ad_routing_rules TO service_role;
ALTER TABLE public.ad_routing_rules ENABLE ROW LEVEL SECURITY; CREATE POLICY routing_rules_admin ON public.ad_routing_rules FOR SELECT TO authenticated USING(public.routing_admin());
CREATE TABLE public.ad_routing_steps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),rule_id uuid NOT NULL REFERENCES public.ad_routing_rules(id),user_id uuid NOT NULL REFERENCES public.profiles(id),position integer NOT NULL,quota integer CHECK(quota>0),assigned_count bigint NOT NULL DEFAULT 0 CHECK(assigned_count>=0),UNIQUE(rule_id,position));
GRANT SELECT ON public.ad_routing_steps TO authenticated; GRANT ALL ON public.ad_routing_steps TO service_role;
ALTER TABLE public.ad_routing_steps ENABLE ROW LEVEL SECURITY; CREATE POLICY routing_steps_admin ON public.ad_routing_steps FOR SELECT TO authenticated USING(public.routing_admin());
CREATE TABLE public.lead_assignment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL REFERENCES public.leads(id),company_id uuid REFERENCES public.companies(id),rule_id uuid REFERENCES public.ad_routing_rules(id),user_id uuid REFERENCES public.profiles(id),assignment_type text NOT NULL CHECK(assignment_type IN ('automatic','manual')),status text NOT NULL DEFAULT 'assigned',snapshot jsonb NOT NULL,actor_id uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(lead_id));
GRANT SELECT ON public.lead_assignment_events TO authenticated; GRANT SELECT,INSERT ON public.lead_assignment_events TO service_role;
ALTER TABLE public.lead_assignment_events ENABLE ROW LEVEL SECURITY; CREATE POLICY routing_events_admin ON public.lead_assignment_events FOR SELECT TO authenticated USING(public.routing_admin());
CREATE TABLE public.lead_routing_queue(lead_id uuid PRIMARY KEY REFERENCES public.leads(id),reason text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.lead_routing_queue TO authenticated; GRANT ALL ON public.lead_routing_queue TO service_role;
ALTER TABLE public.lead_routing_queue ENABLE ROW LEVEL SECURITY; CREATE POLICY routing_queue_admin ON public.lead_routing_queue FOR SELECT TO authenticated USING(public.routing_admin());
CREATE TABLE public.ad_routing_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),rule_id uuid REFERENCES public.ad_routing_rules(id),action text NOT NULL,before_data jsonb,after_data jsonb,actor_id uuid,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ad_routing_audit TO authenticated; GRANT SELECT,INSERT ON public.ad_routing_audit TO service_role;
ALTER TABLE public.ad_routing_audit ENABLE ROW LEVEL SECURITY; CREATE POLICY routing_audit_admin ON public.ad_routing_audit FOR SELECT TO authenticated USING(public.routing_admin());
CREATE FUNCTION public.routing_rule_action(_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; oldrow public.ad_routing_rules; rr public.ad_routing_rules; st jsonb; pos integer:=0; sid uuid; before_steps jsonb;
BEGIN
 IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Super Admin authorization required'; END IF;
 PERFORM pg_advisory_xact_lock(84219631);
 rid:=nullif(_payload->>'id','')::uuid;
 IF rid IS NOT NULL THEN SELECT * INTO oldrow FROM public.ad_routing_rules WHERE id=rid FOR UPDATE; IF NOT FOUND OR oldrow.status='deleted' THEN RAISE EXCEPTION 'Rule unavailable'; END IF; END IF;
 SELECT jsonb_agg(to_jsonb(s) ORDER BY position) INTO before_steps FROM public.ad_routing_steps s WHERE rule_id=rid;
 IF _action='save' THEN
  IF rid IS NULL THEN INSERT INTO public.ad_routing_rules(company_id,name,account_id) VALUES((_payload->>'company_id')::uuid,trim(_payload->>'name'),trim(_payload->>'account_id')) RETURNING id INTO rid; END IF;
  IF oldrow.id IS NOT NULL AND oldrow.company_id IS DISTINCT FROM (_payload->>'company_id')::uuid AND oldrow.total_leads>0 THEN RAISE EXCEPTION 'Duplicate the rule to change company after assignments'; END IF;
  UPDATE public.ad_routing_rules SET company_id=(_payload->>'company_id')::uuid,name=trim(_payload->>'name'),account_id=trim(_payload->>'account_id'),page_id=coalesce(trim(_payload->>'page_id'),''),campaign_id=coalesce(trim(_payload->>'campaign_id'),''),campaign_name=coalesce(_payload->>'campaign_name',''),adset_id=coalesce(trim(_payload->>'adset_id'),''),ad_id=coalesce(trim(_payload->>'ad_id'),''),creative_id=coalesce(trim(_payload->>'creative_id'),''),creative_name=coalesce(_payload->>'creative_name',''),status=_payload->>'status',updated_at=now() WHERE id=rid;
  IF jsonb_typeof(_payload->'steps') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Allocation steps required'; END IF;
  DELETE FROM public.ad_routing_steps WHERE rule_id=rid;
  FOR st IN SELECT value FROM jsonb_array_elements(_payload->'steps') LOOP
   pos:=pos+1; sid:=coalesce(nullif(st->>'id','')::uuid,gen_random_uuid());
   INSERT INTO public.ad_routing_steps(id,rule_id,user_id,position,quota,assigned_count) VALUES(sid,rid,(st->>'user_id')::uuid,pos,nullif(st->>'quota','')::integer,coalesce((SELECT (v->>'assigned_count')::bigint FROM jsonb_array_elements(coalesce(before_steps,'[]')) v WHERE v->>'id'=sid::text AND v->>'user_id'=st->>'user_id'),0));
  END LOOP;
 ELSIF _action='duplicate' THEN
  INSERT INTO public.ad_routing_rules(company_id,name,account_id,page_id,campaign_id,campaign_name,adset_id,ad_id,creative_id,creative_name) SELECT company_id,name||' (copy)',account_id,page_id,campaign_id,campaign_name,adset_id,ad_id,creative_id,creative_name FROM public.ad_routing_rules WHERE id=rid RETURNING id INTO rid;
  INSERT INTO public.ad_routing_steps(rule_id,user_id,position,quota) SELECT rid,user_id,position,quota FROM public.ad_routing_steps WHERE rule_id=oldrow.id;
 ELSIF _action='reset' THEN UPDATE public.ad_routing_steps SET assigned_count=0 WHERE rule_id=rid;
 ELSIF _action IN ('active','paused','deleted') THEN UPDATE public.ad_routing_rules SET status=_action,updated_at=now() WHERE id=rid;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 SELECT * INTO rr FROM public.ad_routing_rules WHERE id=rid;
 IF rr.status='active' THEN
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=rr.company_id AND is_active) OR NOT EXISTS(SELECT 1 FROM public.ad_routing_steps WHERE rule_id=rid) THEN RAISE EXCEPTION 'Active company and allocation steps required'; END IF;
  IF EXISTS(SELECT 1 FROM public.ad_routing_steps WHERE rule_id=rid AND NOT public.routing_eligible(user_id,rr.company_id)) THEN RAISE EXCEPTION 'A user is blocked, inactive or unauthorized for this company'; END IF;
  IF EXISTS(SELECT 1 FROM public.ad_routing_steps s WHERE s.rule_id=rid AND s.quota IS NULL AND EXISTS(SELECT 1 FROM public.ad_routing_steps n WHERE n.rule_id=rid AND n.position>s.position)) THEN RAISE EXCEPTION 'Unlimited must be the last step'; END IF;
  IF EXISTS(SELECT 1 FROM public.ad_routing_rules r WHERE r.id<>rid AND r.status='active' AND r.company_id=rr.company_id AND r.account_id=rr.account_id AND (CASE WHEN r.creative_id<>'' THEN 4 WHEN r.ad_id<>'' THEN 3 WHEN r.campaign_id<>'' THEN 2 ELSE 1 END)=(CASE WHEN rr.creative_id<>'' THEN 4 WHEN rr.ad_id<>'' THEN 3 WHEN rr.campaign_id<>'' THEN 2 ELSE 1 END) AND (r.campaign_id='' OR rr.campaign_id='' OR r.campaign_id=rr.campaign_id) AND (r.ad_id='' OR rr.ad_id='' OR r.ad_id=rr.ad_id) AND (r.creative_id='' OR rr.creative_id='' OR r.creative_id=rr.creative_id) AND (r.page_id='' OR rr.page_id='' OR r.page_id=rr.page_id) AND (r.adset_id='' OR rr.adset_id='' OR r.adset_id=rr.adset_id)) THEN RAISE EXCEPTION 'Ambiguous active source mapping'; END IF;
 END IF;
 INSERT INTO public.ad_routing_audit(rule_id,action,before_data,after_data,actor_id) VALUES(rid,_action,jsonb_build_object('rule',to_jsonb(oldrow),'steps',before_steps),jsonb_build_object('rule',to_jsonb(rr),'steps',(SELECT jsonb_agg(to_jsonb(s)) FROM public.ad_routing_steps s WHERE rule_id=rid)),auth.uid());
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.routing_rule_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.routing_rule_action(text,jsonb) TO authenticated;
CREATE FUNCTION public.route_lead(_lead uuid,_manual_user uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; r public.ad_routing_rules; s public.ad_routing_steps; target uuid; why text; typ text;
BEGIN
 IF NOT public.routing_admin() AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Routing authorization required'; END IF;
 PERFORM pg_advisory_xact_lock(84219631);
 SELECT * INTO l FROM public.leads WHERE id=_lead FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead unavailable'; END IF;
 IF l.assigned_to IS NOT NULL THEN RETURN jsonb_build_object('status','already_assigned','user_id',l.assigned_to); END IF;
 IF EXISTS(SELECT 1 FROM public.lead_assignment_events WHERE lead_id=l.id) THEN RETURN jsonb_build_object('status','previously_assigned'); END IF;
 IF l.company_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=l.company_id AND is_active) THEN why:='Missing or inactive company';
 ELSIF _manual_user IS NOT NULL THEN
  IF NOT public.routing_admin() THEN RAISE EXCEPTION 'Manual assignment requires Super Admin'; END IF;
  IF NOT public.routing_eligible(_manual_user,l.company_id) THEN RAISE EXCEPTION 'User is blocked, inactive or unauthorized for this company'; END IF;
  target:=_manual_user; typ:='manual';
 ELSE
  SELECT * INTO r FROM public.ad_routing_rules WHERE status='active' AND company_id=l.company_id AND account_id=l.meta_account_id AND (page_id='' OR page_id=l.meta_page_id) AND (campaign_id='' OR campaign_id=l.meta_campaign_id) AND (adset_id='' OR adset_id=l.meta_adset_id) AND (ad_id='' OR ad_id=l.meta_ad_id) AND (creative_id='' OR creative_id=l.meta_creative_id) ORDER BY CASE WHEN creative_id<>'' THEN 4 WHEN ad_id<>'' THEN 3 WHEN campaign_id<>'' THEN 2 ELSE 1 END DESC,created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN why:='No matching active rule'; ELSE
   SELECT * INTO s FROM public.ad_routing_steps WHERE rule_id=r.id AND (quota IS NULL OR assigned_count<quota) AND public.routing_eligible(user_id,l.company_id) ORDER BY position LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN why:='Quotas exhausted or no eligible active users'; ELSE target:=s.user_id;typ:='automatic'; END IF;
  END IF;
 END IF;
 IF target IS NULL THEN INSERT INTO public.lead_routing_queue(lead_id,reason) VALUES(l.id,why) ON CONFLICT(lead_id) DO UPDATE SET reason=excluded.reason,updated_at=now(); RETURN jsonb_build_object('status','unassigned','reason',why); END IF;
 UPDATE public.leads SET assigned_to=target WHERE id=l.id;
 IF typ='automatic' THEN UPDATE public.ad_routing_steps SET assigned_count=assigned_count+1 WHERE id=s.id; UPDATE public.ad_routing_rules SET total_leads=total_leads+1 WHERE id=r.id; END IF;
 INSERT INTO public.lead_assignment_events(lead_id,company_id,rule_id,user_id,assignment_type,snapshot,actor_id) VALUES(l.id,l.company_id,r.id,target,typ,jsonb_build_object('lead',to_jsonb(l),'rule_name',r.name,'user_name',(SELECT coalesce(nullif(full_name,''),email) FROM public.profiles WHERE id=target),'company_name',(SELECT name FROM public.companies WHERE id=l.company_id)),auth.uid());
 DELETE FROM public.lead_routing_queue WHERE lead_id=l.id;
 RETURN jsonb_build_object('status','assigned','user_id',target);
END $$;
REVOKE ALL ON FUNCTION public.route_lead(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.route_lead(uuid,uuid) TO authenticated,service_role;
CREATE FUNCTION public.routing_incoming_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.assigned_to IS NULL AND NEW.meta_account_id IS NOT NULL AND (public.routing_admin() OR coalesce(auth.role(),'')='service_role') THEN PERFORM public.route_lead(NEW.id); END IF; RETURN NEW; END $$;
CREATE TRIGGER routing_new_meta_lead AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.routing_incoming_lead();
CREATE INDEX routing_source_lookup ON public.ad_routing_rules(company_id,account_id) WHERE status='active';
CREATE INDEX routing_history_date ON public.lead_assignment_events(created_at DESC);