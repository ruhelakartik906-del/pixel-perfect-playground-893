import { createFileRoute } from "@tanstack/react-router";
import { AuthComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Routiva CRM" },
      { name: "description", content: "Sign in to your Routiva CRM workspace." },
      { property: "og:title", content: "Login — Routiva CRM" },
      { property: "og:description", content: "Sign in to your Routiva CRM workspace." },
    ],
  }),
  component: () => <AuthComingSoon title="Welcome back" desc="Sign in to see your assigned leads, follow-ups and attendance." />,
});
