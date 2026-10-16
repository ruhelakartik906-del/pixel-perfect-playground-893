import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { CtaBand, Faq } from "@/components/site/MoreSections";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ & Help — Routiva CRM" },
      { name: "description", content: "Answers about Meta Ads integration, lead assignment, routing rules, permissions, attendance and security." },
      { property: "og:title", content: "FAQ & Help — Routiva CRM" },
      { property: "og:description", content: "Common questions about Routiva CRM." },
    ],
  }),
  component: () => (
    <>
      <PageHero eyebrow="FAQ & Help" title="How can we help?" desc="Quick answers about integrations, routing, access and security." />
      <Faq withHeading={false} />
      <CtaBand />
    </>
  ),
});
