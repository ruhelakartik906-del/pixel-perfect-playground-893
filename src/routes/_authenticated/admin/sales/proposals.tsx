import { createFileRoute } from "@tanstack/react-router";
import { SalesProposals } from "@/components/admin/SalesProposals";
import { salesHead, salesQuery } from "@/lib/sales-data";
export const Route = createFileRoute("/_authenticated/admin/sales/proposals")({ head: () => salesHead("Proposals", "Routiva CRM proposals created by users, with creator details and history."), loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery), component: SalesProposals });
