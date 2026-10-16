import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimSuperAdmin, getAdminSetupStatus } from "@/lib/admin-setup.functions";

export const Route = createFileRoute("/_authenticated/setup-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Setup — Routiva CRM" },
      { name: "description", content: "One-time Super Admin initialization for the Routiva CRM workspace owner." },
      { property: "og:title", content: "Super Admin Setup — Routiva CRM" },
      { property: "og:description", content: "One-time Super Admin initialization for the Routiva CRM workspace owner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupAdmin,
});

const reasons: Record<string, string> = {
  not_configured: "Setup code has not been configured yet.",
  closed: "A Super Admin already exists. Setup is closed.",
  bad_code: "That setup code is incorrect.",
  unconfirmed: "Confirm your email address first, then try again.",
  no_user: "Your account could not be found.",
};

function SetupAdmin() {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getAdminSetupStatus);
  const claim = useServerFn(claimSuperAdmin);
  const status = useQuery({ queryKey: ["admin-setup-status"], queryFn: () => fetchStatus() });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await claim({ data: { code } });
      if (res.ok) {
        toast.success("Super Admin access granted.");
        navigate({ to: "/admin/dashboard", replace: true });
        return;
      }
      toast.error(reasons[res.reason] ?? "Setup failed.");
    } catch {
      toast.error("Setup failed. Please try again.");
    }
    setBusy(false);
  };

  return (
    <section className="bg-hero px-5 py-24">
      <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 shadow-float">
        <ShieldCheck className="mx-auto size-14 text-primary" />
        <h1 className="mt-5 text-center text-3xl font-extrabold text-foreground">Super Admin setup</h1>
        {status.isLoading ? (
          <div className="mt-6 grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : status.data && !status.data.open ? (
          <p className="mt-3 text-center text-muted-foreground">A Super Admin already exists. This one-time setup is closed.</p>
        ) : status.data && !status.data.configured ? (
          <p className="mt-3 text-center text-muted-foreground">The workspace owner has not configured a setup code yet.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <p className="text-center text-sm text-muted-foreground">Enter the private setup code to make this signed-in account the workspace Super Admin. This works only once.</p>
            <div>
              <Label htmlFor="code" className="text-sm font-semibold">Setup code</Label>
              <Input id="code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
            </div>
            <Button type="submit" variant="hero" size="xl" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Activate Super Admin
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
