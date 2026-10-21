import {createFileRoute} from '@tanstack/react-router';
import {LeadsPage} from './leads';
import {adminHead} from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/crm/pipeline')({head:()=>adminHead('Pipeline','Manage canonical lead stages and outcomes in Routiva CRM.'),component:LeadsPage});
