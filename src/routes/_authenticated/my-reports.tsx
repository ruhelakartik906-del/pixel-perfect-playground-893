import { createFileRoute } from '@tanstack/react-router';
import { MyReports } from '@/components/workspace/phase4/MyReports';
import { commercialQuery,myAccountQuery } from '@/lib/user-phase4-query';
import { userCrmQuery } from '@/lib/user-crm-query';
import { phase2Query } from '@/lib/user-phase2-query';
export const Route=createFileRoute('/_authenticated/my-reports')({head:()=>({meta:[{title:'My Reports | Routiva CRM'},{name:'description',content:'Review your assigned CRM records and work reports.'},{property:'og:title',content:'My Reports | Routiva CRM'},{property:'og:description',content:'Review your assigned CRM records and work reports.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),loader:({context})=>Promise.all([context.queryClient.ensureQueryData(userCrmQuery),context.queryClient.ensureQueryData(phase2Query)]),component:Page});
function Page(){return <MyReports/>;}
