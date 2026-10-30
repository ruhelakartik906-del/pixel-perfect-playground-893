import { createFileRoute } from "@tanstack/react-router";
import { Plans } from "@/components/admin/Plans";
import { plansQuery } from "@/components/admin/CustomerDetail";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQuery),
  head: () => ({
    meta: [
      { title: "Plans — Routiva CRM Admin" },
      { name: "description", content: "Reusable feature and limit templates for customers." },
      { property: "og:title", content: "Plans — Routiva CRM Admin" },
      { property: "og:description", content: "Reusable feature and limit templates for customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Plans,
});
