import {createFileRoute} from '@tanstack/react-router';
import {UserLeadStatus} from '@/components/pipeline/LeadStatus';
import {UserWorkspace} from '@/components/workspace/UserWorkspace';
import {FeatureGate} from '@/components/workspace/FeatureGate';
import {WorkspaceAccessError} from '@/components/workspace/WorkspaceAccessError';
import {checkUserAccess,userCrmQuery} from '@/lib/user-crm-query';
import {userHead} from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/lead-status')({head:()=>userHead('Lead Status','View and manage your authorized company lead stages in Routiva CRM.'),errorComponent:WorkspaceAccessError,loader:async({context})=>{checkUserAccess(await context.queryClient.ensureQueryData(userCrmQuery));},component:Page});
function Page(){return <UserWorkspace><FeatureGate feature="leads"><UserLeadStatus/></FeatureGate></UserWorkspace>;}
