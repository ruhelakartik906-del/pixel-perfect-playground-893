import { createFileRoute } from "@tanstack/react-router";
import { CrmWorkPage, crmWorkQuery } from "@/components/admin/work/CrmWorkPage";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/crm/follow-ups")({
 head:()=>adminHead("Follow-ups","Manage authorized follow-ups, assignments and scheduled work in Routiva CRM."),
 loader:({context})=>context.queryClient.ensureQueryData(crmWorkQuery),
 component:Page,
});
function Page() {return <CrmWorkPage kind="follow_up"/>;}
