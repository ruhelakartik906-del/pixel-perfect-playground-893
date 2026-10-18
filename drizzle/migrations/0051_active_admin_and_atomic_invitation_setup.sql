-- Tighten existing role-only policies without changing WhatsApp policies.
DO $migration$
DECLARE p record; q text; c text;
BEGIN
FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename NOT LIKE 'wa\_%' ESCAPE '\' AND tablename NOT LIKE 'whatsapp%' AND (qual LIKE '%has_role(auth.uid(), ''super_admin''::app_role)%' OR with_check LIKE '%has_role(auth.uid(), ''super_admin''::app_role)%') LOOP
q:=replace(p.qual,'has_role(auth.uid(), ''super_admin''::app_role)','routing_admin()');
c:=replace(p.with_check,'has_role(auth.uid(), ''super_admin''::app_role)','routing_admin()');
EXECUTE format('ALTER POLICY %I ON public.%I%s%s',p.policyname,p.tablename,CASE WHEN q IS NULL THEN '' ELSE ' USING ('||q||')' END,CASE WHEN c IS NULL THEN '' ELSE ' WITH CHECK ('||c||')' END);
END LOOP;
END $migration$;
CREATE OR REPLACE FUNCTION public.guard_user_profile_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF auth.role()='authenticated' AND NOT public.routing_admin() AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email OR NEW.account_status IS DISTINCT FROM OLD.account_status) THEN RAISE EXCEPTION 'Account identity and status cannot be self-edited'; END IF;
RETURN NEW;
END $$;
-- Permissive legacy assignee policies must not reopen blocked/company-wide access.
CREATE POLICY lead_account_assignment_boundary ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING (public.routing_admin() OR (assigned_to=auth.uid() AND public.user_crm_company(company_id))) WITH CHECK (public.routing_admin() OR (assigned_to=auth.uid() AND public.user_crm_company(company_id)));
CREATE POLICY lead_insert_admin_boundary ON public.leads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.routing_admin());
CREATE POLICY lead_delete_admin_boundary ON public.leads AS RESTRICTIVE FOR DELETE TO authenticated USING (public.routing_admin());
CREATE POLICY deal_account_assignment_boundary ON public.deals AS RESTRICTIVE FOR ALL TO authenticated USING (public.routing_admin() OR (assigned_to=auth.uid() AND ((company_id IS NULL AND created_by=auth.uid() AND public.user_workspace_allowed()) OR public.user_crm_company(company_id)))) WITH CHECK (public.routing_admin() OR (assigned_to=auth.uid() AND ((company_id IS NULL AND created_by=auth.uid() AND public.user_workspace_allowed()) OR public.user_crm_company(company_id))));
CREATE POLICY company_active_account_boundary ON public.companies AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active')) WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active'));
CREATE POLICY membership_active_account_boundary ON public.company_members AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active')) WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active'));
-- Auth email delivery is external; database setup itself is atomic and activates last.
CREATE FUNCTION public.admin_complete_invitation(_actor uuid,_user uuid,_email text,_name text,_phone text,_role public.app_role,_access_role uuid DEFAULT NULL,_company uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.profiles;
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_actor AND account_status='active' FOR SHARE) OR NOT public.has_role(_actor,'super_admin') THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
IF _actor=_user THEN RAISE EXCEPTION 'Invitation cannot replace your account'; END IF;
IF _company IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND is_active FOR SHARE) THEN RAISE EXCEPTION 'Select an active company'; END IF;
IF _access_role IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.access_roles WHERE id=_access_role FOR SHARE) THEN RAISE EXCEPTION 'Select an existing permission role'; END IF;
SELECT * INTO target FROM public.profiles WHERE id=_user FOR UPDATE;
IF target.id IS NULL OR target.account_status<>'pending' OR lower(target.email)<>lower(_email) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role<>'client') OR EXISTS(SELECT 1 FROM public.company_members WHERE user_id=_user) THEN RAISE EXCEPTION 'Only a new pending invitation can be configured'; END IF;
IF length(trim(_name))=0 OR length(_name)>120 OR length(_phone)>30 THEN RAISE EXCEPTION 'Invalid invitation profile'; END IF;
UPDATE public.profiles SET full_name=trim(_name),phone=_phone,updated_at=now() WHERE id=_user;
DELETE FROM public.user_roles WHERE user_id=_user;
INSERT INTO public.user_roles(user_id,role) VALUES(_user,_role);
IF _access_role IS NOT NULL THEN INSERT INTO public.user_access_roles(user_id,role_id) VALUES(_user,_access_role); END IF;
IF _company IS NOT NULL THEN INSERT INTO public.company_members(user_id,company_id) VALUES(_user,_company); END IF;
UPDATE public.profiles SET account_status='active',updated_at=now() WHERE id=_user;
RETURN _user;
END $$;
REVOKE ALL ON FUNCTION public.admin_complete_invitation(uuid,uuid,text,text,text,public.app_role,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_invitation(uuid,uuid,text,text,text,public.app_role,uuid,uuid) TO service_role;