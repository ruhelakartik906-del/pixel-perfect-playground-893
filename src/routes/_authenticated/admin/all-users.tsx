import { createFileRoute } from "@tanstack/react-router";
import { AllUsers, customersQuery } from "@/components/admin/AllUsers";

export const Route = createFileRoute("/_authenticated/admin/all-users")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQuery),
  head: () => ({
    meta: [
      { title: "All Users — Routiva CRM Admin" },
      { name: "description", content: "Manage every customer organization, subscription and access." },
      { property: "og:title", content: "All Users — Routiva CRM Admin" },
      { property: "og:description", content: "Manage every customer organization, subscription and access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AllUsers,
});
