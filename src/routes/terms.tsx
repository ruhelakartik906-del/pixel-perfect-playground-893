import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Routiva CRM" },
      { name: "description", content: "Terms for using Routiva CRM." },
      { property: "og:title", content: "Terms — Routiva CRM" },
      { property: "og:description", content: "Terms for using Routiva CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of Use" sections={[
      ["Using the service", "You agree to use Routiva CRM lawfully and only for leads your business is permitted to process."],
      ["Accounts", "New accounts require admin approval. You are responsible for keeping your login details secure."],
      ["Third-party services", "Integrations such as Meta Lead Ads and Make.com are governed by their own terms."],
      ["Changes", "We may update these terms and will note the date of the latest revision."],
    ]} />
  ),
});
