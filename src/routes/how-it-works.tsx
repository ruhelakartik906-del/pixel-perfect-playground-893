import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { CtaBand, HowItWorks } from "@/components/site/MoreSections";
import { Distribution } from "@/components/site/Distribution";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Routiva CRM" },
      { name: "description", content: "Connect Meta Lead Ads via Make.com, set ad-specific routing rules, and let leads distribute automatically." },
      { property: "og:title", content: "How It Works — Routiva CRM" },
      { property: "og:description", content: "From Meta ad click to assigned lead in four steps." },
    ],
  }),
  component: () => (
    <>
      <PageHero eyebrow="How it works" title="Simple setup. Reliable routing." desc="Connect once, define your rules, and every new lead lands with the right person." />
      <HowItWorks />
      <Distribution />
      <CtaBand />
    </>
  ),
});
