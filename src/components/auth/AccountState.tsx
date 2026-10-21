import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { accountStatePath, type AccountStatus } from "@/lib/account-status";

export function AccountState({ kind }: { kind: "pending" | "restricted" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("account_status").eq("id", userData.user.id).maybeSingle();
      const status = data?.account_status as AccountStatus | undefined;
      const path = accountStatePath(kind, status);
      if ((kind === "pending" && path !== "/pending-approval") || (kind === "restricted" && path !== "/restricted")) {
        navigate({ to: path, replace: true });
        return;
      }
      setLoading(false);
    }
    void check();
    return () => { active = false; };
  }, [kind, navigate]);

  if (loading) return <section className="grid min-h-[60vh] place-items-center bg-surface"><Loader2 className="size-8 animate-spin text-primary" /></section>;

  const pending = kind === "pending";
  return (
    <section className="bg-hero px-5 py-24">
      <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-8 text-center shadow-float">
        {pending ? <ShieldCheck className="mx-auto size-14 text-primary" /> : <Lock className="mx-auto size-14 text-destructive" />}
        <h1 className="mt-5 text-3xl font-extrabold text-foreground">{pending ? "Approval pending" : "Access restricted"}</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          {pending ? "Your account is created and waiting for admin approval. You can enter the CRM once it is activated." : "This account cannot access the CRM right now. Contact your workspace admin if this looks wrong."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild variant="hero" size="xl"><Link to="/contact">Contact support</Link></Button>
          <Button asChild variant="pill" size="xl"><Link to="/">Back home</Link></Button>
        </div>
      </div>
    </section>
  );
}
