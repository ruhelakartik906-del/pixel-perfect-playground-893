import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetail, customerDetailQuery, plansQuery } from "@/components/admin/CustomerDetail";

export const Route = createFileRoute("/_authenticated/admin/all-users/$companyId")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerDetailQuery(params.companyId)),
      context.queryClient.ensureQueryData(plansQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Customer Details — Routiva CRM Admin" },
      { name: "description", content: "Manage a customer's subscription, plan, permissions and limits." },
      { property: "og:title", content: "Customer Details — Routiva CRM Admin" },
      { property: "og:description", content: "Manage a customer's subscription, plan, permissions and limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: function CustomerDetailRoute() {
    const { companyId } = Route.useParams();
    return <CustomerDetail companyId={companyId} />;
  },
});
