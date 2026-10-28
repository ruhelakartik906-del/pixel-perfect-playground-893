-- Extend the existing restrictive license_gate policy (migration 0095) to every remaining
-- customer-data table reachable by authenticated/anon Data API roles, so an inactive,
-- suspended, expired or stale license also blocks crafted direct database requests.
-- Restrictive policies AND with the existing permissive policies: every company-isolation,
-- role, membership and record-access condition stays exactly as it is.
-- Reuses public.license_active() / public.license_state from 0095; no new tables or functions.
-- Excluded on purpose (documented):
--   license_state                 - service_role only; the gate's own state row.
--   user_roles / access_roles / user_access_roles - read during sign-in and role resolution;
--                                   they hold no customer CRM data.
--   crm_installations / crm_installation_audit - Master-side licensing registry, unused in
--                                   customer installations.
--   crm_license_verify_failures / make_api_keys / make_intake_logs / mailbox_secrets -
--                                   zero permissive policies (RLS already denies all API access);
--                                   the verify-failure log must stay writable by the license
--                                   verification path itself, including when the license is invalid.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_routing_audit','ad_routing_rules','ad_routing_steps',
    'attendance_roster_exclusions',
    'automation_executions','automation_workflows',
    'chat_attachments','chat_group_members','chat_groups','chat_messages','chat_stars',
    'company_lead_status','company_members','contacts','credit_notes',
    'crm_list_views','crm_options','crm_work_history','crm_work_items','custom_forms',
    'deal_activity_history','deals','financial_audit_logs',
    'hr_access_audit','hr_announcement_attachments','hr_announcement_reads','hr_announcements',
    'hr_attendance','hr_attendance_events','hr_audit_logs','hr_branches','hr_departments',
    'hr_designations','hr_document_versions','hr_documents','hr_employees','hr_holidays',
    'hr_leave_balances','hr_leave_requests','hr_meetings','hr_payroll','hr_schedules',
    'integration_settings','invoices',
    'lead_activities','lead_assignment_events','lead_routing_queue','leads',
    'mail_messages','mailbox_settings','make_lead_sources',
    'payments','personal_attendance','personal_crm_tasks','personal_lead_status','personal_task_history',
    'proposal_events','revenue_entries','sales_proposals','sales_settings',
    'support_attachments','support_messages','support_ticket_events','support_tickets',
    'user_work_grid_settings','user_work_rows','user_work_tables',
    'wa_broadcast_recipients','wa_broadcasts','wa_suppression','wa_workflows',
    'whatsapp_conversations','whatsapp_messages','whatsapp_templates'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY license_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.license_active()) WITH CHECK (public.license_active())',
      t
    );
  END LOOP;
END $$;