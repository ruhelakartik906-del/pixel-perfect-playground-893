CREATE TABLE public.access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_roles TO authenticated;
GRANT ALL ON public.access_roles TO service_role;
ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage access roles" ON public.access_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.user_access_roles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.access_roles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_access_roles TO authenticated;
GRANT ALL ON public.user_access_roles TO service_role;
ALTER TABLE public.user_access_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage user access roles" ON public.user_access_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Users read own access role" ON public.user_access_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.mailbox_settings (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid(),
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_secure boolean NOT NULL DEFAULT true,
  imap_host text NOT NULL DEFAULT '',
  imap_port integer NOT NULL DEFAULT 993,
  username text NOT NULL DEFAULT '',
  has_password boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mailbox_settings TO authenticated;
GRANT ALL ON public.mailbox_settings TO service_role;
ALTER TABLE public.mailbox_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read mailbox settings" ON public.mailbox_settings FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.mailbox_secrets (
  owner_id uuid PRIMARY KEY,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mailbox_secrets TO service_role;
ALTER TABLE public.mailbox_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  folder text NOT NULL DEFAULT 'draft' CHECK (folder IN ('inbox','draft','sent','scheduled','trash')),
  from_email text NOT NULL DEFAULT '',
  to_emails text NOT NULL DEFAULT '',
  cc text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  starred boolean NOT NULL DEFAULT false,
  important boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT true,
  scheduled_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'not_sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own mail" ON public.mail_messages FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND folder <> 'sent' AND folder <> 'inbox');

CREATE OR REPLACE FUNCTION public.can_chat_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND _other <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_status = 'active')
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _other AND account_status = 'active')
    AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(_other,'super_admin')
      OR EXISTS (SELECT 1 FROM public.company_members a JOIN public.company_members b ON a.company_id = b.company_id WHERE a.user_id = auth.uid() AND b.user_id = _other))
$$;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_pair_idx ON public.chat_messages (sender_id, recipient_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read chat" ON public.chat_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "Send allowed chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.can_chat_with(recipient_id));
CREATE POLICY "Recipient marks read" ON public.chat_messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

CREATE TABLE public.chat_stars (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  peer_id uuid NOT NULL,
  PRIMARY KEY (user_id, peer_id)
);
GRANT SELECT, INSERT, DELETE ON public.chat_stars TO authenticated;
GRANT ALL ON public.chat_stars TO service_role;
ALTER TABLE public.chat_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own chat stars" ON public.chat_stars FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL UNIQUE,
  contact_name text NOT NULL DEFAULT '',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage wa conversations" ON public.whatsapp_conversations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body text NOT NULL DEFAULT '',
  wa_message_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read wa messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name ~ '^[a-z0-9_]{1,512}$'),
  category text NOT NULL CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  language text NOT NULL DEFAULT 'en',
  header text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1024),
  footer text NOT NULL DEFAULT '',
  buttons jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft',
  sync_status text NOT NULL DEFAULT 'not_synced',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage wa templates" ON public.whatsapp_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER access_roles_updated BEFORE UPDATE ON public.access_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mail_messages_updated BEFORE UPDATE ON public.mail_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER wa_templates_updated BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN OTHERS THEN NULL; END $$;