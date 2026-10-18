CREATE OR REPLACE FUNCTION public.messaging_allowed(_permission text DEFAULT 'chat.view') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked') AND (
 _permission IN ('chat.view','chat.create') OR
 (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') AND (public.has_role(auth.uid(),'super_admin') OR
 (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('employee','manager')) AND EXISTS(SELECT 1 FROM public.user_access_roles u JOIN public.access_roles r ON r.id=u.role_id WHERE u.user_id=auth.uid() AND _permission=ANY(r.permissions))))))
$$;
CREATE OR REPLACE FUNCTION public.can_chat_with(_other uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.messaging_allowed('chat.view') AND _other<>auth.uid() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=_other AND account_status<>'blocked')
$$;
CREATE OR REPLACE FUNCTION public.chat_people() RETURNS TABLE(id uuid,full_name text,email text,avatar_url text,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,coalesce(nullif(trim(p.full_name),''),'User'),''::text,p.avatar_url,coalesce((SELECT r.role::text FROM public.user_roles r WHERE r.user_id=p.id ORDER BY CASE WHEN r.role='super_admin' THEN 0 ELSE 1 END LIMIT 1),'client') FROM public.profiles p WHERE public.can_chat_with(p.id) ORDER BY p.full_name,p.id
$$;
CREATE OR REPLACE FUNCTION public.support_access(_ticket uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=_ticket AND (t.user_id=auth.uid() OR public.support_admin()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked'))
$$;