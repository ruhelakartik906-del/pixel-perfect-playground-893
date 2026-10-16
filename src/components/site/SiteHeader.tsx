import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, CalendarCheck, ChevronDown, HelpCircle, Info, LayoutDashboard, Mail, Megaphone, Menu, Plug, Shuffle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

export const productLinks = [
  { label: "CRM Overview", hash: "overview", icon: LayoutDashboard, desc: "One workspace for every enquiry" },
  { label: "Meta Lead Management", hash: "meta-leads", icon: Megaphone, desc: "Facebook & Instagram lead capture" },
  { label: "Smart Lead Distribution", hash: "distribution", icon: Shuffle, desc: "Ad-specific routing with quotas" },
  { label: "Attendance Tracking", hash: "attendance", icon: CalendarCheck, desc: "Daily check-in and check-out" },
  { label: "Reports & Analytics", hash: "analytics", icon: BarChart3, desc: "Team and campaign performance" },
  { label: "Integrations", hash: "integrations", icon: Plug, desc: "Meta Lead Ads via Make.com" },
] as const;

const resourceLinks = [
  { label: "FAQ & Help", to: "/faq", icon: HelpCircle, desc: "Answers to common questions" },
  { label: "About Us", to: "/about", icon: Info, desc: "Why we built Routiva" },
  { label: "Contact Us", to: "/contact", icon: Mail, desc: "Talk to our team" },
] as const;

function Dropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:text-primary", open && "bg-secondary text-primary")}
      >
        {label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("absolute left-1/2 top-full z-50 w-[340px] -translate-x-1/2 pt-3 transition-all", open ? "visible opacity-100 translate-y-0" : "invisible opacity-0 -translate-y-1")}>
        <div className="rounded-2xl border bg-popover p-2 shadow-float" onClick={() => setOpen(false)}>{children}</div>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, desc }: { icon: typeof Menu; label: string; desc: string }) {
  return (
    <span className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-4" /></span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  const [mobile, setMobile] = useState(false);
  const navCls = "rounded-full px-3 py-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:text-primary";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <Link to="/" className={navCls} activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }}>Home</Link>
          <Dropdown label="Product">
            {productLinks.map((l) => (
              <Link key={l.hash} to="/features" hash={l.hash}><MenuItem {...l} /></Link>
            ))}
          </Dropdown>
          <Link to="/how-it-works" className={navCls} activeProps={{ className: "text-primary" }}>How It Works</Link>
          <Dropdown label="Resources">
            {resourceLinks.map((l) => (
              <Link key={l.to} to={l.to}><MenuItem {...l} /></Link>
            ))}
          </Dropdown>
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" className="rounded-full font-semibold"><Link to="/login">Login</Link></Button>
          <Button asChild variant="hero" size="xl" className="h-11"><Link to="/register">Get Started</Link></Button>
        </div>
        <button className="grid size-10 place-items-center rounded-full border lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>

      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobile(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-background p-5 shadow-float animate-in slide-in-from-right">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobile(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-full border"><X className="size-5" /></button>
            </div>
            <div onClick={() => setMobile(false)} className="flex flex-col gap-1">
              <Link to="/" className="rounded-lg px-3 py-2.5 font-semibold">Home</Link>
              <p className="eyebrow mt-3 px-3">Product</p>
              {productLinks.map((l) => <Link key={l.hash} to="/features" hash={l.hash}><MenuItem {...l} /></Link>)}
              <Link to="/how-it-works" className="mt-2 rounded-lg px-3 py-2.5 font-semibold">How It Works</Link>
              <p className="eyebrow mt-3 px-3">Resources</p>
              {resourceLinks.map((l) => <Link key={l.to} to={l.to}><MenuItem {...l} /></Link>)}
              <div className="mt-6 grid gap-2">
                <Button asChild variant="pill" size="xl"><Link to="/login">Login</Link></Button>
                <Button asChild variant="hero" size="xl"><Link to="/register">Get Started</Link></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
