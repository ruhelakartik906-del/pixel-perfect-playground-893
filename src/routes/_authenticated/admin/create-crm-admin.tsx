import { createFileRoute } from '@tanstack/react-router';
import { CreateCrmAdmin } from '@/components/admin/CreateCrmAdmin';
import { adminHead } from '@/lib/admin-head';
export const Route = createFileRoute('/_authenticated/admin/create-crm-admin')({
  head:()=>adminHead('Create CRM Admin','Record a customer’s independent CRM installation and one- or two-year license.'),
  component:CreateCrmAdmin,
});