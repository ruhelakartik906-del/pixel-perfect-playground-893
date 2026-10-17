import { createFileRoute } from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/leave')({head:()=>adminHead('Leave — HRM','Manage leave records securely in Routiva CRM.'),component:()=> <HrmPage module="leave"/>});
