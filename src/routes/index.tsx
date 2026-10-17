import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { Features } from "@/components/site/Features";
import { CrmPreview } from "@/components/site/CrmPreview";
import { Distribution } from "@/components/site/Distribution";
import { Analytics } from "@/components/site/Analytics";
import { Benefits, CtaBand, Faq, HowItWorks } from "@/components/site/MoreSections";
import { ContactSection } from "@/components/site/ContactForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Routiva CRM — Turn Every Ad Lead Into Business" },
      { name: "description", content: "Capture Facebook and Instagram leads, auto-assign them with per-ad quotas, and manage every enquiry in one CRM." },
      { property: "og:title", content: "Routiva CRM — Turn Every Ad Lead Into Business" },
      { property: "og:description", content: "Meta lead capture, smart ad-based routing and team follow-ups in one CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <Features />
      <CrmPreview />
      <Distribution />
      <Analytics />
      <HowItWorks />
      <Benefits />
      <Faq />
      <ContactSection />
      <CtaBand />
    </>
  );
}
