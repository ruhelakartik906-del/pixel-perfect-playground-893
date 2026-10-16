import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Inbox, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumb({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[15px] text-muted-foreground">
      <Home className="size-4" /><Link to="/admin/$" params={{ _splat: "" }} className="hover:text-foreground">Home</Link>
      <span>/</span><span className="font-medium text-foreground">{label}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-3 shadow-card xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function SearchInput({ placeholder, value, onChange, className }: { placeholder: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cn("flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-ring/30", className)}>
      <Search className="size-4 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
    </label>
  );
}

export function ToolbarButton({ children, onClick, primary, className }: { children: ReactNode; onClick?: () => void; primary?: boolean; className?: string }) {
  return (
    <button onClick={onClick} className={cn(
      "inline-flex h-10 items-center gap-2 rounded-md px-4 text-[15px] font-semibold transition-colors",
      primary ? "bg-admin-blue text-primary-foreground shadow-cta hover:opacity-90" : "border bg-card text-foreground hover:bg-muted",
      className)}>{children}</button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border bg-card shadow-card", className)}>{children}</section>;
}

export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-6 border-b">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-[17px] transition-colors",
            value === t.id ? "border-admin-blue text-admin-blue" : "border-transparent text-foreground hover:text-admin-blue")}>
          {t.label}
          {t.count !== undefined && <span className="rounded border bg-muted px-1.5 text-xs text-muted-foreground">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

const tones = {
  blue: "bg-admin-blue/10 text-admin-blue", green: "bg-admin-green/15 text-success", red: "bg-admin-red/10 text-admin-red",
  orange: "bg-admin-orange/15 text-warning", purple: "bg-admin-purple/10 text-admin-purple", gray: "bg-muted text-muted-foreground",
};
export function StatusBadge({ tone = "gray", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn("inline-flex rounded px-2 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function EmptyState({ title = "No data", hint }: { title?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Inbox className="size-14 text-border" strokeWidth={1.2} />
      <p className="text-[15px] text-muted-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DataTable({ columns, children, minWidth = 1400 }: { columns: string[]; children?: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[15px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b bg-muted/60">
            {columns.map((c) => <th key={c} className="whitespace-nowrap px-4 py-4 font-semibold text-foreground">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

const kpiTones = {
  purple: ["bg-admin-purple", "text-admin-purple", "bg-admin-purple/10"],
  pink: ["bg-admin-pink", "text-admin-pink", "bg-admin-pink/10"],
  blue: ["bg-admin-blue", "text-admin-blue", "bg-admin-blue/10"],
  green: ["bg-admin-green", "text-success", "bg-admin-green/15"],
  orange: ["bg-admin-orange", "text-warning", "bg-admin-orange/15"],
  red: ["bg-admin-red", "text-admin-red", "bg-admin-red/10"],
} as const;
export function KpiCard({ icon: Icon, label, value, note, chip, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: ReactNode; note: string; chip?: string; tone: keyof typeof kpiTones;
}) {
  const [bg, text, soft] = kpiTones[tone];
  return (
    <Card className="p-6 transition-shadow hover:shadow-float">
      <span className={cn("grid size-11 place-items-center rounded-lg text-primary-foreground", bg)}><Icon className="size-5" /></span>
      <p className="mt-4 text-sm font-bold uppercase tracking-wider text-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-extrabold", text)}>{value}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="truncate text-[15px] text-muted-foreground">{note}</span>
        {chip && <span className={cn("shrink-0 rounded px-2 py-1 text-xs font-bold", soft, text)}>{chip}</span>}
      </div>
    </Card>
  );
}
