import { useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarClock, Columns3, Eye, FileText, Handshake, History, ListTodo,
  MessageCircle, MoreVertical, Pencil, Phone, PhoneCall, Plus, Settings2, StickyNote, Trash2, Trophy, Users,
  MessagesSquare, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Source record shown read-only. Stage movement in this phase is local prototype state only. */
export type PipelineSource = {
  id: string; name: string; phone: string; email: string; source: string; assignee: string; assigneeId: string | null;
  company: string; companyId: string | null; created: string; priority: string;
};

export const STAGES = [
  { name: "All Leads", icon: Users, tone: "bg-admin-blue/10 text-admin-blue" },
  { name: "Contacted", icon: PhoneCall, tone: "bg-admin-purple/10 text-admin-purple" },
  { name: "Interested", icon: Sparkles, tone: "bg-admin-orange/15 text-warning" },
  { name: "Follow-up", icon: CalendarClock, tone: "bg-admin-pink/10 text-admin-pink" },
  { name: "Negotiation", icon: Handshake, tone: "bg-admin-blue/10 text-admin-blue" },
  { name: "Deal Closed", icon: Trophy, tone: "bg-admin-green/15 text-success" },
] as const;
const CLOSED = STAGES.length - 1;

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  eye: Eye, note: StickyNote, phone: Phone, whatsapp: MessageCircle, next: ArrowRight, move: Settings2,
  tasks: ListTodo, followups: CalendarClock, deals: Handshake, proposals: FileText, history: History, edit: Pencil, chat: MessagesSquare,
};
export const ACTION_TYPES = [
  { id: "details", label: "Open Client Details" }, { id: "note", label: "Add Note" }, { id: "call", label: "Call Phone Number" },
  { id: "whatsapp", label: "Open WhatsApp" }, { id: "next", label: "Move to Next Stage" }, { id: "move", label: "Move to Selected Stage" },
  { id: "tasks", label: "Open Existing Tasks Page" }, { id: "followups", label: "Open Existing Follow-ups Page" },
  { id: "deals", label: "Open Existing Deals Page" }, { id: "proposals", label: "Open Existing Proposals Page" },
] as const;
type ActionType = (typeof ACTION_TYPES)[number]["id"];
type MenuItem = { id: string; label: string; icon: string; type: ActionType; enabled: boolean; custom?: boolean };
type Row = PipelineSource & { stage: number; outcome?: "won" | "lost" | undefined; notes: { text: string; at: string }[]; history: { stage: number; at: string }[] };

const uid = () => Math.random().toString(36).slice(2, 10);
function defaultMenu(stage: number): MenuItem[] {
  const base: MenuItem[] = [
    { id: uid(), label: "View Client", icon: "eye", type: "details", enabled: true },
    { id: uid(), label: "Add Note", icon: "note", type: "note", enabled: true },
    { id: uid(), label: "Call", icon: "phone", type: "call", enabled: true },
  ];
  if (stage < CLOSED) base.push({ id: uid(), label: "Move to Next Stage", icon: "next", type: "next", enabled: true });
  base.push({ id: uid(), label: "Move to Another Stage", icon: "move", type: "move", enabled: true });
  if (stage === 3) base.push({ id: uid(), label: "Open Follow-ups", icon: "followups", type: "followups", enabled: true });
  if (stage >= 4) base.push({ id: uid(), label: "Open Deals", icon: "deals", type: "deals", enabled: true });
  if (stage === 4) base.push({ id: uid(), label: "Open Proposals", icon: "proposals", type: "proposals", enabled: true });
  return base;
}
const ALL_COLUMNS = ["Client Name", "Phone Number", "Email", "Lead Source", "Assigned To", "Last Note", "Priority", "Next Follow-up", "Created Date"] as const;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const PAGE = 10;
const selectCls = "h-10 rounded-md border bg-card px-3 text-sm";

export function PipelineBoard({ records, admin }: { records: PipelineSource[]; admin?: boolean }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>(() => records.map((r) => ({ ...r, stage: 0, notes: [], history: [{ stage: 0, at: r.created }] })));
  const [menus, setMenus] = useState<MenuItem[][]>(() => STAGES.map((_, i) => defaultMenu(i)));
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState(""), [priority, setPriority] = useState(""), [source, setSource] = useState("");
  const [company, setCompany] = useState(""), [employee, setEmployee] = useState("");
  const [hidden, setHidden] = useState<string[]>([]), [page, setPage] = useState(0);
  const [detail, setDetail] = useState<string | null>(null), [noteFor, setNoteFor] = useState<string | null>(null), [noteText, setNoteText] = useState("");
  const [moveFor, setMoveFor] = useState<string | null>(null), [moveTo, setMoveTo] = useState(0);
  const [closeFor, setCloseFor] = useState<{ id: string; from: number } | null>(null), [outcome, setOutcome] = useState<"won" | "lost">("won");
  const [manage, setManage] = useState<number | null>(null);

  const counts = STAGES.map((_, i) => rows.filter((r) => r.stage === i).length);
  const opt = (k: keyof PipelineSource) => [...new Set(records.map((r) => String(r[k])).filter((v) => v && v !== "—"))].sort();
  const filtered = useMemo(() => open === null ? [] : rows.filter((r) => r.stage === open
    && (!search || [r.name, r.phone, r.email].some((v) => v.toLowerCase().includes(search.toLowerCase())))
    && (!priority || r.priority === priority) && (!source || r.source === source)
    && (!company || r.company === company) && (!employee || r.assignee === employee)), [rows, open, search, priority, source, company, employee]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE)), cur = Math.min(page, pages - 1);
  const visible = filtered.slice(cur * PAGE, cur * PAGE + PAGE);
  const cols = ALL_COLUMNS.filter((c) => !hidden.includes(c));
  const detailRow = rows.find((r) => r.id === detail);

  const place = (id: string, stage: number, out?: "won" | "lost") => setRows((rs) => rs.map((r) => r.id !== id ? r : {
    ...r, stage, outcome: stage === CLOSED ? out : undefined, history: r.stage === stage ? r.history : [...r.history, { stage, at: new Date().toISOString() }],
  }));
  const move = (id: string, stage: number) => {
    const row = rows.find((r) => r.id === id); if (!row || row.stage === stage) return;
    if (stage === CLOSED) { setOutcome("won"); setCloseFor({ id, from: row.stage }); return; }
    const from = row.stage; place(id, stage);
    toast.success(`${row.name} moved to ${STAGES[stage]!.name}`, { description: "Prototype only — not saved to the CRM.", action: { label: "Undo", onClick: () => place(id, from) } });
  };
  const goPage = (t: ActionType) => {
    const map = { tasks: ["/tasks", "crm/tasks"], followups: ["/follow-ups", "crm/follow-ups"], deals: ["/deals", "crm/deals"], proposals: ["/proposals", "sales/proposals"] } as const;
    const target = map[t as keyof typeof map]; if (!target) return;
    if (admin) void navigate({ to: "/admin/$", params: { _splat: target[1] } }); else void navigate({ to: target[0] });
  };
  const run = (item: MenuItem, r: Row) => {
    switch (item.type) {
      case "details": return setDetail(r.id);
      case "note": setNoteText(""); return setNoteFor(r.id);
      case "call": if (r.phone) window.location.href = `tel:${r.phone}`; else toast.error("No phone number"); return;
      case "whatsapp": { const d = r.phone.replace(/\D/g, ""); if (d) window.open(`https://wa.me/${d}`, "_blank", "noopener"); else toast.error("No phone number"); return; }
      case "next": return r.stage < CLOSED ? move(r.id, r.stage + 1) : undefined;
      case "move": setMoveTo(r.stage); return setMoveFor(r.id);
      default: return goPage(item.type);
    }
  };

  const filters = <>
    <select aria-label="Priority" className={selectCls} value={priority} onChange={(e) => { setPriority(e.target.value); setPage(0); }}><option value="">All priorities</option>{opt("priority").map((v) => <option key={v}>{v}</option>)}</select>
    <select aria-label="Lead source" className={selectCls} value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }}><option value="">All sources</option>{opt("source").map((v) => <option key={v}>{v}</option>)}</select>
    {admin && <select aria-label="Company" className={selectCls} value={company} onChange={(e) => { setCompany(e.target.value); setPage(0); }}><option value="">All companies</option>{opt("company").map((v) => <option key={v}>{v}</option>)}</select>}
    {admin && <select aria-label="Employee" className={selectCls} value={employee} onChange={(e) => { setEmployee(e.target.value); setPage(0); }}><option value="">All employees</option>{opt("assignee").map((v) => <option key={v}>{v}</option>)}</select>}
  </>;

  return (
    <div className="space-y-5">
      <PageHeader title={open === null ? "Pipeline" : STAGES[open]!.name} subtitle={open === null ? "Track every client through six simple stages." : `${counts[open]} client${counts[open] === 1 ? "" : "s"} in this stage`}>
        {open !== null && <ToolbarButton onClick={() => setOpen(null)}><ArrowLeft className="size-4" />Back to Pipeline</ToolbarButton>}
        {admin && <ToolbarButton primary onClick={() => setManage(open ?? 0)}><Settings2 className="size-4" />Manage Actions</ToolbarButton>}
      </PageHeader>
      <div className="rounded-lg border border-admin-orange/40 bg-admin-orange/10 px-4 py-2.5 text-sm text-foreground">
        <strong>Preview mode:</strong> client details come from your real leads (read-only). Stage moves, outcomes, notes and menu settings are a prototype kept on this screen only — they are not saved and reset when you leave.
      </div>

      {open === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={s.name} onClick={() => { setOpen(i); setPage(0); setSearch(""); }}
                className="group rounded-xl border bg-card p-6 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-admin-blue/50 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-start justify-between">
                  <span className={cn("grid size-12 place-items-center rounded-xl", s.tone)}><Icon className="size-6" /></span>
                  <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-admin-blue" />
                </div>
                <p className="mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">{s.name}</p>
                <p className="mt-1 text-4xl font-extrabold text-foreground">{counts[i]}</p>
                <p className="mt-2 text-sm text-muted-foreground">{i === CLOSED ? `${rows.filter((r) => r.outcome === "won").length} won · ${rows.filter((r) => r.outcome === "lost").length} lost` : "clients · open sheet"}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><button className="hover:text-admin-blue" onClick={() => setOpen(null)}>Pipeline</button><span>/</span><span className="font-medium text-foreground">{STAGES[open]!.name}</span></div>
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
              <SearchInput className="w-full sm:w-64" placeholder="Search name, phone, email" value={search} onChange={(v) => { setSearch(v); setPage(0); }} />
              {filters}
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" className="h-10"><Columns3 className="size-4" />Columns</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel><DropdownMenuSeparator />
                  {ALL_COLUMNS.map((c) => <DropdownMenuCheckboxItem key={c} checked={!hidden.includes(c)} disabled={c === "Client Name"} onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(v) => setHidden((h) => v ? h.filter((x) => x !== c) : [...h, c])}>{c}</DropdownMenuCheckboxItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {filtered.length === 0 ? <EmptyState title="No clients in this stage" hint={open === 0 ? "" : "Use Next on a client in an earlier stage to move them here."} /> : (
            <DataTable minWidth={cols.length * 150 + 260} columns={[...cols, open === CLOSED ? "Outcome" : "Next", "Actions"]}>
              {visible.map((r) => {
                const last = r.notes.at(-1)?.text;
                const cell: Record<string, React.ReactNode> = {
                  "Client Name": <button className="font-semibold text-admin-blue hover:underline" onClick={() => setDetail(r.id)}>{r.name}</button>,
                  "Phone Number": r.phone || "—", Email: r.email || "—", "Lead Source": r.source, "Assigned To": r.assignee,
                  "Last Note": <span className="block max-w-[200px] truncate" title={last}>{last ?? "—"}</span>,
                  Priority: <StatusBadge tone={/hot|high/i.test(r.priority) ? "red" : /warm|medium/i.test(r.priority) ? "orange" : "gray"}>{r.priority}</StatusBadge>,
                  "Next Follow-up": "—", "Created Date": fmt(r.created),
                };
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    {cols.map((c) => <td key={c} className="whitespace-nowrap px-4 py-3">{cell[c]}</td>)}
                    <td className="whitespace-nowrap px-4 py-3">{open === CLOSED
                      ? <button onClick={() => { setOutcome(r.outcome ?? "won"); setCloseFor({ id: r.id, from: CLOSED }); }} title="Edit outcome">
                          <StatusBadge tone={r.outcome === "lost" ? "red" : "green"}>{r.outcome === "lost" ? "Lost" : "Won"} <Pencil className="ml-1 size-3" /></StatusBadge></button>
                      : <Button size="sm" className="bg-admin-blue text-primary-foreground hover:bg-admin-blue/90" onClick={() => move(r.id, r.stage + 1)}>Next<ArrowRight className="size-4" /></Button>}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${r.name}`}><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                          {menus[open]!.filter((m) => m.enabled && !(m.type === "next" && r.stage === CLOSED)).map((m) => { const I = ICONS[m.icon] ?? Eye; return <DropdownMenuItem key={m.id} onClick={() => run(m, r)}><I className="size-4" />{m.label}</DropdownMenuItem>; })}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDetail(r.id)}><History className="size-4" />View History</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <span>Showing {filtered.length ? cur * PAGE + 1 : 0}–{Math.min(filtered.length, cur * PAGE + PAGE)} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="size-4" /></Button>
              <span>Page {cur + 1} of {pages}</span>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </Card>
      )}

      {/* Deal outcome */}
      <Dialog open={!!closeFor} onOpenChange={(o) => !o && setCloseFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Was the deal successful?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(["won", "lost"] as const).map((o) => <button key={o} onClick={() => setOutcome(o)} className={cn("rounded-lg border-2 p-4 font-semibold", outcome === o ? (o === "won" ? "border-admin-green bg-admin-green/10 text-success" : "border-admin-red bg-admin-red/10 text-admin-red") : "border-border")}>{o === "won" ? "Deal Won" : "Deal Lost"}</button>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCloseFor(null)}>Cancel</Button><Button onClick={() => {
            if (!closeFor) return; const { id, from } = closeFor; const name = rows.find((r) => r.id === id)?.name;
            place(id, CLOSED, outcome); setCloseFor(null);
            toast.success(`${name} marked ${outcome === "won" ? "Won" : "Lost"}`, { description: "Prototype only — not saved to the CRM.", ...(from !== CLOSED ? { action: { label: "Undo", onClick: () => place(id, from) } } : {}) });
          }}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to stage */}
      <Dialog open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Move to another stage</DialogTitle></DialogHeader>
          <select aria-label="Stage" className={selectCls} value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))}>{STAGES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select>
          <DialogFooter><Button variant="outline" onClick={() => setMoveFor(null)}>Cancel</Button><Button onClick={() => { if (moveFor) move(moveFor, moveTo); setMoveFor(null); }}>Move</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add note */}
      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add note</DialogTitle></DialogHeader>
          <textarea aria-label="Note" rows={4} maxLength={500} value={noteText} onChange={(e) => setNoteText(e.target.value)} className="w-full rounded-md border bg-card p-3 text-sm" placeholder="Write a short note…" />
          <p className="text-xs text-muted-foreground">Kept on this screen only in preview mode.</p>
          <DialogFooter><Button variant="outline" onClick={() => setNoteFor(null)}>Cancel</Button><Button disabled={!noteText.trim()} onClick={() => {
            setRows((rs) => rs.map((r) => r.id === noteFor ? { ...r, notes: [...r.notes, { text: noteText.trim(), at: new Date().toISOString() }] } : r)); setNoteFor(null); toast.success("Note added (preview only)");
          }}>Add note</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client drawer */}
      <Sheet open={!!detailRow} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {detailRow && <>
            <SheetHeader><SheetTitle>{detailRow.name}</SheetTitle></SheetHeader>
            <div className="mt-5 space-y-5 text-sm">
              <Section title="Contact Information"><Field k="Phone" v={detailRow.phone} /><Field k="Email" v={detailRow.email} />{admin && <Field k="Company" v={detailRow.company} />}</Section>
              <Section title="Lead Source"><Field k="Source" v={detailRow.source} /><Field k="Priority" v={detailRow.priority} /><Field k="Created" v={fmt(detailRow.created)} /></Section>
              <Section title="Assigned Employee"><Field k="Assigned to" v={detailRow.assignee} /></Section>
              <Section title="Current Pipeline Stage"><div className="flex items-center gap-2"><StatusBadge tone="blue">{STAGES[detailRow.stage]!.name}</StatusBadge>{detailRow.outcome && <StatusBadge tone={detailRow.outcome === "won" ? "green" : "red"}>{detailRow.outcome === "won" ? "Won" : "Lost"}</StatusBadge>}</div></Section>
              <Section title="Follow-up Information"><p className="text-muted-foreground">Scheduled follow-ups stay in the existing Follow-ups page.</p></Section>
              <Section title="Notes">{detailRow.notes.length ? detailRow.notes.map((n, i) => <p key={i} className="rounded-md bg-muted/60 p-2">{n.text}<span className="mt-1 block text-xs text-muted-foreground">{fmt(n.at)}</span></p>) : <p className="text-muted-foreground">No notes yet.</p>}</Section>
              <Section title="Stage History"><ol className="space-y-2 border-l pl-4">{detailRow.history.map((h, i) => <li key={i}><span className="font-medium">{STAGES[h.stage]!.name}</span> <span className="text-muted-foreground">· {fmt(h.at)}</span></li>)}</ol></Section>
            </div>
          </>}
        </SheetContent>
      </Sheet>

      {admin && manage !== null && <ManageActions stage={manage} setStage={setManage} items={menus[manage]!} onChange={(items) => setMenus((m) => m.map((x, i) => i === manage ? items : x))} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3><div className="space-y-1.5">{children}</div></section>;
}
function Field({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="break-all text-right font-medium">{v || "—"}</span></div>;
}

function ManageActions({ stage, setStage, items, onChange }: { stage: number; setStage: (s: number | null) => void; items: MenuItem[]; onChange: (i: MenuItem[]) => void }) {
  const update = (id: string, patch: Partial<MenuItem>) => onChange(items.map((i) => i.id === id ? { ...i, ...patch } : i));
  const shift = (idx: number, d: number) => { const n = [...items]; const [x] = n.splice(idx, 1); n.splice(idx + d, 0, x!); onChange(n); };
  return (
    <Dialog open onOpenChange={(o) => !o && setStage(null)}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader><DialogTitle>Manage Actions</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Stage" className={selectCls} value={stage} onChange={(e) => setStage(Number(e.target.value))}>{STAGES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select>
          <span className="text-xs text-muted-foreground">Each stage has its own three-dot menu. Preview only — not saved.</span>
        </div>
        <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {items.map((it, idx) => (
            <div key={it.id} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[auto_1fr_110px_1fr_auto_auto] sm:items-center">
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-8" aria-label="Move up" disabled={idx === 0} onClick={() => shift(idx, -1)}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Move down" disabled={idx === items.length - 1} onClick={() => shift(idx, 1)}><ArrowDown className="size-4" /></Button>
              </div>
              <input aria-label="Menu label" value={it.label} maxLength={40} onChange={(e) => update(it.id, { label: e.target.value })} className="h-9 rounded-md border bg-card px-2 text-sm" />
              <select aria-label="Icon" value={it.icon} onChange={(e) => update(it.id, { icon: e.target.value })} className="h-9 rounded-md border bg-card px-2 text-sm">{Object.keys(ICONS).map((k) => <option key={k}>{k}</option>)}</select>
              <select aria-label="Action type" value={it.type} onChange={(e) => update(it.id, { type: e.target.value as ActionType })} className="h-9 rounded-md border bg-card px-2 text-sm">{ACTION_TYPES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
              <Switch aria-label="Enabled" checked={it.enabled} onCheckedChange={(v) => update(it.id, { enabled: v })} />
              {it.custom ? <Button variant="ghost" size="icon" className="size-8 text-admin-red" aria-label="Remove" onClick={() => onChange(items.filter((i) => i.id !== it.id))}><Trash2 className="size-4" /></Button> : <span className="w-8" />}
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onChange([...items, { id: uid(), label: "New action", icon: "eye", type: "details", enabled: true, custom: true }])}><Plus className="size-4" />Add menu item</Button>
          <Button onClick={() => setStage(null)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
