import { createFileRoute } from "@tanstack/react-router";
import { Lock, Target, Zap } from "lucide-react";
import team from "@/assets/team.jpg";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CtaBand } from "@/components/site/MoreSections";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Routiva CRM" },
      { name: "description", content: "Why we built Routiva: a focused CRM for businesses that grow through Meta ad leads." },
      { property: "og:title", content: "About Us — Routiva CRM" },
      { property: "og:description", content: "A focused CRM for ad-driven businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const values = [
  { icon: Target, title: "Focused on leads", desc: "We build for one job — getting every ad enquiry to the right person quickly." },
  { icon: Lock, title: "Security first", desc: "Access rules are enforced on the server so each person sees only what they should." },
  { icon: Zap, title: "Fast and simple", desc: "A clean interface your team can learn in minutes, not weeks." },
];

function About() {
  return (
    <>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="eyebrow">About Routiva</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-[50px]">Built for teams that grow through <span className="text-primary">ad leads</span></h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Businesses spend real money on Facebook and Instagram ads, yet leads often sit in spreadsheets or get shared unevenly. Routiva makes sure each lead reaches the right team member, with clear rules and full visibility.</p>
          </div>
          <img src={team} alt="Sales team reviewing leads together" width={1280} height={960} className="rounded-3xl border shadow-float" />
        </div>
      </section>
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading eyebrow="Our principles" title="What guides our product" />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-card p-7 shadow-card">
                <span className="grid size-11 place-items-center rounded-xl bg-icon-gradient text-primary-foreground"><Icon className="size-5" /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-[15px] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
