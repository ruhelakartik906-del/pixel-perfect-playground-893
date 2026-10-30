import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { createFileRoute } from "@tanstack/react-router";
import { UserWork } from "@/components/workspace/UserWork";
import { FeatureGate } from "@/components/workspace/FeatureGate";
import { phase2Query } from "@/lib/user-phase2-query";
import { userHead } from "@/lib/user-crm";
export const Route = createFileRoute("/_authenticated/tasks")({
 errorComponent: WorkspaceAccessError,
 head:()=>userHead("Tasks","Manage authorized tasks, assignments and scheduled work in Routiva CRM."),
 loader:({context})=>context.queryClient.ensureQueryData(phase2Query),
 component:Page,
});
function Page() {return <FeatureGate feature="tasks"><UserWork kind="task"/></FeatureGate>;}
