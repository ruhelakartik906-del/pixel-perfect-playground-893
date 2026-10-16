import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, desc, className }: { eyebrow: string; title: React.ReactNode; desc?: string; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-[42px]">{title}</h2>
      {desc && <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{desc}</p>}
    </div>
  );
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning", className)}>
      Demo data
    </span>
  );
}
