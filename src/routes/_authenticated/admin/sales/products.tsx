import { createFileRoute } from "@tanstack/react-router";
import { SalesProducts } from "@/components/admin/SalesProducts";
import { salesHead, salesQuery } from "@/lib/sales-data";
export const Route = createFileRoute("/_authenticated/admin/sales/products")({
  head: () => salesHead("Products & Services", "Manage the Routiva CRM product and service catalog."),
  loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery),
  component: SalesProducts,
});