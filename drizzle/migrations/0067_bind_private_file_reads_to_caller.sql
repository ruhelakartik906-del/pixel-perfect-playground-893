DROP POLICY IF EXISTS "Authorized team attachment downloads" ON storage.objects;
CREATE POLICY "Authorized team attachment downloads" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'team-chat-private' AND EXISTS (
  SELECT 1 FROM public.chat_attachments a JOIN public.chat_messages m ON m.id = a.message_id
  WHERE a.path = objects.name AND (
    m.sender_id = (select auth.uid()) OR m.recipient_id = (select auth.uid())
    OR (m.group_id IS NOT NULL AND public.chat_group_access(m.group_id)))));
DROP POLICY IF EXISTS support_private_file_read ON storage.objects;
CREATE POLICY support_private_file_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-private-files' AND EXISTS (
  SELECT 1 FROM public.support_attachments a
  WHERE a.path = objects.name AND (a.uploaded_by = (select auth.uid()) OR public.support_access(a.ticket_id))));
DROP POLICY IF EXISTS hr_private_no_browser_access ON storage.objects;