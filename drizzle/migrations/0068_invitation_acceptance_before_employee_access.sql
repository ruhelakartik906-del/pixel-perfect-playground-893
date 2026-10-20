CREATE OR REPLACE FUNCTION public.admin_complete_invitation(_actor uuid,_user uuid,_email text,_name text,_phone text,_role public.app_role,_access_role uuid DEFAULT NULL,_company uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.profiles;
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_actor AND account_status='active' FOR SHARE) OR NOT public.has_role(_actor,'super_admin') THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
IF _actor=_user THEN RAISE EXCEPTION 'Invitation cannot replace your account'; END IF;
IF _company IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND is_active FOR SHARE) THEN RAISE EXCEPTION 'Select an active company'; END IF;
IF _access_role IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.access_roles WHERE id=_access_role FOR SHARE) THEN RAISE EXCEPTION 'Select an existing permission role'; END IF;
SELECT * INTO target FROM public.profiles WHERE id=_user FOR UPDATE;
IF target.id IS NULL OR target.account_status<>'pending' OR lower(target.email)<>lower(_email) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role<>'client') OR EXISTS(SELECT 1 FROM public.company_members WHERE user_id=_user) THEN RAISE EXCEPTION 'Only a new pending invitation can be configured'; END IF;
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_user AND invited_at IS NOT NULL) THEN RAISE EXCEPTION 'An Auth invitation is required'; END IF;
IF length(trim(_name))=0 OR length(_name)>120 OR length(_phone)>30 THEN RAISE EXCEPTION 'Invalid invitation profile'; END IF;
UPDATE public.profiles SET full_name=trim(_name),phone=_phone,updated_at=now() WHERE id=_user;
DELETE FROM public.user_roles WHERE user_id=_user;
INSERT INTO public.user_roles(user_id,role) VALUES(_user,_role);
IF _access_role IS NOT NULL THEN INSERT INTO public.user_access_roles(user_id,role_id) VALUES(_user,_access_role); END IF;
IF _company IS NOT NULL THEN INSERT INTO public.company_members(user_id,company_id) VALUES(_user,_company); END IF;
-- Preserve pending: membership and role are inert until verified acceptance.
RETURN _user;
END $$;
REVOKE ALL ON FUNCTION public.admin_complete_invitation(uuid,uuid,text,text,text,public.app_role,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_invitation(uuid,uuid,text,text,text,public.app_role,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.accept_employee_invitation() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.profiles; caller uuid:=auth.uid();
BEGIN
IF caller IS NULL THEN RAISE EXCEPTION 'Authenticated invitation required'; END IF;
SELECT * INTO target FROM public.profiles WHERE id=caller FOR UPDATE;
IF target.id IS NULL OR target.account_status='blocked' THEN RAISE EXCEPTION 'Account access denied'; END IF;
IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=caller AND u.invited_at IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND coalesce(u.encrypted_password,'')<>'' AND lower(u.email)=lower(target.email)) THEN RAISE EXCEPTION 'Accept a valid invitation and set a password first'; END IF;
IF target.account_status='active' THEN RETURN caller; END IF;
IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=caller AND role<>'client') THEN RAISE EXCEPTION 'Employee invitation setup is incomplete'; END IF;
UPDATE public.profiles SET account_status='active',updated_at=now() WHERE id=caller;
RETURN caller;
END $$;
REVOKE ALL ON FUNCTION public.accept_employee_invitation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_employee_invitation() TO authenticated;
-- The guarded SECURITY DEFINER acceptance transition may update only its verified caller.
CREATE OR REPLACE FUNCTION public.guard_user_profile_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF auth.role()='authenticated' AND current_user IN ('authenticated','anon') AND NOT public.routing_admin() AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email OR NEW.account_status IS DISTINCT FROM OLD.account_status) THEN RAISE EXCEPTION 'Account identity and status cannot be self-edited'; END IF;
RETURN NEW;
END $$;