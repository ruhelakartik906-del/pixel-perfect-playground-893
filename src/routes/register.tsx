import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Get Started — Routiva CRM" },
      { name: "description", content: "Create your Routiva CRM account for review and approval." },
      { property: "og:title", content: "Get Started — Routiva CRM" },
      { property: "og:description", content: "Create your Routiva CRM account for review and approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthCard compact title="Create your account" desc="Create your personal account. CRM access stays pending until an authorized admin approves it." footer={<>Already have an account? <AuthLink to="/login">Login</AuthLink></>}><RegisterForm /></AuthCard>,
});
