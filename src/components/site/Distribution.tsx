import { useState } from "react";
import { ArrowRight, Database, GitBranch, Megaphone, RotateCcw, Send, UserCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading, DemoTag } from "./SectionHeading";
import { cn } from "@/lib/utils";

const flow = [
  { icon: Megaphone, label: "Meta Ads" },
  { icon: Workflow, label: "Make.com" },
  { icon: Database, label: "Secure Database" },
  { icon: GitBranch, label: "Routing Rules" },
  { icon: UserCheck, label: "Assigned Employee" },
];

type Step = { user: string; limit: number | null };
const rules: Record<string, { name: string; steps: Step[] }> = {
  A: { name: "Video Ad A", steps: [{ user: "User A", limit: 5 }, { user: "User D", limit: null }] },
  B: { name: "Video Ad B", steps: [{ user: "User C", limit: null }] },
  C: { name: "Video Ad C", steps: [{ user: "User B", limit: 10 }, { user: "User E", limit: 10 }, { user: "User F", limit: null }] },
};

function assignee(steps: Step[], n: number) {
  let used = 0;
  for (const s of steps) {
    if (s.limit === null || n <= used + s.limit) return s.user;
    used += s.limit;
  }
  return steps[steps.length - 1].user;
}

export function Distribution() {
  const [counts, setCounts] = useState<Record<string, number>>({ A: 0, B: 0, C: 0 });
  const [log, setLog] = useState<{ ad: string; n: number; user: string }[]>([]);

  const send = (k: string) => {
    const n = counts[k] + 1;
    setCounts({ ...counts, [k]: n });
    setLog((l) => [{ ad: rules[k].name, n, user: assignee(rules[k].steps, n) }, ...l].slice(0, 6));
  };

  return (
    <section id="distribution" className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Smart lead distribution" title={<>Every ad gets its <span className="text-primary">own routing rule</span></>} desc="Send leads from different video ads to different people, with exact limits. Each rule keeps its own counter, so one ad never uses up another ad's quota." />

        <div className="mt-14 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          {flow.map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex flex-1 items-center gap-3 md:flex-col md:gap-0">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border bg-card p-4 shadow-card md:w-full md:flex-col md:text-center">
                <span className="grid size-11 place-items-center rounded-xl bg-icon-gradient text-primary-foreground"><Icon className="size-5" /></span>
                <span className="text-sm font-bold md:mt-2">{label}</span>
              </div>
              {i < flow.length - 1 && <ArrowRight className="hidden size-5 shrink-0 text-primary md:absolute md:hidden" />}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Try it: simulate incoming leads</h3><DemoTag /></div>
            <div className="mt-5 space-y-4">
              {Object.entries(rules).map(([k, r]) => {
                let used = 0;
                return (
                  <div key={k} className="rounded-2xl border bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">Leads received: <b className="text-foreground">{counts[k]}</b></p>
                      </div>
                      <Button variant="hero" size="sm" className="h-9 px-4" onClick={() => send(k)}><Send /> Send lead</Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.steps.map((s) => {
                        const start = used; if (s.limit) used += s.limit;
                        const active = assignee(r.steps, counts[k] + 1) === s.user;
                        const filled = s.limit ? Math.min(Math.max(counts[k] - start, 0), s.limit) : Math.max(counts[k] - start, 0);
                        return (
                          <span key={s.user} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", active ? "border-primary bg-secondary text-primary" : "bg-card text-muted-foreground")}>
                            {s.user}: {s.limit ? `${filled}/${s.limit}` : `${filled} · overflow`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setCounts({ A: 0, B: 0, C: 0 }); setLog([]); }}><RotateCcw /> Reset counters</Button>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <h3 className="text-lg font-bold">Routing log</h3>
            <p className="text-sm text-muted-foreground">Most recent assignments appear here.</p>
            <ul className="mt-5 space-y-2">
              {log.length === 0 && <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Click "Send lead" to see where it goes.</li>}
              {log.map((x, i) => (
                <li key={`${x.ad}-${x.n}`} className={cn("flex items-center justify-between rounded-xl border px-4 py-3 text-sm", i === 0 && "animate-fade-up border-primary/30 bg-secondary")}>
                  <span><b>{x.ad}</b> · lead #{x.n}</span>
                  <span className="font-semibold text-primary">→ {x.user}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Rules match by stable Meta identifiers — Ad ID, then Ad Set, Campaign, Form and Page. Leads without a matching rule go to an admin review queue, never to a random person.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
