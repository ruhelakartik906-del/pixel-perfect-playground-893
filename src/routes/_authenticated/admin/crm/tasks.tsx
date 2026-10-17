import { createFileRoute } from "@tanstack/react-router";
import { CrmWorkPage, crmWorkQuery } from "@/components/admin/work/CrmWorkPage";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/crm/tasks")({
 head:()=>adminHead("Tasks","Manage authorized tasks, assignments and scheduled work in Routiva CRM."),
 loader:({context})=>context.queryClient.ensureQueryData(crmWorkQuery),
 component:Page,
});
function Page() {return <CrmWorkPage kind="task"/>;}
