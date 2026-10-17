DROP POLICY "Owners manage own mail" ON public.mail_messages;
CREATE POLICY "Owners read own mail" ON public.mail_messages FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners create drafts" ON public.mail_messages FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND folder IN ('draft','scheduled'));
CREATE POLICY "Owners update own mail" ON public.mail_messages FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete own mail" ON public.mail_messages FOR DELETE TO authenticated USING (owner_id = auth.uid() AND folder = 'trash');
CREATE OR REPLACE FUNCTION public.guard_mail_folder()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.folder IN ('sent','inbox') AND OLD.folder IS DISTINCT FROM NEW.folder AND OLD.folder <> 'trash' THEN
    RAISE EXCEPTION 'Messages can only reach Sent or Inbox through the mail integration';
  END IF;
  IF OLD.folder = 'trash' AND NEW.folder IN ('sent','inbox') AND NEW.delivery_status = 'not_sent' AND NEW.folder = 'sent' THEN
    RAISE EXCEPTION 'Unsent messages cannot be restored to Sent';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mail_messages_folder_guard BEFORE UPDATE ON public.mail_messages FOR EACH ROW EXECUTE FUNCTION public.guard_mail_folder();
ALTER TABLE public.mail_messages ADD COLUMN previous_folder text;