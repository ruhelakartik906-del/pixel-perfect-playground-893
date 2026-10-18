import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { CommercialPage } from '@/components/workspace/phase4/CommercialPage';
import { commercialQuery,myAccountQuery } from '@/lib/user-phase4-query';
import { userCrmQuery } from '@/lib/user-crm-query';
import { phase2Query } from '@/lib/user-phase2-query';
export const Route=createFileRoute('/_authenticated/invoices')({
 errorComponent: WorkspaceAccessError,head:()=>({meta:[{title:'Invoices | Routiva CRM'},{name:'description',content:'View shared invoices and manage authorized invoice drafts.'},{property:'og:title',content:'Invoices | Routiva CRM'},{property:'og:description',content:'View shared invoices and manage authorized invoice drafts.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),loader:({context})=>Promise.all([context.queryClient.ensureQueryData(commercialQuery)]),component:Page});
function Page(){return <CommercialPage kind="invoice"/>;}
