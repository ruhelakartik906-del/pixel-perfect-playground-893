import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Facebook, Globe, Home, Mail, MessageCircle, Search, ShoppingCart, SlidersHorizontal, Video, Webhook, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, PageHeader, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminHead } from "@/lib/admin-head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => adminHead("Integrations Cockpit", "Manage and connect lead capture, communication and scheduling systems."),
  component: Cockpit,
});

const db = supabase as unknown as { from: (t: string) => any };
type Cat = "leads" | "communication" | "video";
type Field = { k: string; l: string; ph?: string };
type P = { key: string; name: string; icon: LucideIcon; color: string; cat: Cat; desc: string; comingSoon?: boolean; fields?: Field[]; note: string };

/** Only non-secret settings are stored here. API keys/tokens are never collected in this form. */
const providers: P[] = [
  { key: "99acres", name: "99acres", icon: Home, color: "bg-admin-blue", cat: "leads", desc: "Capture and parse real estate leads from your incoming 99acres inquiry emails.", fields: [{ k: "inquiry_email", l: "Inquiry forwarding email", ph: "leads@yourcompany.com" }, { k: "default_source", l: "Lead source label", ph: "99acres" }], note: "Email parsing is not active yet. Saved settings will be used once inbox syncing is switched on." },
  { key: "email", name: "Email SMTP & IMAP", icon: Mail, color: "bg-admin-blue", cat: "communication", desc: "Configure SMTP and IMAP connections for Gmail, Outlook, Yahoo, Zoho or any custom mail server.", note: "Uses your secure Mail settings." },
  { key: "justdial", name: "Justdial", icon: Globe, color: "bg-admin-orange", cat: "leads", desc: "Connect your Justdial lead campaigns to ingest leads into your pipeline.", fields: [{ k: "account_name", l: "Justdial account / listing name" }, { k: "contact_email", l: "Lead notification email" }], note: "Justdial lead push requires their API access, which isn't connected yet." },
  { key: "indiamart", name: "IndiaMART", icon: ShoppingCart, color: "bg-admin-orange", cat: "leads", desc: "Sync your IndiaMART seller panel lead manager to capture buying inquiries.", comingSoon: true, note: "" },
  { key: "tradeindia", name: "TradeIndia", icon: Globe, color: "bg-admin-blue", cat: "leads", desc: "Sync buyer inquiries and product requirements from the TradeIndia Seller Portal.", fields: [{ k: "seller_id", l: "Seller profile ID" }], note: "TradeIndia sync is not active yet." },
  { key: "meta_ads", name: "Meta Ads", icon: Facebook, color: "bg-admin-blue", cat: "leads", desc: "Route Facebook & Instagram Lead Ads into your lead pipelines.", fields: [{ k: "business_name", l: "Meta Business name" }, { k: "page_name", l: "Facebook Page" }, { k: "lead_source", l: "CRM lead source label", ph: "Meta Ads" }], note: "Meta Ads → Make.com → Lead Routing is not live yet. These details prepare the setup; no account is connected." },
  { key: "make", name: "Make.com / Pabbly", icon: Webhook, color: "bg-admin-purple", cat: "leads", desc: "Receive leads from Make.com or Pabbly scenarios through a secure webhook.", fields: [{ k: "scenario_name", l: "Scenario / workflow name" }, { k: "mapping", l: "Payload mapping (e.g. full_name→customer_name, phone→phone)" }], note: "The incoming lead webhook isn't built yet, so tests and delivery logs aren't available." },
  { key: "google_ads", name: "Google Ads", icon: Search, color: "bg-admin-red", cat: "leads", desc: "Sync your campaigns & lead forms and capture leads into the CRM.", fields: [{ k: "customer_id", l: "Google Ads customer ID", ph: "123-456-7890" }], note: "Google Ads lead sync is not active yet." },
  { key: "whatsapp", name: "WhatsApp Business API", icon: MessageCircle, color: "bg-admin-green", cat: "communication", desc: "Configure Meta WhatsApp Business accounts to chat, broadcast and automate.", fields: [{ k: "business_account", l: "Meta Business Account name" }, { k: "phone_display", l: "WhatsApp business phone number" }], note: "Not connected. Live messaging needs the WhatsApp Business connection; template sync and test connection unlock after that." },
  { key: "google_meet", name: "Google Meet", icon: Video, color: "bg-admin-green", cat: "video", desc: "Create meeting links for scheduled calls with leads.", comingSoon: true, note: "" },
  { key: "zoom", name: "Zoom", icon: Video, color: "bg-admin-blue", cat: "video", desc: "Schedule Zoom meetings from lead and deal pages.", comingSoon: true, note: "" },
];
const tabs: { id: "all" | Cat; l: string }[] = [{ id: "all", l: "All Integrations" }, { id: "leads", l: "Lead Capture & Portals" }, { id: "communication", l: "Communication Channels" }, { id: "video", l: "Video Meetings" }];
const catLabel: Record<Cat, [string, string]> = { leads: ["LEADS", "bg-admin-purple/10 text-admin-purple"], communication: ["COMMUNICATION", "bg-admin-orange/15 text-warning"], video: ["MEETINGS", "bg-admin-green/15 text-success"] };
const badge: Record<string, [string, string]> = { setup_needed: ["Setup Needed", "bg-admin-blue/10 text-admin-blue"], pending: ["Saved · Not Verified", "bg-admin-orange/15 text-warning"], connected: ["Connected", "bg-admin-green/15 text-success"], error: ["Error", "bg-admin-red/10 text-admin-red"], disabled: ["Disabled", "bg-muted text-muted-foreground"], soon: ["Coming Soon", "bg-muted text-muted-foreground"] };

function Cockpit() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["integration-settings"], queryFn: async () => { const r = await db.from("integration_settings").select("*"); if (r.error) throw r.error; return r.data as { key: string; status: string; config: Record<string, string> }[]; } }).data ?? [];
  const mailbox = useQuery({ queryKey: ["mailbox"], queryFn: async () => (await db.from("mailbox_settings").select("has_password").maybeSingle()).data }).data;
  const [tab, setTab] = useState<"all" | Cat>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<P | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const status = (p: P) => p.comingSoon ? "soon" : p.key === "email" ? (mailbox?.has_password ? "pending" : "setup_needed") : settings.find((s) => s.key === p.key)?.status ?? "setup_needed";
  const list = useMemo(() => providers.filter((p) => (tab === "all" || p.cat === tab) && (!q || `${p.name} ${p.desc}`.toLowerCase().includes(q.toLowerCase()))), [tab, q]);
  const openSetup = (p: P) => { setOpen(p); setCfg(settings.find((s) => s.key === p.key)?.config ?? {}); };
  const save = async (disable = false) => {
    if (!open) return;
    const clean = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v).trim().slice(0, 300)]));
    if (!disable && Object.values(clean).every((v) => !v)) { toast.error("Fill in at least one field"); return; }
    const { error } = await db.from("integration_settings").upsert({ key: open.key, status: disable ? "disabled" : "pending", config: clean, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success(disable ? "Integration disabled" : "Settings saved — not connected yet"); setOpen(null); qc.invalidateQueries({ queryKey: ["integration-settings"] });
  };

  return (
    <div className="space-y-5">
      <Breadcrumb label="Integrations" />
      <PageHeader title="Integrations Cockpit" subtitle="Manage and connect lead capture, communication and scheduling systems." />
      <Card className="flex flex-wrap items-center gap-8 px-6 py-4">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={cn("-mb-4 border-b-2 pb-4 text-lg", tab === t.id ? "border-admin-blue font-semibold text-admin-blue" : "border-transparent")}>{t.l}</button>)}
        <label className="ml-auto flex h-11 w-80 items-center gap-2 rounded-md border px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations..." className="w-full bg-transparent outline-none" /></label>
      </Card>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => { const s = status(p); const [bl, bc] = badge[s] ?? badge["setup_needed"]!; const [cl, cc] = catLabel[p.cat];
          return <Card key={p.key} className="flex flex-col p-8">
            <div className="flex items-center gap-3"><span className={cn("grid size-12 place-items-center rounded-full text-primary-foreground", p.color)}><p.icon className="size-6" /></span><h3 className="flex-1 truncate text-xl font-semibold">{p.name}</h3><span className={cn("rounded px-2.5 py-1 text-sm font-medium", bc)}>{bl}</span></div>
            <p className="mt-4 line-clamp-2 flex-1 text-muted-foreground">{p.desc}</p>
            <div className="mt-5 flex items-center justify-between"><span className={cn("rounded px-2 py-1 text-xs font-bold", cc)}>{cl}</span>
              {p.comingSoon ? <ToolbarButton onClick={() => toast.info(`${p.name} integration is coming soon.`)}>Learn More</ToolbarButton>
                : p.key === "email" ? <Link to="/admin/communication/mail" className="inline-flex h-10 items-center gap-2 rounded-md bg-admin-blue px-4 font-semibold text-primary-foreground"><ArrowRight className="size-4" />{s === "setup_needed" ? "Setup Now" : "Manage Setup"}</Link>
                : s === "setup_needed" ? <ToolbarButton primary onClick={() => openSetup(p)}><ArrowRight className="size-4" />Setup Now</ToolbarButton>
                : <ToolbarButton onClick={() => openSetup(p)}><SlidersHorizontal className="size-4" />Manage Setup</ToolbarButton>}</div>
          </Card>; })}
        {list.length === 0 && <p className="col-span-full py-10 text-center text-muted-foreground">No integrations match your search.</p>}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="size-5" />{open?.name} setup</DialogTitle></DialogHeader>
          {open && <div className="space-y-3">
            <p className="rounded-md bg-admin-orange/10 p-3 text-sm text-warning">{open.note}</p>
            {open.fields?.map((f) => <label key={f.k} className="grid gap-1 text-sm font-medium">{f.l}<input className="inp" placeholder={f.ph} value={cfg[f.k] ?? ""} onChange={(e) => setCfg({ ...cfg, [f.k]: e.target.value })} /></label>)}
            <p className="text-xs text-muted-foreground">Status: <b>{badge[status(open)]?.[0]}</b>. API keys and access tokens are never entered here — they're added through a secure server-side connection when the integration goes live.</p>
            <div className="flex justify-between gap-2"><ToolbarButton onClick={() => save(true)}>Disable</ToolbarButton>
              <div className="flex gap-2"><span title="Available once the provider is connected"><ToolbarButton className="pointer-events-none opacity-50">Test Connection</ToolbarButton></span><ToolbarButton primary onClick={() => save()}>Save settings</ToolbarButton></div></div>
          </div>}
        </DialogContent></Dialog>
    </div>
  );
}
