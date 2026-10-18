CREATE OR REPLACE FUNCTION public.messaging_allowed(_permission text DEFAULT 'chat.view') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (
 public.has_role(auth.uid(),'super_admin') OR
 (_permission IN ('chat.view','chat.create') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('client','employee','manager'))) OR
 (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('employee','manager')) AND EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=auth.uid() AND _permission=ANY(r.permissions))))
$$;
CREATE OR REPLACE FUNCTION public.chat_support_staff(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user AND account_status='active') AND (public.has_role(_user,'super_admin') OR (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role IN ('employee','manager')) AND EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=_user AND 'chat.view'=ANY(r.permissions)) AND EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=_user AND 'chat.create'=ANY(r.permissions))))
$$;
CREATE OR REPLACE FUNCTION public.chat_company_actor(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user AND account_status='active') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role IN ('super_admin','employee','manager'))
$$;
CREATE OR REPLACE FUNCTION public.can_chat_with(_other uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.messaging_allowed('chat.view') AND _other<>auth.uid() AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE p.id=_other AND p.account_status='active' AND r.role IN ('client','employee','manager','super_admin')) AND (
 public.chat_support_staff(auth.uid()) OR public.chat_support_staff(_other) OR
 (public.chat_company_actor(auth.uid()) AND public.chat_company_actor(_other) AND EXISTS(SELECT 1 FROM public.company_members a JOIN public.company_members b ON a.company_id=b.company_id JOIN public.companies c ON c.id=a.company_id AND c.is_active WHERE a.user_id=auth.uid() AND b.user_id=_other)))
$$;
CREATE OR REPLACE FUNCTION public.chat_people() RETURNS TABLE(id uuid,full_name text,email text,avatar_url text,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.full_name,CASE WHEN public.chat_support_staff(auth.uid()) THEN p.email ELSE '' END,p.avatar_url,(SELECT r.role::text FROM public.user_roles r WHERE r.user_id=p.id ORDER BY CASE WHEN r.role='super_admin' THEN 0 ELSE 1 END LIMIT 1)
 FROM public.profiles p WHERE public.can_chat_with(p.id) AND (
 public.chat_support_staff(p.id) OR
 (public.chat_company_actor(auth.uid()) AND public.chat_company_actor(p.id) AND EXISTS(SELECT 1 FROM public.company_members a JOIN public.company_members b ON a.company_id=b.company_id JOIN public.companies c ON c.id=a.company_id AND c.is_active WHERE a.user_id=auth.uid() AND b.user_id=p.id)) OR
 EXISTS(SELECT 1 FROM public.chat_messages m WHERE m.group_id IS NULL AND ((m.sender_id=auth.uid() AND m.recipient_id=p.id) OR (m.recipient_id=auth.uid() AND m.sender_id=p.id)))) ORDER BY p.full_name
$$;
CREATE OR REPLACE FUNCTION public.chat_group_access(_group uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.messaging_allowed('chat.view') AND public.chat_company_actor(auth.uid()) AND EXISTS(SELECT 1 FROM public.chat_group_members m JOIN public.chat_groups g ON g.id=m.group_id JOIN public.companies c ON c.id=g.company_id AND c.is_active WHERE m.group_id=_group AND m.user_id=auth.uid() AND (public.has_role(auth.uid(),'super_admin') OR public.is_company_member(auth.uid(),g.company_id)))
$$;
REVOKE ALL ON FUNCTION public.chat_support_staff(uuid),public.chat_company_actor(uuid),public.can_chat_with(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.chat_support_staff(uuid),public.chat_company_actor(uuid),public.can_chat_with(uuid) TO authenticated;
COMMENT ON FUNCTION public.chat_support_staff(uuid) IS 'Active Super Admin or active employee/manager explicitly granted chat.view and chat.create. Personal clients can contact these staff, never arbitrary clients.';
COMMENT ON FUNCTION public.chat_people() IS 'Participant-scoped contact picker: support staff, authorized company teammates and existing direct participants; not a global user directory.';
