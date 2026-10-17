import { createFileRoute } from "@tanstack/react-router";
import { SalesCustomers } from "@/components/admin/SalesCustomers";
import { salesHead, salesQuery } from "@/lib/sales-data";
export const Route = createFileRoute("/_authenticated/admin/sales/customers")({
  head: () => salesHead("Customers", "Manage Routiva CRM sales customers and linked leads and deals."),
  loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery),
  component: SalesCustomers,
});