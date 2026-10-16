import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Routiva CRM" },
      { name: "description", content: "Sign in to your Routiva CRM workspace." },
      { property: "og:title", content: "Login — Routiva CRM" },
      { property: "og:description", content: "Sign in to your Routiva CRM workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthCard title="Welcome back" desc="Login to manage your Meta leads, follow-ups and workspace activity." footer={<>New to Routiva? <AuthLink to="/register">Create an account</AuthLink></>}><LoginForm /></AuthCard>,
});
