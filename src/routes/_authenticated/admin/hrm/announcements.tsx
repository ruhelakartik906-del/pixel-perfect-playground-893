import {createFileRoute} from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/announcements')({head:()=>adminHead('Announcements — HRM','Manage company announcements and targeted publication in Routiva CRM.'),component:()=> <HrmPage module="announcement"/>});
