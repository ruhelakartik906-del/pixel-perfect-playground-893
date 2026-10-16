import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Phone, Search, UserRound } from "lucide-react";
import { SectionHeading, DemoTag } from "./SectionHeading";
import { cn } from "@/lib/utils";

type Lead = {
  id: string; name: string; business: string; initials: string; status: string; city: string; phone: string;
  service: string; requirement: string; note: string; owner: string; campaign: string; followUp: string;
  timeline: { t: string; e: string }[];
};

const leads: Lead[] = [
  { id: "L-1042", name: "Ananya Rao", business: "Bloom Interiors", initials: "AR", status: "New", city: "Pune", phone: "+91 90000 00001", service: "Social media ads", requirement: "Wants 3 months of Instagram campaigns for a new showroom launch.", note: "Prefers calls after 4 PM.", owner: "Rahul M.", campaign: "Spring Video Ad A", followUp: "Today, 4:30 PM", timeline: [{ t: "10:02", e: "Lead received from Meta form" }, { t: "10:02", e: "Auto-assigned to Rahul M. (rule: Video Ad A)" }] },
  { id: "L-1041", name: "Vikram Shah", business: "Shah Auto Parts", initials: "VS", status: "Contacted", city: "Surat", phone: "+91 90000 00002", service: "Website redesign", requirement: "Needs a catalogue website with WhatsApp enquiry buttons.", note: "Sent portfolio on WhatsApp.", owner: "Neha K.", campaign: "Brand Awareness B", followUp: "Tomorrow, 11:00 AM", timeline: [{ t: "Yesterday", e: "Lead received" }, { t: "Yesterday", e: "Call completed — 6 min" }, { t: "Today", e: "Portfolio shared" }] },
  { id: "L-1039", name: "Meera Joseph", business: "Fresh Oven Bakery", initials: "MJ", status: "Interested", city: "Kochi", phone: "+91 90000 00003", service: "Lead generation", requirement: "Looking for local reach campaigns before the festive season.", note: "Budget discussion pending.", owner: "Arjun P.", campaign: "Festive Offer C", followUp: "Fri, 3:00 PM", timeline: [{ t: "Mon", e: "Lead received" }, { t: "Tue", e: "Status changed to Interested" }] },
  { id: "L-1036", name: "Daniel Fernandes", business: "Coastal Fitness", initials: "DF", status: "Converted", city: "Goa", phone: "+91 90000 00004", service: "Video ad production", requirement: "Two 30-second reels for membership drive.", note: "Proposal accepted.", owner: "Rahul M.", campaign: "Spring Video Ad A", followUp: "—", timeline: [{ t: "Last week", e: "Lead received" }, { t: "Mon", e: "Proposal sent" }, { t: "Wed", e: "Marked as Converted" }] },
];

const statusCls: Record<string, string> = {
  New: "bg-secondary text-primary",
  Contacted: "bg-warning-soft text-warning",
  Interested: "bg-accent text-accent-foreground",
  Converted: "bg-success-soft text-success",
};

export function CrmPreview() {
  const [sel, setSel] = useState(leads[0].id);
  const [q, setQ] = useState("");
  const list = useMemo(() => leads.filter((l) => (l.name + l.business).toLowerCase().includes(q.toLowerCase())), [q]);
  const lead = leads.find((l) => l.id === sel)!;

  return (
    <section id="overview" className="bg-surface py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Interactive preview" title="See your lead workspace in action" desc="Click any lead to see how customer details, notes and assignment information come together. This preview uses sample data only." />
        <div className="mt-14 overflow-hidden rounded-3xl border bg-card shadow-float">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex gap-1.5"><span className="size-3 rounded-full bg-destructive/60" /><span className="size-3 rounded-full bg-warning/60" /><span className="size-3 rounded-full bg-success/60" /></div>
            <DemoTag />
          </div>
          <div className="grid lg:grid-cols-[300px_1fr_280px]">
            <div className="border-b p-4 lg:border-b-0 lg:border-r">
              <label className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads or company…" className="w-full bg-transparent text-sm outline-none" aria-label="Search demo leads" />
              </label>
              <ul className="mt-3 space-y-1.5">
                {list.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => setSel(l.id)} className={cn("flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all", sel === l.id ? "bg-primary text-primary-foreground shadow-cta" : "hover:bg-muted")}>
                      <span className={cn("grid size-9 place-items-center rounded-full text-xs font-bold", sel === l.id ? "bg-primary-foreground/20" : "bg-secondary text-primary")}>{l.initials}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{l.name}</span>
                        <span className={cn("block truncate text-xs", sel === l.id ? "opacity-80" : "text-muted-foreground")}>{l.business}</span>
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", sel === l.id ? "bg-primary-foreground/20" : statusCls[l.status])}>{l.status}</span>
                    </button>
                  </li>
                ))}
                {list.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No demo leads match.</li>}
              </ul>
            </div>

            <div key={lead.id} className="animate-fade-up border-b p-6 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{lead.id} · {lead.city}</p>
                  <h3 className="text-2xl font-bold">{lead.name}</h3>
                  <p className="text-sm text-muted-foreground">{lead.business}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success"><Phone className="size-3.5" /> {lead.phone}</span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-surface p-4"><p className="eyebrow text-muted-foreground">Requested service</p><p className="mt-1 font-semibold">{lead.service}</p></div>
                <div className="rounded-xl bg-surface p-4"><p className="eyebrow text-muted-foreground">Note</p><p className="mt-1 text-sm">{lead.note}</p></div>
              </div>
              <div className="mt-4 rounded-xl border p-4"><p className="eyebrow text-muted-foreground">Customer requirement</p><p className="mt-1 text-sm leading-relaxed">{lead.requirement}</p></div>
              <p className="eyebrow mt-6 text-muted-foreground">Activity timeline</p>
              <ol className="mt-3 space-y-3 border-l-2 border-secondary pl-4">
                {lead.timeline.map((x, i) => (
                  <li key={i} className="relative text-sm"><span className="absolute -left-[23px] top-1 size-3 rounded-full border-2 border-card bg-primary" /><span className="font-semibold">{x.t}</span> <span className="text-muted-foreground">— {x.e}</span></li>
                ))}
              </ol>
            </div>

            <div className="space-y-3 p-5">
              <p className="eyebrow text-muted-foreground">Lead status</p>
              {["New", "Contacted", "Interested", "Converted"].map((s) => (
                <div key={s} className={cn("flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium", lead.status === s && "border-success/40 bg-success-soft text-success")}>
                  {s}{lead.status === s ? <CheckCircle2 className="size-4" /> : <span className="size-4 rounded-full border" />}
                </div>
              ))}
              <div className="mt-4 space-y-3 rounded-xl bg-surface p-4 text-sm">
                <p className="flex items-center gap-2"><UserRound className="size-4 text-primary" /> <span className="text-muted-foreground">Assigned:</span> <b>{lead.owner}</b></p>
                <p className="flex items-center gap-2"><span className="size-4 rounded bg-brand-gradient" /> <span className="text-muted-foreground">Source:</span> <b className="truncate">{lead.campaign}</b></p>
                <p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> <span className="text-muted-foreground">Next:</span> <b>{lead.followUp}</b></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
