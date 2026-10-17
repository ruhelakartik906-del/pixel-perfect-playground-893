import { createFileRoute } from "@tanstack/react-router";
import { SalesFinance } from "@/components/admin/SalesFinance";
import { salesHead, salesQuery } from "@/lib/sales-data";
export const Route = createFileRoute("/_authenticated/admin/sales/credit-notes")({ head: () => salesHead("Credit Notes", "Authorized credit adjustments and audit history in Routiva CRM."), loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery), component: () => <SalesFinance module="credit-notes" /> });