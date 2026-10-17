import { createFileRoute } from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/payroll')({head:()=>adminHead('Payroll — HRM','Manage payroll records securely in Routiva CRM.'),component:()=> <HrmPage module="payroll"/>});
