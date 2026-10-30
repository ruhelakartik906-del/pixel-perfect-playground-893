import { createFileRoute } from "@tanstack/react-router";
import { CreateCustomer } from "@/components/admin/CreateCustomer";

export const Route = createFileRoute("/_authenticated/admin/create-customer")({
  head: () => ({
    meta: [
      { title: "Create Customer — Routiva CRM Admin" },
      { name: "description", content: "Create a customer organization and its admin account." },
      { property: "og:title", content: "Create Customer — Routiva CRM Admin" },
      { property: "og:description", content: "Create a customer organization and its admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateCustomer,
});
