import {createFileRoute} from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/leave-management')({head:()=>adminHead('Leave Management — HRM','Manage leave requests and approval history in Routiva CRM.'),component:()=> <HrmPage module="leave"/>});
