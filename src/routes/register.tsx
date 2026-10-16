import { createFileRoute } from "@tanstack/react-router";
import { AuthComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Get Started — Routiva CRM" },
      { name: "description", content: "Create your Routiva CRM account." },
      { property: "og:title", content: "Get Started — Routiva CRM" },
      { property: "og:description", content: "Create your Routiva CRM account." },
    ],
  }),
  component: () => <AuthComingSoon title="Create your account" desc="New accounts are reviewed and approved by an admin before access is granted." />,
});
