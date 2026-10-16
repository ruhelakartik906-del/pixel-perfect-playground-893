REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, company_name, avatar_url, updated_at) ON public.profiles TO authenticated;

COMMENT ON TABLE public.user_roles IS 'Stores account roles separately from profiles to prevent user-editable privilege escalation.';