import { createFileRoute } from "@tanstack/react-router";
import { SalesFinance } from "@/components/admin/SalesFinance";
import { salesHead, salesQuery } from "@/lib/sales-data";
export const Route = createFileRoute("/_authenticated/admin/sales/invoices")({ head: () => salesHead("Invoices", "Routiva CRM invoices, GST calculations, payment history and financial balances."), loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery), component: () => <SalesFinance module="invoices" /> });