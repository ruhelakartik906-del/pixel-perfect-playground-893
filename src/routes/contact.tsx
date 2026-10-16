import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { ContactSection } from "@/components/site/ContactForm";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Routiva CRM" },
      { name: "description", content: "Send us a message to set up Routiva CRM for your team and Meta ad campaigns." },
      { property: "og:title", content: "Contact Us — Routiva CRM" },
      { property: "og:description", content: "Talk to the Routiva team." },
    ],
  }),
  component: () => (
    <>
      <PageHero eyebrow="Contact" title="Let's set up your workspace" desc="Share a few details and we'll reply by email." />
      <ContactSection />
    </>
  ),
});
