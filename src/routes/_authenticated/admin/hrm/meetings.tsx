import {createFileRoute} from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/meetings')({head:()=>adminHead('Meetings — HRM','Manage employee meetings in Routiva CRM.'),component:()=> <HrmPage module="meeting"/>});
