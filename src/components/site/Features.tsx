import { BarChart3, CalendarCheck, Database, Gauge, Megaphone, Shuffle } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const features = [
  { icon: Megaphone, title: "Automatic Meta Lead Capture", desc: "Facebook and Instagram form submissions arrive in your CRM within seconds — every question and answer kept intact." },
  { icon: Shuffle, title: "Smart Ad-Based Lead Routing", desc: "Route leads by Page, campaign, ad set, ad or form. Every ad can follow its own independent rule." },
  { icon: Gauge, title: "Custom Lead Quotas", desc: "Send the first 5 leads to one person and the overflow to another. Counters are tracked per rule, on the server." },
  { icon: Database, title: "Centralized Customer Records", desc: "Contact details, requirements, notes, follow-ups and activity history in one clean customer profile." },
  { icon: CalendarCheck, title: "Attendance Management", desc: "Team members check in and out daily with trusted server timestamps and a monthly calendar view." },
  { icon: BarChart3, title: "Team Performance Reports", desc: "See leads received, contacted and converted by person, campaign and date range." },
];

export function Features() {
  return (
    <section id="features" className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Why teams choose Routiva"
          title={<>A focused CRM built for <span className="text-primary">ad-driven</span> businesses</>}
          desc="No bloated menus. Just the tools you need to capture, assign and follow up on every lead from your Meta campaigns."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group rounded-2xl border bg-card p-7 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-float">
              <span className="grid size-12 place-items-center rounded-xl bg-icon-gradient text-primary-foreground shadow-cta transition-transform group-hover:scale-105">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-6 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
