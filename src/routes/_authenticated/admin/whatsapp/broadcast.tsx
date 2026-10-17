import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, CheckCircle2, Copy, Eye, FileText, Filter, HelpCircle, Inbox, Info, Megaphone, MessageCircleMore, MoreVertical, Pencil, RefreshCw, Send, Trash2, UserRoundPlus, UsersRound, X, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { MiniKpi } from "@/components/admin/MiniKpi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminHead } from "@/lib/admin-head";
import { WF_TRIGGERS, deliveryRate, normalizePhone, triggerLabel } from "@/lib/wa-workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/whatsapp/broadcast")({
  head: () => adminHead("WhatsApp Broadcast", "Manage and track your bulk WhatsApp messaging campaigns."),
  component: BroadcastPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["wa-broadcasts"];
type B = { id: string; name: string; kind: "manual" | "event"; event_trigger: string | null; audience: Aud; template_id: string | null; template_params: string[]; scheduled_at: string | null; status: string; recipients_count: number; sent_count: number; delivered_count: number; read_count: number; failed_count: number; created_at: string };
type Aud = { source: "leads" | "customers" | "selected"; filters: Record<string, string>; selected: string[]; tz: string; delivery: "now" | "later"; date: string; time: string };
type Person = { id: string; name: string; phone: string; source: "lead" | "customer"; city: string; state: string; source_id?: string | null; stage_id?: string | null; category?: string; assigned_to?: string | null };
type Tpl = { id: string; name: string; category: string; language: string; header: string; body: string; footer: string; status: string };
type Form = { id?: string; name: string; kind: "manual" | "event"; event_trigger: string; template_id: string; template_params: string[]; audience: Aud };
const blankAud: Aud = { source: "leads", filters: {}, selected: [], tz: "Asia/Kolkata", delivery: "now", date: "", time: "" };
const tabs = ["all", "draft", "scheduled", "processing", "completed"] as const;

async function loadAudience() {
  const [l, c, s, o, st, p] = await Promise.all([
    db.from("leads").select("id,customer_name,phone,region,source_id,stage_id,business_category,assigned_to").limit(10000),
    db.from("sales_customers").select("id,name,phone,city,state,is_active").eq("is_active", true).limit(10000),
    db.from("wa_suppression").select("*").order("created_at", { ascending: false }),
    db.from("crm_options").select("id,name,category"), db.from("crm_stages").select("id,name,kind"), db.from("profiles").select("id,full_name,email"),
  ]);
  const people: Person[] = [
    ...(l.data ?? []).map((x: any) => ({ id: x.id, name: x.customer_name, phone: x.phone, source: "lead" as const, city: x.region ?? "", state: x.region ?? "", source_id: x.source_id, stage_id: x.stage_id, category: x.business_category, assigned_to: x.assigned_to })),
    ...(c.data ?? []).map((x: any) => ({ id: x.id, name: x.name, phone: x.phone, source: "customer" as const, city: x.city, state: x.state })),
  ];
  return { people, suppression: (s.data ?? []) as { id: string; phone: string; reason: string }[], sources: (o.data ?? []).filter((x: any) => x.category === "source"), stages: (st.data ?? []).filter((x: any) => x.kind === "lead"), staff: p.data ?? [] };
}

/** Applies audience rules: filters, valid phone, suppression, de-duplication. */
function resolveAudience(people: Person[], a: Aud, suppressed: Set<string>) {
  const pool = people.filter((p) => a.source === "leads" ? p.source === "lead" : a.source === "customers" ? p.source === "customer" : a.selected.includes(p.id));
  const f = a.filters;
  const matched = pool.filter((p) => (!f["source_id"] || p.source_id === f["source_id"]) && (!f["stage_id"] || p.stage_id === f["stage_id"]) && (!f["assigned_to"] || p.assigned_to === f["assigned_to"])
    && (!f["category"] || (p.category ?? "").toLowerCase().includes(f["category"].toLowerCase())) && (!f["location"] || `${p.city} ${p.state}`.toLowerCase().includes(f["location"].toLowerCase())));
  const seen = new Set<string>(); const eligible: (Person & { norm: string })[] = []; let invalid = 0, supp = 0, dup = 0;
  for (const p of matched) {
    const n = normalizePhone(p.phone || "");
    if (!/^[0-9]{11,15}$/.test(n)) { invalid++; continue; }
    if (suppressed.has(n)) { supp++; continue; }
    if (seen.has(n)) { dup++; continue; }
    seen.add(n); eligible.push({ ...p, norm: n });
  }
  return { matched: matched.length, eligible, invalid, supp, dup };
}

function BroadcastPage() {
  const qc = useQueryClient();
  const { data = [], isFetching, refetch } = useQuery({ queryKey: QK, queryFn: async () => { const r = await db.from("wa_broadcasts").select("*").order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data as B[]; } });
  const aud = useQuery({ queryKey: ["wa-audience"], queryFn: loadAudience });
  const tpls = useQuery({ queryKey: ["wa-templates"], queryFn: async () => { const r = await db.from("whatsapp_templates").select("*").order("name"); if (r.error) throw r.error; return r.data as Tpl[]; } }).data ?? [];
  const waConnected = useQuery({ queryKey: ["integration", "whatsapp"], queryFn: async () => { const r = await db.from("integration_settings").select("status").eq("key", "whatsapp").maybeSingle(); return r.data?.status === "connected"; } }).data ?? false;
  const [banner, setBanner] = useState(true);
  const [tab, setTab] = useState<(typeof tabs)[number]>("all");
  const [q, setQ] = useState("");
  const [kindF, setKindF] = useState("all");
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<B | null>(null);
  const [del, setDel] = useState<B | null>(null);
  const [supp, setSupp] = useState(false);
  const [guide, setGuide] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const count = (t: string) => t === "all" ? data.length : data.filter((b) => b.status === t).length;
  const list = useMemo(() => data.filter((b) => (tab === "all" || b.status === tab) && (kindF === "all" || b.kind === kindF) && (!q || b.name.toLowerCase().includes(q.toLowerCase()))), [data, tab, q, kindF]);
  const sent = data.reduce((s, b) => s + b.sent_count, 0), delivered = data.reduce((s, b) => s + b.delivered_count, 0);
  const refresh = () => qc.invalidateQueries({ queryKey: QK });

  const openNew = () => setForm({ name: "", kind: "manual", event_trigger: "lead_created", template_id: "", template_params: [], audience: { ...blankAud } });
  const openEdit = (b: B) => setForm({ id: b.id, name: b.name, kind: b.kind, event_trigger: b.event_trigger ?? "lead_created", template_id: b.template_id ?? "", template_params: b.template_params ?? [], audience: { ...blankAud, ...b.audience } });

  const saveDraft = async (f: Form) => {
    if (!f.name.trim()) { toast.error("Campaign name is required"); return; }
    if (f.audience.delivery === "later" && f.audience.date && new Date(`${f.audience.date}T${f.audience.time || "00:00"}`) <= new Date()) { toast.error("Scheduled time must be in the future"); return; }
    const sset = new Set((aud.data?.suppression ?? []).map((s) => s.phone));
    const r = resolveAudience(aud.data?.people ?? [], f.audience, sset);
    const payload = { name: f.name.trim().slice(0, 120), kind: f.kind, event_trigger: f.kind === "event" ? f.event_trigger : null, audience: f.audience, template_id: f.template_id || null, template_params: f.template_params,
      scheduled_at: f.audience.delivery === "later" && f.audience.date ? new Date(`${f.audience.date}T${f.audience.time || "00:00"}`).toISOString() : null, recipients_count: r.eligible.length };
    const res = f.id ? await db.from("wa_broadcasts").update(payload).eq("id", f.id).eq("status", "draft").select("id").single() : await db.from("wa_broadcasts").insert(payload).select("id").single();
    if (res.error) { toast.error(res.error.message); return; }
    const id = res.data.id as string;
    await db.from("wa_broadcast_recipients").delete().eq("broadcast_id", id);
    for (let i = 0; i < r.eligible.length; i += 500) {
      const ins = await db.from("wa_broadcast_recipients").insert(r.eligible.slice(i, i + 500).map((p) => ({ broadcast_id: id, phone: p.norm, name: p.name, source: p.source, source_id: p.id })));
      if (ins.error) { toast.error(ins.error.message); return; }
    }
    toast.success(`Draft saved with ${r.eligible.length} eligible recipient(s)`); setForm(null); refresh();
  };
  const duplicate = async (b: B) => { const { error } = await db.from("wa_broadcasts").insert({ name: `${b.name} (copy)`.slice(0, 120), kind: b.kind, event_trigger: b.event_trigger, audience: b.audience, template_id: b.template_id, template_params: b.template_params, recipients_count: 0 }); if (error) { toast.error(error.message); return; } toast.success("Duplicated as draft — open it and save to rebuild the audience"); refresh(); };
  const cancel = async (b: B) => { const { error } = await db.from("wa_broadcasts").update({ status: "cancelled" }).eq("id", b.id); if (error) { toast.error(error.message); return; } toast.success("Campaign cancelled"); refresh(); };
  const remove = async () => { if (!del) return; const { error } = await db.from("wa_broadcasts").delete().eq("id", del.id).eq("status", "draft"); if (error) { toast.error(error.message); return; } toast.success("Draft deleted"); setDel(null); refresh(); };
  const tone = (s: string) => s === "completed" ? "green" : s === "processing" ? "blue" : s === "scheduled" ? "orange" : s === "cancelled" ? "red" : "gray";

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["WhatsApp"]} label="Broadcast" />
      <PageHeader title={`WhatsApp Broadcast (${data.length})`} subtitle="Manage and track your bulk messaging campaigns."><ToolbarButton primary onClick={openNew}><Megaphone className="size-4" />New Campaign</ToolbarButton></PageHeader>
      {banner && <div className="relative flex gap-4 rounded-xl border border-admin-blue/30 bg-admin-blue/5 p-5">
        <Info className="mt-0.5 size-6 shrink-0 fill-admin-blue text-primary-foreground" />
        <div><p className="text-lg">WhatsApp Broadcast Analytics</p><p className="text-muted-foreground">Monitor your bulk messaging performance and engagement metrics. {waConnected ? "" : "Delivery numbers appear once WhatsApp Business is connected and Meta confirms each message."}</p></div>
        <button aria-label="Dismiss" onClick={() => setBanner(false)} className="absolute right-4 top-4"><X className="size-4" /></button></div>}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <MiniKpi icon={Megaphone} tone="purple" label="TOTAL CAMPAIGNS" value={data.length} />
        <MiniKpi icon={RefreshCw} tone="green" label="LIVE NOW" value={count("processing")} />
        <MiniKpi icon={MessageCircleMore} tone="purple" label="MESSAGES SENT" value={sent} />
        <MiniKpi icon={CheckCircle2} tone="blue" label="DELIVERY RATE" value={`${deliveryRate(sent, delivered)}%`} />
        <MiniKpi icon={CalendarClock} tone="orange" label="SCHEDULED" value={count("scheduled")} />
      </div>
      <Card className="p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-bold">Campaign Management</h2><p className="text-muted-foreground">View and manage all your broadcast activities.</p></div>
          <div className="flex flex-wrap gap-2"><SearchInput placeholder="Search campaigns..." value={q} onChange={setQ} className="w-64" />
            <ToolbarButton onClick={() => setShowFilter(!showFilter)}><Filter className="size-4" />Filter</ToolbarButton>
            <ToolbarButton onClick={() => setSupp(true)}><Ban className="size-4" />Suppression List</ToolbarButton>
            <ToolbarButton onClick={() => setGuide(true)}><HelpCircle className="size-4" />Guide</ToolbarButton>
            <ToolbarButton onClick={() => refetch()} aria-label="Refresh"><RefreshCw className={cn("size-4", isFetching && "animate-spin")} /></ToolbarButton></div>
        </div>
        {showFilter && <div className="mt-3 flex gap-2"><select className="inp w-48" value={kindF} onChange={(e) => setKindF(e.target.value)}><option value="all">All types</option><option value="manual">Manual</option><option value="event">Event</option></select></div>}
        <div className="mt-5 flex gap-10 border-b">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 pb-3 text-lg capitalize", tab === t ? "border-admin-blue font-semibold text-admin-blue" : "border-transparent text-muted-foreground")}>{t} ({count(t)})</button>)}</div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[15px]">
            <thead><tr className="bg-muted/60">{["Campaign Name", "Status", "Progress", "Analytics", "Delivery Rate", "Broadcast Time", "Created At", "Actions"].map((c) => <th key={c} className="px-4 py-4 font-semibold">{c}</th>)}</tr></thead>
            <tbody className="divide-y">{list.map((b) => { const done = b.sent_count + b.failed_count; const pct = b.recipients_count ? Math.round((done / b.recipients_count) * 100) : 0;
              return <tr key={b.id} className="hover:bg-muted/40">
                <td className="px-4 py-4"><p className="font-semibold">{b.name}</p><p className="text-xs text-muted-foreground">{b.kind === "event" ? `Event · ${triggerLabel(b.event_trigger ?? "")}` : "Manual"}</p></td>
                <td className="px-4 py-4"><StatusBadge tone={tone(b.status)}>{b.status.toUpperCase()}</StatusBadge></td>
                <td className="px-4 py-4"><div className="h-2 w-32 rounded bg-muted"><div className="h-2 rounded bg-admin-blue" style={{ width: `${pct}%` }} /></div><p className="text-xs text-muted-foreground">{done}/{b.recipients_count}</p></td>
                <td className="px-4 py-4 text-xs">Sent {b.sent_count} · Delivered {b.delivered_count} · Read {b.read_count} · Failed {b.failed_count}</td>
                <td className="px-4 py-4">{deliveryRate(b.sent_count, b.delivered_count)}%</td>
                <td className="px-4 py-4 text-sm">{b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : b.audience?.delivery === "now" ? "Immediately on launch" : "—"}</td>
                <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-4"><DropdownMenu><DropdownMenuTrigger aria-label={`Actions for ${b.name}`} className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setView(b)}><Eye className="size-4" />View / Analytics</DropdownMenuItem>
                    {b.status === "draft" && <DropdownMenuItem onClick={() => openEdit(b)}><Pencil className="size-4" />Edit Draft</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => duplicate(b)}><Copy className="size-4" />Duplicate</DropdownMenuItem>
                    {b.status === "scheduled" && <DropdownMenuItem onClick={() => cancel(b)}><XCircle className="size-4" />Cancel</DropdownMenuItem>}
                    {b.status === "draft" && <DropdownMenuItem onClick={() => setDel(b)} className="text-admin-red"><Trash2 className="size-4" />Delete Draft</DropdownMenuItem>}
                  </DropdownMenuContent></DropdownMenu></td>
              </tr>; })}</tbody>
          </table>
          {list.length === 0 && <div className="flex flex-col items-center gap-3 bg-muted/30 py-24 text-muted-foreground"><Inbox className="size-14 text-border" strokeWidth={1.2} />No data</div>}
        </div>
      </Card>

      {form && aud.data && <Wizard initial={form} people={aud.data.people} suppression={aud.data.suppression} sources={aud.data.sources} stages={aud.data.stages} staff={aud.data.staff} templates={tpls} connected={waConnected} onClose={() => setForm(null)} onSave={saveDraft} />}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{view?.name}</DialogTitle></DialogHeader>
          {view && <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
            {([["Status", view.status], ["Type", view.kind === "event" ? `Event — ${triggerLabel(view.event_trigger ?? "")}` : "Manual"], ["Template", tpls.find((t) => t.id === view.template_id)?.name ?? "—"], ["Eligible recipients", view.recipients_count], ["Sent (confirmed)", view.sent_count], ["Delivered", view.delivered_count], ["Read", view.read_count], ["Failed", view.failed_count], ["Delivery rate", `${deliveryRate(view.sent_count, view.delivered_count)}%`], ["Schedule", view.scheduled_at ? new Date(view.scheduled_at).toLocaleString() : "Immediately on launch"]] as const).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>)}
            <p className="col-span-2 mt-2 text-xs text-muted-foreground">Delivery figures only change when Meta confirms each message.</p></dl>}
        </DialogContent></Dialog>
      <SuppressionDialog open={supp} onClose={() => setSupp(false)} list={aud.data?.suppression ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["wa-audience"] })} />
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Broadcast guide</DialogTitle></DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm"><li>Only send to people who agreed to receive WhatsApp messages from you.</li><li>Business-initiated messages must use a Meta-approved template.</li><li>Numbers on the Suppression List and invalid or duplicate numbers are removed automatically.</li><li>Drafts can be saved any time. Scheduling and sending unlock once WhatsApp Business is connected in Integrations.</li></ul>
        </DialogContent></Dialog>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete draft “{del?.name}”?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function Wizard({ initial, people, suppression, sources, stages, staff, templates, connected, onClose, onSave }: {
  initial: Form; people: Person[]; suppression: { phone: string }[]; sources: any[]; stages: any[]; staff: any[]; templates: Tpl[]; connected: boolean; onClose: () => void; onSave: (f: Form) => void;
}) {
  const [f, setF] = useState<Form>(initial);
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState("");
  const a = f.audience;
  const setA = (p: Partial<Aud>) => setF({ ...f, audience: { ...a, ...p } });
  const setFilter = (k: string, v: string) => setA({ filters: { ...a.filters, [k]: v } });
  const r = useMemo(() => resolveAudience(people, a, new Set(suppression.map((s) => s.phone))), [people, a, suppression]);
  const tpl = templates.find((t) => t.id === f.template_id);
  const vars = tpl ? Array.from(new Set(tpl.body.match(/\{\{\d+\}\}/g) ?? [])) : [];
  const steps = [{ l: "Audience", i: UserRoundPlus }, { l: "Audience Filter", i: UsersRound }, { l: "Message Template", i: FileText }, { l: "Review", i: CheckCircle2 }];
  const next = () => {
    if (step === 0) { if (!f.name.trim()) { toast.error("Campaign name is required"); return; }
      if (a.delivery === "later" && (!a.date || new Date(`${a.date}T${a.time || "00:00"}`) <= new Date())) { toast.error("Pick a future date and time"); return; } }
    if (step === 2 && !f.template_id) { toast.error("Select a template"); return; }
    setStep(step + 1);
  };
  const launchHint = !connected ? "WhatsApp Business isn't connected yet — set it up in Integrations to schedule or send." : tpl?.status !== "APPROVED" ? "Only Meta-approved templates can be sent." : "";
  const pickList = people.filter((p) => !pick || `${p.name} ${p.phone}`.toLowerCase().includes(pick.toLowerCase())).slice(0, 50);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-hidden p-0 [&>button]:hidden">
        <div className="flex items-center gap-4 bg-admin-blue px-8 py-6 text-primary-foreground">
          <span className="grid size-14 place-items-center rounded-lg bg-primary-foreground/20"><Megaphone className="size-7" /></span>
          <div className="flex-1"><DialogTitle className="text-2xl font-bold">Create WhatsApp Broadcast</DialogTitle><p className="opacity-90">Create and manage your WhatsApp campaigns.</p></div>
          <button aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-md bg-primary-foreground/20"><X className="size-5" /></button>
        </div>
        <div className="max-h-[calc(92vh-120px)] overflow-y-auto px-8 py-6">
          <div className="mb-6 flex items-center gap-3">{steps.map((s, i) => <div key={s.l} className="flex flex-1 items-center gap-2"><s.i className={cn("size-6", i <= step ? "text-admin-blue" : "text-muted-foreground")} /><span className={cn("whitespace-nowrap text-lg", i === step ? "text-foreground" : "text-muted-foreground")}>{s.l}</span>{i < 3 && <span className="h-px flex-1 bg-border" />}</div>)}</div>

          {step === 0 && <div className="space-y-5">
            <label className="grid gap-2 font-medium"><span><span className="text-admin-red">* </span>Campaign Name</span><input className="inp h-14 text-base" placeholder="e.g. Diwali Offer 2026" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <div><p className="mb-2 font-medium"><span className="text-admin-red">* </span>Select Broadcast Type</p>
              <div className="grid grid-cols-2 gap-4">{([["manual", "Manual", "Once now or later.", Send], ["event", "Event", "Auto based on actions.", Zap]] as const).map(([k, l, d, I]) =>
                <button key={k} onClick={() => setF({ ...f, kind: k })} className={cn("flex flex-col items-center gap-2 rounded-xl border-2 p-6", f.kind === k ? "border-admin-blue bg-admin-blue/5" : "border-border")}>
                  <span className={cn("grid size-12 place-items-center rounded-lg", f.kind === k ? "bg-admin-blue text-primary-foreground" : "bg-muted text-muted-foreground")}><I className="size-6" /></span>
                  <span className={cn("text-lg font-semibold", f.kind === k && "text-admin-blue")}>{l}</span><span className="text-sm text-muted-foreground">{d}</span></button>)}</div></div>
            <div className="flex gap-4 rounded-xl border border-admin-blue/30 bg-admin-blue/5 p-6"><Info className="size-6 shrink-0 fill-admin-blue text-primary-foreground" />
              <div><p className="text-xl">{f.kind === "manual" ? "Manual Campaign" : "Event Campaign"}</p><p className="mt-1">{f.kind === "manual" ? "This campaign will be sent once to the group of people you select in the next step. You can send it immediately or pick a future time." : "This campaign sends automatically to each matching contact when the selected CRM event happens."}</p></div></div>
            {f.kind === "event" && <label className="grid gap-1 font-medium">Event trigger<select className="inp" value={f.event_trigger} onChange={(e) => setF({ ...f, event_trigger: e.target.value })}>{WF_TRIGGERS.filter((t) => t.id !== "manual").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
            {f.kind === "manual" && <div className="rounded-xl border bg-admin-blue/[0.02] p-5"><p className="text-lg font-semibold text-admin-blue">Schedule Configuration</p>
              <label className="mt-4 grid gap-2 font-medium">Delivery Time<select className="inp h-12" value={a.delivery} onChange={(e) => setA({ delivery: e.target.value as Aud["delivery"] })}><option value="now">Send Immediately</option><option value="later">Schedule for Later</option></select></label>
              {a.delivery === "later" && <div className="mt-3 grid grid-cols-3 gap-3"><input aria-label="Date" type="date" className="inp" value={a.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setA({ date: e.target.value })} /><input aria-label="Time" type="time" className="inp" value={a.time} onChange={(e) => setA({ time: e.target.value })} />
                <select aria-label="Timezone" className="inp" value={a.tz} onChange={(e) => setA({ tz: e.target.value })}>{["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London", "America/New_York"].map((z) => <option key={z}>{z}</option>)}</select></div>}
              <p className="mt-4 flex items-center gap-2 rounded-md border border-admin-green/40 bg-admin-green/10 px-4 py-3 text-sm text-success"><CheckCircle2 className="size-4" />{a.delivery === "now" ? "Campaign will start sending immediately after launch." : "Campaign will start at the scheduled time after launch."}</p></div>}
          </div>}

          {step === 1 && <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">{([["leads", "CRM Leads"], ["customers", "Sales Customers"], ["selected", "Selected Contacts"]] as const).map(([k, l]) =>
              <button key={k} onClick={() => setA({ source: k })} className={cn("rounded-lg border-2 p-4 font-semibold", a.source === k ? "border-admin-blue text-admin-blue" : "")}>{l}</button>)}</div>
            {a.source === "leads" && <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <select aria-label="Lead source" className="inp" value={a.filters["source_id"] ?? ""} onChange={(e) => setFilter("source_id", e.target.value)}><option value="">Any lead source</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select aria-label="Lead stage" className="inp" value={a.filters["stage_id"] ?? ""} onChange={(e) => setFilter("stage_id", e.target.value)}><option value="">Any stage</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select aria-label="Assigned employee" className="inp" value={a.filters["assigned_to"] ?? ""} onChange={(e) => setFilter("assigned_to", e.target.value)}><option value="">Any employee</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select>
              <input className="inp" placeholder="Business category" value={a.filters["category"] ?? ""} onChange={(e) => setFilter("category", e.target.value)} />
            </div>}
            {a.source !== "selected" && <input className="inp" placeholder="City / State" value={a.filters["location"] ?? ""} onChange={(e) => setFilter("location", e.target.value)} />}
            {a.source === "selected" && <div className="rounded-lg border"><div className="flex gap-2 border-b p-2"><input className="inp" placeholder="Search contacts…" value={pick} onChange={(e) => setPick(e.target.value)} />
              <ToolbarButton onClick={() => setA({ selected: Array.from(new Set([...a.selected, ...pickList.map((p) => p.id)])) })}>Select all</ToolbarButton><ToolbarButton onClick={() => setA({ selected: [] })}>Clear</ToolbarButton></div>
              <div className="max-h-60 overflow-y-auto">{pickList.map((p) => <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"><input type="checkbox" className="size-4 accent-admin-blue" checked={a.selected.includes(p.id)} onChange={(e) => setA({ selected: e.target.checked ? [...a.selected, p.id] : a.selected.filter((x) => x !== p.id) })} />{p.name}<span className="text-muted-foreground">{p.phone || "no phone"} · {p.source}</span></label>)}
                {pickList.length === 0 && <p className="p-4 text-sm text-muted-foreground">No contacts found.</p>}</div></div>}
            <div className="grid grid-cols-4 gap-3 text-center">{([["Matched", r.matched], ["Eligible", r.eligible.length], ["Excluded (suppressed)", r.supp], ["Excluded (invalid / duplicate)", r.invalid + r.dup]] as const).map(([l, v]) => <div key={l} className="rounded-lg border p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}</div>
            <p className="text-xs text-muted-foreground">Opt-in consent isn't recorded in the CRM yet. Only include people who agreed to receive WhatsApp messages from you.</p>
          </div>}

          {step === 2 && <div className="grid gap-4 md:grid-cols-2">
            <div className="max-h-96 space-y-2 overflow-y-auto">{templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet. Create one in Message Templates.</p>}
              {templates.map((t) => <button key={t.id} onClick={() => setF({ ...f, template_id: t.id, template_params: [] })} className={cn("w-full rounded-lg border-2 p-3 text-left", f.template_id === t.id ? "border-admin-blue" : "")}>
                <p className="font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.category} · {t.language} · <span className={t.status === "APPROVED" ? "text-success" : "text-warning"}>{t.status === "APPROVED" ? "Approved" : "Not approved by Meta"}</span></p></button>)}</div>
            {tpl && <div className="space-y-3"><div className="rounded-xl bg-admin-green/10 p-4"><div className="rounded-lg bg-card p-3 shadow-card">{tpl.header && <p className="font-bold">{tpl.header}</p>}<p className="whitespace-pre-wrap text-sm">{tpl.body.replace(/\{\{(\d+)\}\}/g, (m, n) => f.template_params[Number(n) - 1] || m)}</p>{tpl.footer && <p className="mt-1 text-xs text-muted-foreground">{tpl.footer}</p>}</div></div>
              {vars.map((v, i) => <input key={v} className="inp" placeholder={`Value for ${v}`} value={f.template_params[i] ?? ""} onChange={(e) => { const p = [...f.template_params]; p[i] = e.target.value; setF({ ...f, template_params: p }); }} />)}</div>}
          </div>}

          {step === 3 && <div className="space-y-3"><dl className="grid grid-cols-[200px_1fr] gap-y-2 rounded-xl border p-5">
            {([["Campaign name", f.name], ["Broadcast type", f.kind === "manual" ? "Manual" : `Event — ${triggerLabel(f.event_trigger)}`], ["Eligible recipients", r.eligible.length], ["Exclusions", `${r.supp} suppressed · ${r.invalid} invalid · ${r.dup} duplicate`], ["Template", tpl?.name ?? "—"], ["Schedule", f.kind === "event" ? "On each event" : a.delivery === "now" ? "Immediately on launch" : `${a.date} ${a.time} (${a.tz})`], ["Estimated messages", r.eligible.length]] as const).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>)}</dl>
            {launchHint && <p className="rounded-md bg-admin-orange/10 p-3 text-sm text-warning">{launchHint}</p>}</div>}

          <div className="mt-6 flex justify-end gap-2">
            {step > 0 && <ToolbarButton onClick={() => setStep(step - 1)}>Back</ToolbarButton>}
            {step === 3 ? <>
              <ToolbarButton onClick={() => onSave(f)}>Save Draft</ToolbarButton>
              <span title={launchHint || undefined}><ToolbarButton primary className={cn(launchHint && "pointer-events-none opacity-50")}>{f.kind === "manual" && a.delivery === "later" ? "Schedule" : "Send Now"}</ToolbarButton></span>
            </> : <ToolbarButton primary onClick={next} className="px-6">Next</ToolbarButton>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SuppressionDialog({ open, onClose, list, onChange }: { open: boolean; onClose: () => void; list: { id: string; phone: string; reason: string }[]; onChange: () => void }) {
  const [phone, setPhone] = useState(""); const [reason, setReason] = useState("");
  const add = async () => {
    const n = normalizePhone(phone);
    if (!/^[0-9]{11,15}$/.test(n)) { toast.error("Enter a valid phone number"); return; }
    const { error } = await db.from("wa_suppression").insert({ phone: n, reason: reason.trim().slice(0, 200) });
    if (error) { toast.error(error.message.includes("duplicate") ? "Already suppressed" : error.message); return; }
    setPhone(""); setReason(""); onChange(); toast.success("Number suppressed");
  };
  const rm = async (id: string) => { await db.from("wa_suppression").delete().eq("id", id); onChange(); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Suppression List</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">These numbers never receive broadcasts (opt-outs, complaints, do-not-contact).</p>
        <div className="flex gap-2"><input className="inp" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} /><input className="inp" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /><ToolbarButton primary onClick={add}>Add</ToolbarButton></div>
        <ul className="max-h-72 divide-y overflow-y-auto">{list.map((s) => <li key={s.id} className="flex items-center justify-between py-2 text-sm"><span>+{s.phone} <span className="text-muted-foreground">{s.reason}</span></span><button aria-label="Remove" onClick={() => rm(s.id)}><Trash2 className="size-4 text-admin-red" /></button></li>)}
          {list.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No suppressed numbers.</li>}</ul>
      </DialogContent>
    </Dialog>
  );
}
