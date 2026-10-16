import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RoutePending() {
  return (
    <div className="grid min-h-screen place-items-center bg-background" role="status" aria-label="Loading">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-float">
        <ShieldAlert className="mx-auto size-14 text-destructive" />
        <h1 className="mt-5 text-3xl font-extrabold text-foreground">Access denied</h1>
        <p className="mt-3 text-muted-foreground">The Master Admin panel is only available to Super Admin accounts.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild variant="hero" size="xl"><Link to="/dashboard">Go to my dashboard</Link></Button>
          <Button asChild variant="pill" size="xl"><Link to="/">Back home</Link></Button>
        </div>
      </div>
    </div>
  );
}
