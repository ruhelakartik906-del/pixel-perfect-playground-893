import { createFileRoute } from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/branch')({head:()=>adminHead('Branch — HRM','Manage branch records securely in Routiva CRM.'),component:()=> <HrmPage module="branch"/>});
