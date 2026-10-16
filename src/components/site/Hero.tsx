import { Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone, UserCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoTag } from "./SectionHeading";

const bars = [38, 52, 45, 63, 58, 74, 88];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-card">
            <span className="size-2 rounded-full bg-success" />
            <span className="eyebrow text-[0.68rem]">Meta lead management CRM</span>
          </span>
          <h1 className="mt-6 text-[40px] font-extrabold leading-[1.08] text-foreground md:text-[58px]">
            Turn Every <span className="text-primary">Ad Lead</span> Into a Real{" "}
            <span className="text-primary">Business Opportunity.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Capture leads from Facebook and Instagram, automatically assign them to the right team members, and manage every customer enquiry from one powerful CRM.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-6">
            {[["Instant", "Lead capture"], ["Per-ad", "Routing quotas"], ["Role-based", "Team access"]].map(([a, b]) => (
              <div key={a}>
                <p className="text-xl font-bold text-primary">{a}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl"><Link to="/register">Get Started <ArrowRight /></Link></Button>
            <Button asChild variant="pill" size="xl"><Link to="/features">Explore Features</Link></Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl animate-fade-up [animation-delay:150ms]">
          <div className="rounded-3xl border bg-card p-6 shadow-float">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow text-muted-foreground">Leads this week</p>
                <p className="mt-1 text-3xl font-bold">186 Leads</p>
              </div>
              <DemoTag />
            </div>
            <div className="mt-6 grid grid-cols-[1.3fr_1fr] gap-5">
              <div className="flex h-44 items-end gap-2.5 rounded-2xl bg-surface p-4">
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-brand-gradient" style={{ height: `${h}%`, opacity: 0.45 + i * 0.08 }} />
                ))}
              </div>
              <div className="grid gap-3">
                {[["Total Leads", "1,248"], ["Assigned", "1,190"], ["Follow-ups", "64"], ["Conversion", "18.6%"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border bg-surface px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="text-base font-bold">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -left-6 top-16 hidden w-56 rounded-2xl border bg-card p-4 shadow-float animate-float sm:block">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary"><Megaphone className="size-3.5" /> New Meta lead</p>
            <p className="mt-2 text-sm font-semibold">Ananya Rao — Bloom Interiors</p>
            <p className="text-xs text-muted-foreground">Campaign: Spring Video Ad</p>
          </div>
          <div className="absolute -bottom-8 -left-2 hidden w-60 rounded-2xl border bg-card p-4 shadow-float animate-float [animation-delay:1.5s] sm:block">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success"><UserCheck className="size-3.5" /> Auto-assigned</p>
            <p className="mt-2 text-xs text-muted-foreground">Lead 4 of 5 for <b className="text-foreground">Video Ad A</b> sent to Rahul M.</p>
          </div>
          <div className="absolute -right-4 -top-6 hidden rounded-2xl border bg-card px-4 py-3 shadow-float animate-float [animation-delay:3s] sm:block">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Zap className="size-3.5 text-primary" /> Response time</p>
            <p className="text-xl font-bold text-primary">2m 14s</p>
          </div>
        </div>
      </div>
    </section>
  );
}
