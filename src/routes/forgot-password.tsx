import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — Routiva CRM" },
      { name: "description", content: "Request a secure password reset link for Routiva CRM." },
      { property: "og:title", content: "Forgot Password — Routiva CRM" },
      { property: "og:description", content: "Request a secure password reset link for Routiva CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthCard title="Reset your password" desc="Enter your email and we’ll send a secure link to set a new password." footer={<AuthLink to="/login">Back to login</AuthLink>}><ForgotPasswordForm /></AuthCard>,
});
