import { createFileRoute } from '@tanstack/react-router';
import { CommercialPage } from '@/components/workspace/phase4/CommercialPage';
import { commercialQuery,myAccountQuery } from '@/lib/user-phase4-query';
import { userCrmQuery } from '@/lib/user-crm-query';
import { phase2Query } from '@/lib/user-phase2-query';
export const Route=createFileRoute('/_authenticated/proposals')({head:()=>({meta:[{title:'Proposals | Routiva CRM'},{name:'description',content:'Manage authorized proposal drafts and recorded customer decisions.'},{property:'og:title',content:'Proposals | Routiva CRM'},{property:'og:description',content:'Manage authorized proposal drafts and recorded customer decisions.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),loader:({context})=>Promise.all([context.queryClient.ensureQueryData(commercialQuery)]),component:Page});
function Page(){return <CommercialPage kind="proposal"/>;}
