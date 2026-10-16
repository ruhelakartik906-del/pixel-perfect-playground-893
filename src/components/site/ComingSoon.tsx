import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <section className="bg-hero">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-5 py-20">
        <div className="w-full rounded-3xl border bg-card p-8 text-center shadow-float">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-icon-gradient text-primary-foreground shadow-cta"><KeyRound className="size-6" /></span>
          <h1 className="mt-6 text-3xl font-bold">{title}</h1>
          <p className="mt-3 text-muted-foreground">{desc}</p>
          <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Account access is being set up and will be available soon.</p>
          <div className="mt-6 grid gap-2">
            <Button asChild variant="hero" size="xl"><Link to="/contact">Contact our team</Link></Button>
            <Button asChild variant="ghost"><Link to="/">Back to home</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
