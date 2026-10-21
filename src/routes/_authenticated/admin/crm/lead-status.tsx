import {createFileRoute} from '@tanstack/react-router';
import {LeadStatus,leadStatusQuery} from '@/components/pipeline/LeadStatus';
import {adminHead} from '@/lib/admin-head';
export const Route=createFileRoute('/_authenticated/admin/crm/lead-status')({head:()=>adminHead('Lead Status','Manage protected shared lead stages, colors and order in Routiva CRM.'),loader:({context})=>context.queryClient.ensureQueryData(leadStatusQuery),component:Page});
function Page(){return <LeadStatus admin/>;}