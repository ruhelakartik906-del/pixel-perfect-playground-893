import { createFileRoute } from "@tanstack/react-router";
import { AccountState } from "@/components/auth/AccountState";

export const Route = createFileRoute("/pending-approval")({
  head: () => ({
    meta: [
      { title: "Approval Pending — Routiva CRM" },
      { name: "description", content: "Your Routiva CRM account is waiting for admin approval." },
      { property: "og:title", content: "Approval Pending — Routiva CRM" },
      { property: "og:description", content: "Your Routiva CRM account is waiting for admin approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AccountState kind="pending" />,
});
