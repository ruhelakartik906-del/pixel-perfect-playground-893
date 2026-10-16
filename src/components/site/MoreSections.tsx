import { Link } from "@tanstack/react-router";
import { Eye, Lock, ShieldCheck, Timer, Users, FolderOpen } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./SectionHeading";

export const steps = [
  { title: "Connect Meta Lead Ads through Make.com", desc: "A Make.com scenario forwards each new lead form submission to your secure Routiva endpoint." },
  { title: "Configure ad-specific routing rules", desc: "Choose the ad, ad set, campaign, form or Page, then pick team members and their exact quotas." },
  { title: "Leads are distributed automatically", desc: "Each incoming lead is matched, assigned and saved in one safe step — quotas are never exceeded." },
  { title: "Track follow-ups and performance", desc: "Team members call, WhatsApp and log notes while managers watch results in real time." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="How it works" title="From ad click to assigned lead in four steps" />
        <div className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-7 hidden h-0.5 bg-brand-gradient opacity-40 lg:block" />
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border bg-card p-6 shadow-card">
              <span className="relative grid size-14 place-items-center rounded-2xl bg-brand-gradient text-xl font-extrabold text-primary-foreground shadow-cta">{i + 1}</span>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const benefits = [
  { icon: Timer, title: "Faster Lead Response", desc: "Leads reach the right person the moment they arrive, so customers hear back while still interested." },
  { icon: Eye, title: "No Missed Leads", desc: "Unmatched leads go to a review queue instead of disappearing into a spreadsheet." },
  { icon: FolderOpen, title: "Organized Customer Information", desc: "Every form answer, note and follow-up lives in a single customer record." },
  { icon: Users, title: "Better Team Accountability", desc: "Clear ownership for each lead, with activity history and attendance records." },
  { icon: Lock, title: "Secure Customer Data", desc: "Role-based access means team members only see the leads assigned to them." },
  { icon: ShieldCheck, title: "Real-Time Lead Visibility", desc: "Managers see incoming volume, assignments and outcomes as they happen." },
];

export function Benefits() {
  return (
    <section className="bg-surface py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Business benefits" title="Built for real sales teams" desc="Simple, dependable tools that help your team respond faster and close more of the leads you already pay for." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-float">
              <span className="grid size-11 place-items-center rounded-xl bg-icon-gradient text-primary-foreground"><Icon className="size-5" /></span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const faqs = [
  { q: "How does Routiva receive leads from Meta Ads?", a: "Meta Lead Ads connect to Make.com, which sends each new lead to a secure Routiva endpoint. The lead is validated, routed and saved automatically." },
  { q: "How are leads assigned to team members?", a: "Each routing rule lists team members in order with a lead limit for each. When one person's quota is reached, the next person receives leads. The last step can be unlimited overflow." },
  { q: "Can I connect several Facebook Pages?", a: "Yes. Each lead carries its Page ID, so you can create separate rules per Page, or a Page-level fallback rule." },
  { q: "Can different ads go to different people?", a: "Yes. Rules can match an exact Ad ID, Ad Set, Campaign or Lead Form. Each rule keeps its own counter, so ads never share quotas." },
  { q: "Who can see which leads?", a: "Employees only see leads assigned to them. Managers see their permitted team's leads. Client accounts only see their own company workspace. Access is enforced on the server, not just hidden in menus." },
  { q: "How does attendance tracking work?", a: "Team members check in and out once per day. Times come from the server clock, so they cannot be edited from a browser." },
  { q: "Is customer data secure?", a: "Data is stored in a secured database with row-level access rules, and sensitive server keys never reach the browser." },
];

export function Faq({ withHeading = true }: { withHeading?: boolean }) {
  return (
    <section id="faq" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        {withHeading && <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />}
        <Accordion type="single" collapsible className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`f${i}`} className="rounded-2xl border bg-card px-5 shadow-card">
              <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="bg-background pb-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="rounded-[2rem] bg-brand-gradient px-6 py-16 text-center text-primary-foreground shadow-float">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to stop losing ad leads?</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-90">Set up routing rules once and let every new enquiry reach the right person automatically.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="light" size="xl"><Link to="/register">Get Started</Link></Button>
            <Button asChild variant="glass" size="xl"><Link to="/contact">Talk to us</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
