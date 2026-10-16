import { createFileRoute } from "@tanstack/react-router";
import { AccountState } from "@/components/auth/AccountState";

export const Route = createFileRoute("/restricted")({
  head: () => ({
    meta: [
      { title: "Access Restricted — Routiva CRM" },
      { name: "description", content: "This Routiva CRM account cannot access the workspace." },
      { property: "og:title", content: "Access Restricted — Routiva CRM" },
      { property: "og:description", content: "This Routiva CRM account cannot access the workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AccountState kind="restricted" />,
});
