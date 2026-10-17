import type { ComponentType, ReactNode } from "react";
import { Card } from "./ui";
import { cn } from "@/lib/utils";

export const kpiTone = {
  blue: { solid: "bg-admin-blue", text: "text-admin-blue", soft: "bg-admin-blue/10" },
  green: { solid: "bg-admin-green", text: "text-success", soft: "bg-admin-green/15" },
  orange: { solid: "bg-admin-orange", text: "text-warning", soft: "bg-admin-orange/15" },
  purple: { solid: "bg-admin-purple", text: "text-admin-purple", soft: "bg-admin-purple/10" },
  pink: { solid: "bg-admin-pink", text: "text-admin-pink", soft: "bg-admin-pink/10" },
  red: { solid: "bg-admin-red", text: "text-admin-red", soft: "bg-admin-red/10" },
} as const;
export type KpiTone = keyof typeof kpiTone;

/** Icon top-left, optional chip top-right, label, value, note. */
export function MiniKpi({ icon: Icon, tone, chip, label, value, note, iconRight }: {
  icon: ComponentType<{ className?: string }>; tone: KpiTone; chip?: string; label: string; value: ReactNode; note?: ReactNode; iconRight?: boolean;
}) {
  const t = kpiTone[tone];
  if (iconRight) return (
    <Card className="flex items-start justify-between p-5">
      <div><p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p>{note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}</div>
      <span className={cn("grid size-14 place-items-center rounded-xl", t.soft, t.text)}><Icon className="size-6" /></span>
    </Card>
  );
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className={cn("grid size-11 place-items-center rounded-lg text-primary-foreground", t.solid)}><Icon className="size-5" /></span>
        {chip && <span className={cn("rounded px-2.5 py-1 text-xs font-semibold", t.text, t.soft)}>{chip}</span>}
      </div>
      <p className="mt-4 font-semibold">{label}</p>
      <p className={cn("text-3xl font-bold", t.text)}>{value}</p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </Card>
  );
}
