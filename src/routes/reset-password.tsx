import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password — Routiva CRM" },
      { name: "description", content: "Set a new Routiva CRM password from your recovery link." },
      { property: "og:title", content: "Set New Password — Routiva CRM" },
      { property: "og:description", content: "Set a new Routiva CRM password from your recovery link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthCard title="Set a new password" desc="Use the password recovery link from your email to protect your account." footer={<AuthLink to="/login">Back to login</AuthLink>}><ResetPasswordForm /></AuthCard>,
});
