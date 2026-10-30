DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['whatsapp_templates','whatsapp_conversations','whatsapp_messages','wa_workflows','wa_broadcasts','wa_suppression','wa_broadcast_recipients'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS active_admin_gate ON public.%I', t);
  EXECUTE format('CREATE POLICY active_admin_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.has_role(auth.uid(), ''super_admin''::app_role) OR public.routing_admin()) WITH CHECK (NOT public.has_role(auth.uid(), ''super_admin''::app_role) OR public.routing_admin())', t);
END LOOP; END $$;