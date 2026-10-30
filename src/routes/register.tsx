import { createFileRoute, redirect } from "@tanstack/react-router";

// Public customer signup is closed: Master Admin creates customer accounts.
// Keep the URL working for existing marketing links by redirecting to login.
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ to: "/login", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Login — Routiva CRM" },
      { name: "description", content: "Sign in to your Routiva CRM workspace." },
      { property: "og:title", content: "Login — Routiva CRM" },
      { property: "og:description", content: "Sign in to your Routiva CRM workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
