import { createFileRoute } from "@tanstack/react-router";
import { UserWork } from "@/components/workspace/UserWork";
import { phase2Query } from "@/lib/user-phase2-query";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/tasks")({
 head:()=>adminHead("Tasks","Manage authorized tasks, assignments and scheduled work in Routiva CRM."),
 loader:({context})=>context.queryClient.ensureQueryData(phase2Query),
 component:Page,
});
function Page() {return <UserWork kind="task"/>;}
