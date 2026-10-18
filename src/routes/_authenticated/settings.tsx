import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from '@tanstack/react-router';
import { MySettings } from '@/components/workspace/phase4/MySettings';
import { commercialQuery,myAccountQuery } from '@/lib/user-phase4-query';
import { userCrmQuery } from '@/lib/user-crm-query';
import { phase2Query } from '@/lib/user-phase2-query';
export const Route=createFileRoute('/_authenticated/settings')({
 errorComponent: WorkspaceAccessError,head:()=>({meta:[{title:'Settings & Profile | Routiva CRM'},{name:'description',content:'Manage your own profile, account security and preferences.'},{property:'og:title',content:'Settings & Profile | Routiva CRM'},{property:'og:description',content:'Manage your own profile, account security and preferences.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),loader:({context})=>Promise.all([context.queryClient.ensureQueryData(myAccountQuery)]),component:Page});
function Page(){return <MySettings/>;}
