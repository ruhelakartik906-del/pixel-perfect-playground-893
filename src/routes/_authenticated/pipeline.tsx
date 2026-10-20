import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { WorkspaceAccessError } from "@/components/workspace/WorkspaceAccessError";
import { UserWorkspace } from "@/components/workspace/UserWorkspace";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { checkUserAccess, userCrmQuery } from "@/lib/user-crm-query";
import { userHead } from "@/lib/user-crm";

export const Route = createFileRoute("/_authenticated/pipeline")({
  errorComponent: WorkspaceAccessError,
  head: () => userHead("Pipeline", "Move your assigned clients through six simple pipeline stages in Routiva CRM."),
  loader: async ({ context }) => { const data = await context.queryClient.ensureQueryData(userCrmQuery); checkUserAccess(data); },
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(userCrmQuery);
  const me = data.profile.full_name || data.profile.email;
  const records = data.leads.map((l) => ({
    id: l.id, name: l.customer_name || l.business_name || "Unnamed", phone: l.phone, email: l.email,
    source: data.sources.find((s) => s.id === l.source_id)?.name ?? "—", assignee: me, assigneeId: data.userId,
    company: data.companies.find((c) => c.id === l.company_id)?.name ?? "—", companyId: l.company_id, created: l.created_at, priority: l.interest_level || "—",
  }));
  return <UserWorkspace><PipelineBoard records={records} /></UserWorkspace>;
}
