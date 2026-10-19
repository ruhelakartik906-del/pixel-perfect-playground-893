import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/site/Logo";
import { cn } from "@/lib/utils";

export function AuthCard({ title, desc, children, footer, compact = false }: { title: string; desc: string; children: ReactNode; footer?: ReactNode; compact?: boolean }) {
  return (
    <section className={cn("min-h-[calc(100vh-72px)] bg-hero px-5 py-16", compact && "py-6 sm:py-8 lg:py-16")}>
      <div className={cn("mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1fr]", compact && "gap-6 lg:gap-10")}>
        <div className={cn("max-w-lg", compact && "contents lg:block")}>
          <div className={cn(compact && "order-1 min-w-0 lg:order-none")}>
          {!compact && <Logo />}
          <h1 className={cn("mt-8 text-4xl font-extrabold leading-tight text-foreground md:text-5xl", compact && "mt-0 lg:mt-8")}>{title}</h1>
          <p className={cn("mt-4 text-lg leading-relaxed text-muted-foreground", compact && "mt-2 lg:mt-4")}>{desc}</p>
          </div>
          <div className={cn("mt-8 grid gap-3 text-sm text-muted-foreground", compact && "order-3 mt-0 lg:order-none lg:mt-8")}>
            <p className="rounded-2xl border bg-card p-4 shadow-card">New workspaces are reviewed before access is opened.</p>
            <p className="rounded-2xl border bg-card p-4 shadow-card">Approved users continue into the CRM dashboard automatically.</p>
          </div>
        </div>
        <div className={cn("rounded-3xl border bg-card p-6 shadow-float sm:p-8", compact && "order-2 min-w-0 lg:order-none")}>
          {children}
          {footer && <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </section>
  );
}

export function AuthLink({ to, children }: { to: "/login" | "/register" | "/forgot-password"; children: ReactNode }) {
  return <Link to={to} className="font-semibold text-primary hover:underline">{children}</Link>;
}
