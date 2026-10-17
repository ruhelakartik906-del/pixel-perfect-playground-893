import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { UserWorkspace } from "@/components/workspace/UserWorkspace";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { workspacePathForStatus, type AccountStatus } from "@/lib/account-status";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Routiva CRM" },
      { name: "description", content: "Your Routiva CRM workspace for leads, follow-ups and attendance." },
      { property: "og:title", content: "Dashboard — Routiva CRM" },
      { property: "og:description", content: "Your Routiva CRM workspace for leads, follow-ups and attendance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const stats = [
  ["New leads", "24", "8 need assignment"],
  ["Follow-ups due", "17", "Today"],
  ["Active team", "6", "Checked in"],
  ["Conversion", "18.6%", "Demo data"],
];

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
      if (!active) return;
      const status = data?.account_status as AccountStatus | undefined;
      const target = workspacePathForStatus(status);
      if (target !== "/dashboard") {
        navigate({ to: target, replace: true });
        return;
      }
      setProfile(data);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [navigate]);

  if (loading) return <section className="grid min-h-screen place-items-center bg-surface"><Loader2 className="size-8 animate-spin text-primary" /></section>;

  return (
    <UserWorkspace>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="eyebrow text-primary">CRM dashboard</p>
            <h1 className="mt-2 text-3xl font-extrabold text-foreground">Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
            <p className="mt-1 text-muted-foreground">Demo workspace preview for lead routing, follow-ups and attendance.</p>
          </div>
          <Button variant="hero" size="xl"><CheckCircle2 /> Active account</Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(([label, value, note]) => <div key={label} className="rounded-2xl border bg-card p-5 shadow-card"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-extrabold text-foreground">{value}</p><p className="mt-1 text-xs font-semibold uppercase text-primary">{note}</p></div>)}
        </div>
        <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="text-xl font-bold">Recent lead queue</h2>
            <div className="mt-5 grid gap-3">
              {["Aisha Khan — Spring Video Ad", "Rahul Mehta — Page Form", "Priya Shah — Retargeting Campaign", "Naveen Rao — Lead Form B"].map((lead, index) => <div key={lead} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"><span className="font-semibold">{lead}</span><span className="text-sm text-muted-foreground">#{index + 1}</span></div>)}
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="text-xl font-bold">Today</h2>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p><b className="text-foreground">6</b> team members checked in.</p>
              <p><b className="text-foreground">17</b> follow-ups are due before 6 PM.</p>
              <p><b className="text-foreground">4</b> unmatched leads need review.</p>
            </div>
          </section>
        </div>
    </UserWorkspace>
  );
}
