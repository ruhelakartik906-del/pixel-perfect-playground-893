import {createFileRoute} from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/holidays')({head:()=>adminHead('Holidays — HRM','Manage company holidays in Routiva CRM.'),component:()=> <HrmPage module="holiday"/>});
