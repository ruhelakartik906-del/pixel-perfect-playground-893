import { createFileRoute } from '@tanstack/react-router';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { adminHead } from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/hrm/document')({head:()=>adminHead('Document — HRM','Manage document records securely in Routiva CRM.'),component:()=> <HrmPage module="document"/>});
