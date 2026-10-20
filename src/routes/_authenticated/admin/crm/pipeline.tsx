import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PipelineBoard, type PipelineSource } from "@/components/pipeline/PipelineBoard";
import { adminHead } from "@/lib/admin-head";
import { db, loadLookups, nameOf } from "@/lib/crm-data";

/** Read-only lead lookup for the pipeline prototype; nothing here writes to the database. */
const pipelineQuery = queryOptions({
  queryKey: ["admin-pipeline-preview"],
  queryFn: async (): Promise<PipelineSource[]> => {
    const [leads, lk] = await Promise.all([db.from("leads").select("id,customer_name,business_name,phone,email,source_id,assigned_to,company_id,created_at,interest_level").order("created_at", { ascending: false }).limit(2000), loadLookups()]);
    if (leads.error) throw leads.error;
    return (leads.data as any[]).map((l) => ({
      id: l.id, name: l.customer_name || l.business_name || "Unnamed", phone: l.phone, email: l.email,
      source: nameOf(lk.sources, l.source_id), assignee: nameOf(lk.people, l.assigned_to, "Unassigned"), assigneeId: l.assigned_to,
      company: nameOf(lk.companies, l.company_id), companyId: l.company_id, created: l.created_at, priority: l.interest_level || "—",
    }));
  },
});

export const Route = createFileRoute("/_authenticated/admin/crm/pipeline")({
  head: () => adminHead("Pipeline", "Track clients across six pipeline stages and manage stage actions in Routiva CRM."),
  loader: ({ context }) => context.queryClient.ensureQueryData(pipelineQuery),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(pipelineQuery);
  return <PipelineBoard records={data} admin />;
}
