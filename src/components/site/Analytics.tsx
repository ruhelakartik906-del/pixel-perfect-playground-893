import { CalendarDays, TrendingUp, Users, Zap } from "lucide-react";
import { SectionHeading, DemoTag } from "./SectionHeading";

const stats = [
  { label: "Leads Today", value: "42", sub: "+8 vs yesterday", icon: Zap },
  { label: "Leads This Month", value: "1,248", sub: "Across 6 campaigns", icon: CalendarDays },
  { label: "Assigned", value: "95%", sub: "Within 1 minute", icon: Users },
  { label: "Conversion Rate", value: "18.6%", sub: "+2.1 pts this month", icon: TrendingUp },
];
const sources = [["Facebook Feed", 46], ["Instagram Reels", 31], ["Instagram Stories", 15], ["Messenger", 8]] as const;
const team = [["Rahul M.", 212, 41], ["Neha K.", 188, 37], ["Arjun P.", 164, 26], ["Sara L.", 140, 22]] as const;
const trend = [22, 30, 26, 38, 34, 45, 41, 52, 48, 60, 57, 66];

export function Analytics() {
  const max = Math.max(...trend);
  const pts = trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${100 - (v / max) * 85}`).join(" ");
  return (
    <section id="analytics" className="bg-surface py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Reports & analytics" title="Know exactly where every lead goes" desc="Live dashboards for lead volume, sources, assignments and team performance. Figures below are example numbers." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-4" /></span>
              </div>
              <p className="mt-2 text-3xl font-bold">{value}</p>
              <span className="mt-3 inline-block rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">{sub}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div><p className="eyebrow">Conversion trend</p><p className="mt-1 text-xl font-bold">Converted leads, last 12 weeks</p></div>
              <DemoTag />
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-6 h-56 w-full">
              <defs>
                <linearGradient id="ar" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient>
              </defs>
              <polygon points={`0,100 ${pts} 100,100`} fill="url(#ar)" />
              <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
            </svg>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <p className="eyebrow">Lead source breakdown</p>
            <div className="mt-5 space-y-4">
              {sources.map(([s, p]) => (
                <div key={s}>
                  <div className="flex justify-between text-sm"><span>{s}</span><b>{p}%</b></div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand-gradient" style={{ width: `${p}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-6 py-3">Team member</th><th className="px-6 py-3">Leads assigned</th><th className="px-6 py-3">Converted</th><th className="px-6 py-3">Rate</th></tr></thead>
            <tbody>
              {team.map(([n, a, c]) => (
                <tr key={n} className="border-b last:border-0"><td className="px-6 py-3 font-semibold">{n}</td><td className="px-6 py-3">{a}</td><td className="px-6 py-3">{c}</td><td className="px-6 py-3 font-semibold text-primary">{((c / a) * 100).toFixed(1)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
