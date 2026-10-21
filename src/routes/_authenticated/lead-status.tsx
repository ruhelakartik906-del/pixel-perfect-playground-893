import {createFileRoute} from '@tanstack/react-router';
import {UserLeadStatus,leadStatusQuery,leadStatusAccessQuery} from '@/components/pipeline/LeadStatus';
import {UserWorkspace} from '@/components/workspace/UserWorkspace';
import {WorkspaceAccessError} from '@/components/workspace/WorkspaceAccessError';
import {checkUserAccess,userCrmQuery} from '@/lib/user-crm-query';
import {userHead} from '@/lib/user-crm';
export const Route=createFileRoute('/_authenticated/lead-status')({head:()=>userHead('Lead Status','View and manage authorized shared lead stages in Routiva CRM.'),errorComponent:WorkspaceAccessError,loader:async({context})=>{checkUserAccess(await context.queryClient.ensureQueryData(userCrmQuery));await Promise.all([context.queryClient.ensureQueryData(leadStatusQuery),context.queryClient.ensureQueryData(leadStatusAccessQuery)]);},component:Page});
function Page(){return <UserWorkspace><UserLeadStatus/></UserWorkspace>;}
