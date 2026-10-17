import { createFileRoute } from "@tanstack/react-router";
import { SalesFinance } from "@/components/admin/SalesFinance";
import { salesHead, salesQuery } from "@/lib/sales-data";
export const Route = createFileRoute("/_authenticated/admin/sales/revenue")({ head: () => salesHead("Revenue", "Routiva CRM cash receipts and realized revenue without duplicate invoice payments."), loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery), component: () => <SalesFinance module="revenue" /> });