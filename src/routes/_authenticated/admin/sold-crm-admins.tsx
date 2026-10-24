import { createFileRoute } from '@tanstack/react-router';
import { SoldCrmAdmins } from '@/components/admin/SoldCrmAdmins';
import { installationsQuery } from '@/lib/crm-installations-query';
import { adminHead } from '@/lib/admin-head';
import { RoutePending } from '@/components/auth/RouteStates';
export const Route = createFileRoute('/_authenticated/admin/sold-crm-admins')({
  head:()=>adminHead('Sold CRM Admins','Manage independent Routiva CRM installations, license validity and setup status.'),
  loader:({context})=>context.queryClient.ensureQueryData(installationsQuery),
  pendingComponent:RoutePending,
  component:SoldCrmAdmins,
});