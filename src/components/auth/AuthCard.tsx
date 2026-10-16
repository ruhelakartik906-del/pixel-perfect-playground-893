import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/site/Logo";

export function AuthCard({ title, desc, children, footer }: { title: string; desc: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-hero px-5 py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1fr]">
        <div className="max-w-lg">
          <Logo />
          <h1 className="mt-8 text-4xl font-extrabold leading-tight text-foreground md:text-5xl">{title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{desc}</p>
          <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
            <p className="rounded-2xl border bg-card p-4 shadow-card">New workspaces are reviewed before access is opened.</p>
            <p className="rounded-2xl border bg-card p-4 shadow-card">Approved users continue into the CRM dashboard automatically.</p>
          </div>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-float sm:p-8">
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
