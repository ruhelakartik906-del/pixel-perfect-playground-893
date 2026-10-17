import { createFileRoute } from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/announcement')({head:()=>adminHead('Announcement — HRM','Manage announcement records securely in Routiva CRM.'),component:()=> <HrmPage module="announcement"/>});
