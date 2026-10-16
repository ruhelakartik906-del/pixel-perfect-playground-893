import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Routiva CRM" },
      { name: "description", content: "How Routiva CRM collects, uses and protects your data." },
      { property: "og:title", content: "Privacy Policy — Routiva CRM" },
      { property: "og:description", content: "How Routiva CRM protects your data." },
    ],
  }),
  component: () => (
    <LegalPage title="Privacy Policy" sections={[
      ["Information we collect", "Details you submit through our forms, account information, and lead data your business sends to the platform from its own ad campaigns."],
      ["How we use it", "To operate the CRM, route leads to your team, and respond to your enquiries. We do not sell personal data."],
      ["Access and security", "Access is limited by role. Team members only see the leads assigned to them."],
      ["Your choices", "Contact us to request access to, correction of, or deletion of your information."],
    ]} />
  ),
});
