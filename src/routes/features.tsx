import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Megaphone, Plug } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Features } from "@/components/site/Features";
import { CrmPreview } from "@/components/site/CrmPreview";
import { Distribution } from "@/components/site/Distribution";
import { Analytics } from "@/components/site/Analytics";
import { CtaBand } from "@/components/site/MoreSections";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Routiva CRM" },
      { name: "description", content: "Meta lead capture, smart distribution, attendance tracking, reports and Make.com integration." },
      { property: "og:title", content: "Features — Routiva CRM" },
      { property: "og:description", content: "Everything your team needs to capture and convert Meta ad leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeaturesPage,
});

const blocks = [
  { id: "meta-leads", icon: Megaphone, title: "Meta Lead Management", desc: "Every Facebook and Instagram lead form submission is stored with all of its questions and answers — including custom fields that vary between forms. Nothing is discarded.", points: ["Deduplicated by Meta Lead ID", "Page, campaign, ad set, ad and form recorded", "Full original answers kept"] },
  { id: "attendance", icon: CalendarCheck, title: "Attendance Tracking", desc: "Team members check in and out once a day. Working hours are calculated from trusted server time and shown on a monthly calendar.", points: ["One check-in per day", "Server timestamps", "Monthly history"] },
  { id: "integrations", icon: Plug, title: "Integrations", desc: "Routiva receives leads from Meta Lead Ads through a Make.com scenario that posts to a secure, authenticated endpoint. Setup requires your own Make.com account.", points: ["Meta Lead Ads → Make.com", "Authenticated webhook", "Delivery and routing logs"] },
];

function FeaturesPage() {
  return (
    <>
      <PageHero eyebrow="Product" title={<>Everything you need to <span className="text-primary">convert ad leads</span></>} desc="From the moment someone fills your Meta lead form to the final follow-up call — one connected workspace." />
      <Features />
      <CrmPreview />
      <section className="bg-background py-24">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 lg:grid-cols-3 lg:px-8">
          {blocks.map(({ id, icon: Icon, title, desc, points }) => (
            <div key={id} id={id} className="scroll-mt-28 rounded-3xl border bg-card p-8 shadow-card">
              <span className="grid size-12 place-items-center rounded-xl bg-icon-gradient text-primary-foreground shadow-cta"><Icon className="size-5" /></span>
              <h2 className="mt-6 text-2xl font-bold">{title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {points.map((p) => <li key={p} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" />{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <Distribution />
      <Analytics />
      <CtaBand />
    </>
  );
}
