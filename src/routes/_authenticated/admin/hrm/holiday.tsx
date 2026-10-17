import { createFileRoute } from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/holiday')({head:()=>adminHead('Holiday — HRM','Manage holiday records securely in Routiva CRM.'),component:()=> <HrmPage module="holiday"/>});
