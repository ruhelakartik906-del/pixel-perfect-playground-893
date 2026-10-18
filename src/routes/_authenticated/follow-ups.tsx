import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from "@tanstack/react-router";
import { UserWork } from "@/components/workspace/UserWork";
import { phase2Query } from "@/lib/user-phase2-query";
import { userHead } from "@/lib/user-crm";
export const Route = createFileRoute("/_authenticated/follow-ups")({
 errorComponent: WorkspaceAccessError,
 head:()=>userHead("Follow-ups","Manage authorized follow-ups, assignments and scheduled work in Routiva CRM."),
 loader:({context})=>context.queryClient.ensureQueryData(phase2Query),
 component:Page,
});
function Page() {return <UserWork kind="follow_up"/>;}
