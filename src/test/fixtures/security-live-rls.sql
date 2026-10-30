-- Snapshot of LIVE production RLS policies/functions (schema only, no data). Regenerate from pg_policies/pg_proc.
SET check_function_bodies = off;
DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
CREATE TYPE public.account_status AS ENUM ('pending','active','blocked');
CREATE TYPE public.app_role AS ENUM ('super_admin','manager','employee','client');
CREATE TABLE public.access_roles (id uuid, name text, description text, permissions text[], created_at timestamp with time zone, updated_at timestamp with time zone);
CREATE TABLE public.companies (id uuid, name text, is_active boolean, created_at timestamp with time zone, phone text, email text, location text, industry text, contact_person text, website text, address text, city text, state text, country text, notes text);
CREATE TABLE public.company_members (id uuid, company_id uuid, user_id uuid, created_at timestamp with time zone);
CREATE TABLE public.hr_employees (id uuid, profile_id uuid, employee_code text, department_id uuid, designation_id uuid, branch_id uuid, joining_date date, access_status text, created_at timestamp with time zone, updated_at timestamp with time zone, phone text, employment_type text, reporting_manager_id uuid, is_active boolean, company_id uuid);
CREATE TABLE public.lead_assignment_events (id uuid, lead_id uuid, company_id uuid, rule_id uuid, user_id uuid, assignment_type text, status text, snapshot jsonb, actor_id uuid, created_at timestamp with time zone);
CREATE TABLE public.leads (id uuid, company_id uuid, pipeline_id uuid, stage_id uuid, source_id uuid, customer_name text, phone text, email text, business_name text, business_category text, requirements text, interest_level text, status text, form_answers jsonb, meta_account_id text, meta_page_id text, meta_campaign_id text, meta_campaign_name text, meta_adset_id text, meta_ad_id text, meta_ad_name text, meta_form_id text, meta_lead_id text, assigned_to uuid, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, region text, form_id uuid, meta_creative_id text, intake_source text, intake_source_id uuid, intake_external_id text, intake_rule_id uuid, automation_stage_revision bigint, private_owner_id uuid, board_moved_at timestamp with time zone);
CREATE TABLE public.license_state (id boolean, mode text, verified_until timestamp with time zone, updated_at timestamp with time zone);
CREATE TABLE public.profiles (id uuid, full_name text, email text, phone text, company_name text, account_status public.account_status, avatar_url text, created_at timestamp with time zone, updated_at timestamp with time zone, display_name text, preferences jsonb);
CREATE TABLE public.user_access_roles (user_id uuid, role_id uuid, created_at timestamp with time zone);
CREATE TABLE public.user_roles (id uuid, user_id uuid, role public.app_role, created_at timestamp with time zone);
CREATE TABLE public.whatsapp_templates (id uuid, name text, category text, language text, header text, body text, footer text, buttons jsonb, status text, sync_status text, created_at timestamp with time zone, updated_at timestamp with time zone, company_id uuid, created_by uuid, header_type text, samples jsonb);
CREATE OR REPLACE FUNCTION public.ad_routed_private_access(_lead uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT public.lead_workspace_active() AND EXISTS(SELECT 1 FROM public.leads l JOIN public.lead_assignment_events e ON e.lead_id=l.id WHERE l.id=_lead AND l.assigned_to=auth.uid() AND l.private_owner_id=auth.uid() AND e.user_id=auth.uid() AND e.assignment_type='automatic') $function$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;
CREATE OR REPLACE FUNCTION public.is_company_member(_user uuid, _company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _company IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user AND company_id = _company)
$function$;
CREATE OR REPLACE FUNCTION public.lead_record_allowed(_company uuid, _creator uuid, _assignee uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT public.lead_workspace_active() AND _assignee=auth.uid() AND ((_company IS NULL AND _creator=auth.uid()) OR (_company IS NOT NULL AND public.user_crm_company(_company))) $function$;
CREATE OR REPLACE FUNCTION public.lead_record_allowed(_company uuid, _creator uuid, _assignee uuid, _owner uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT public.lead_workspace_active() AND _assignee=auth.uid() AND ((_company IS NULL AND coalesce(_owner,_creator)=auth.uid()) OR (_company IS NOT NULL AND _owner IS NULL AND public.user_crm_company(_company)) OR (_company IS NOT NULL AND _owner=auth.uid() AND EXISTS(SELECT 1 FROM public.lead_assignment_events e JOIN public.leads l ON l.id=e.lead_id WHERE l.company_id=_company AND l.assigned_to=_assignee AND l.private_owner_id=_owner AND l.created_by IS NOT DISTINCT FROM _creator AND e.user_id=_owner AND e.assignment_type='automatic'))) $function$;
CREATE OR REPLACE FUNCTION public.lead_workspace_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') $function$;
CREATE OR REPLACE FUNCTION public.license_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.license_state
    WHERE id AND (mode = 'master' OR (verified_until IS NOT NULL AND verified_until > now()))
  );
$function$;
CREATE OR REPLACE FUNCTION public.messaging_allowed(_permission text DEFAULT 'chat.view'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked') AND (
 _permission IN ('chat.view','chat.create') OR
 (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (public.has_role(auth.uid(),'super_admin') OR
 (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('employee','manager')) AND EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=auth.uid() AND _permission=ANY(r.permissions))))))
$function$;
CREATE OR REPLACE FUNCTION public.org_customer_admin(_user uuid, _company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    join public.user_roles ur on ur.user_id = cm.user_id
    where cm.user_id = _user and cm.company_id = _company
      and p.account_status = 'active' and ur.role = 'client'
  )
$function$;
CREATE OR REPLACE FUNCTION public.routing_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'super_admin') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') $function$;
CREATE OR REPLACE FUNCTION public.routing_eligible(_user uuid, _company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.company_members m ON m.user_id=p.id JOIN public.companies c ON c.id=m.company_id WHERE p.id=_user AND c.id=_company AND p.account_status='active' AND c.is_active AND NOT public.has_role(p.id,'client') AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('employee','manager','super_admin')) AND NOT EXISTS(SELECT 1 FROM public.hr_employees e WHERE e.profile_id=p.id AND e.company_id=c.id AND (NOT e.is_active OR e.access_status<>'approved'))) $function$;
CREATE OR REPLACE FUNCTION public.template_scope(_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT public.messaging_allowed('template.view') AND (public.has_role(auth.uid(),'super_admin') OR (_company IS NOT NULL AND public.is_company_member(auth.uid(),_company))) $function$;
CREATE OR REPLACE FUNCTION public.user_crm_company(_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.company_members m ON m.user_id=p.id JOIN public.companies c ON c.id=m.company_id WHERE p.id=auth.uid() AND p.account_status='active' AND c.id=_company AND c.is_active AND (public.routing_eligible(p.id,c.id) OR public.has_role(p.id,'client'))) $function$;
CREATE OR REPLACE FUNCTION public.user_workspace_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked') $function$;
ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.access_roles TO authenticated;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.companies TO authenticated;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.company_members TO authenticated;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.hr_employees TO authenticated;
ALTER TABLE public.lead_assignment_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lead_assignment_events TO authenticated;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.leads TO authenticated;
ALTER TABLE public.license_state ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.license_state TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles TO authenticated;
ALTER TABLE public.user_access_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_access_roles TO authenticated;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_roles TO authenticated;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.whatsapp_templates TO authenticated;
CREATE POLICY "Admins manage access roles" ON public.access_roles AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Admins manage companies" ON public.companies AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Members read own companies" ON public.companies AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(auth.uid(), id));
CREATE POLICY "company_active_account_boundary" ON public.companies AS RESTRICTIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.account_status = 'active'::account_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.account_status = 'active'::account_status)))));
CREATE POLICY "license_gate" ON public.companies AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
CREATE POLICY "Admins manage members" ON public.company_members AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Users read own memberships" ON public.company_members AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "license_gate" ON public.company_members AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
CREATE POLICY "membership_active_account_boundary" ON public.company_members AS RESTRICTIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.account_status = 'active'::account_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.account_status = 'active'::account_status)))));
CREATE POLICY "Admins manage hr_employees" ON public.hr_employees AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Employees read own record" ON public.hr_employees AS PERMISSIVE FOR SELECT TO authenticated USING ((profile_id = auth.uid()));
CREATE POLICY "license_gate" ON public.hr_employees AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
CREATE POLICY "license_gate" ON public.lead_assignment_events AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
CREATE POLICY "routing_events_admin" ON public.lead_assignment_events AS PERMISSIVE FOR SELECT TO authenticated USING (routing_admin());
CREATE POLICY "Active CRM lead access" ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING ((routing_admin() OR lead_record_allowed(company_id, created_by, assigned_to, private_owner_id))) WITH CHECK ((routing_admin() OR lead_record_allowed(company_id, created_by, assigned_to, private_owner_id)));
CREATE POLICY "Admins manage leads" ON public.leads AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Assignees read leads" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING (((assigned_to = auth.uid()) AND is_company_member(auth.uid(), company_id)));
CREATE POLICY "Assignees update leads" ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated USING (((assigned_to = auth.uid()) AND is_company_member(auth.uid(), company_id))) WITH CHECK (((assigned_to = auth.uid()) AND is_company_member(auth.uid(), company_id)));
CREATE POLICY "ad_routed_private_exact_boundary" ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING (((private_owner_id IS NULL) OR (company_id IS NULL) OR routing_admin() OR ad_routed_private_access(id))) WITH CHECK (((private_owner_id IS NULL) OR (company_id IS NULL) OR routing_admin() OR ad_routed_private_access(id)));
CREATE POLICY "ad_routed_private_read" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING (ad_routed_private_access(id));
CREATE POLICY "lead_account_assignment_boundary" ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING ((routing_admin() OR lead_record_allowed(company_id, created_by, assigned_to, private_owner_id))) WITH CHECK ((routing_admin() OR lead_record_allowed(company_id, created_by, assigned_to, private_owner_id)));
CREATE POLICY "lead_delete_admin_boundary" ON public.leads AS RESTRICTIVE FOR DELETE TO authenticated USING (routing_admin());
CREATE POLICY "lead_insert_admin_boundary" ON public.leads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (routing_admin());
CREATE POLICY "license_gate" ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
CREATE POLICY "personal_lead_read" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING (((company_id IS NULL) AND lead_record_allowed(company_id, created_by, assigned_to, private_owner_id)));
CREATE POLICY "private_lead_boundary" ON public.leads AS RESTRICTIVE FOR ALL TO authenticated USING (((private_owner_id IS NULL) OR ((private_owner_id = auth.uid()) AND lead_workspace_active()) OR (routing_admin() AND (((intake_source = 'manual'::text) AND (created_by IS DISTINCT FROM private_owner_id)) OR (EXISTS ( SELECT 1
   FROM lead_assignment_events e
  WHERE ((e.lead_id = leads.id) AND (e.assignment_type = 'automatic'::text)))))))) WITH CHECK (((private_owner_id IS NULL) OR ((private_owner_id = auth.uid()) AND lead_workspace_active()) OR (routing_admin() AND (((intake_source = 'manual'::text) AND (created_by IS DISTINCT FROM private_owner_id)) OR (EXISTS ( SELECT 1
   FROM lead_assignment_events e
  WHERE ((e.lead_id = leads.id) AND (e.assignment_type = 'automatic'::text))))))));
CREATE POLICY "Admins can manage profiles" ON public.profiles AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Users can read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = id) OR routing_admin()));
CREATE POLICY "Users can update safe own profile fields" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "license_gate" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
CREATE POLICY "Admins manage user access roles" ON public.user_access_roles AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Users read own access role" ON public.user_access_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (routing_admin()) WITH CHECK (routing_admin());
CREATE POLICY "Users can read own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR routing_admin()));
CREATE POLICY "Admins manage wa templates" ON public.whatsapp_templates AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Authorized draft deletion read path" ON public.whatsapp_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((template_scope(company_id) AND messaging_allowed('template.delete'::text) AND (status = 'draft'::text) AND (sync_status = 'not_synced'::text)));
CREATE POLICY "Authorized local template create" ON public.whatsapp_templates AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((template_scope(company_id) AND messaging_allowed('template.create'::text) AND (created_by = auth.uid()) AND (status = 'draft'::text) AND (sync_status = 'not_synced'::text)));
CREATE POLICY "Authorized local template delete" ON public.whatsapp_templates AS PERMISSIVE FOR DELETE TO authenticated USING ((template_scope(company_id) AND messaging_allowed('template.delete'::text) AND (status = 'draft'::text) AND (sync_status = 'not_synced'::text)));
CREATE POLICY "Authorized local template edit" ON public.whatsapp_templates AS PERMISSIVE FOR UPDATE TO authenticated USING ((template_scope(company_id) AND messaging_allowed('template.edit'::text) AND (status = 'draft'::text) AND (sync_status = 'not_synced'::text))) WITH CHECK ((template_scope(company_id) AND (status = 'draft'::text) AND (sync_status = 'not_synced'::text)));
CREATE POLICY "Authorized templates read" ON public.whatsapp_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((template_scope(company_id) AND (((status = 'approved'::text) AND (sync_status = 'synced'::text)) OR messaging_allowed('template.create'::text) OR messaging_allowed('template.edit'::text))));
CREATE POLICY "Owners manage personal template drafts" ON public.whatsapp_templates AS PERMISSIVE FOR ALL TO authenticated USING (((company_id IS NULL) AND (created_by = auth.uid()) AND user_workspace_allowed())) WITH CHECK (((company_id IS NULL) AND (created_by = auth.uid()) AND (status = 'draft'::text) AND (sync_status = 'not_synced'::text) AND user_workspace_allowed()));
CREATE POLICY "active_admin_gate" ON public.whatsapp_templates AS RESTRICTIVE FOR ALL TO authenticated USING (((NOT has_role(auth.uid(), 'super_admin'::app_role)) OR routing_admin())) WITH CHECK (((NOT has_role(auth.uid(), 'super_admin'::app_role)) OR routing_admin()));
CREATE POLICY "license_gate" ON public.whatsapp_templates AS RESTRICTIVE FOR ALL TO authenticated USING (license_active()) WITH CHECK (license_active());
