import { useMemo, useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { MoreVertical, ArrowRightLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserWorkspace } from './UserWorkspace';
import { LeadDetails } from './LeadDetails';
import { userCrmQuery } from '@/lib/user-crm-query';
import { moveAssignedLead } from '@/lib/leads-board.functions';
import { boardStageId, stageLabel, boardDateMatches, leadCacheKeys, type BoardStage } from '@/lib/leads-board';
import type { UserCrmData } from '@/lib/user-crm.functions';
type Lead = UserCrmData['leads'][number] & { board_moved_at?: string | null };
const PAGE = 20;
export function AllAssigned() {
  const { data } = useSuspenseQuery(userCrmQuery);
  const qc = useQueryClient(), move = useServerFn(moveAssignedLead);
  const [q, setQ] = useState(''), [view, setView] = useState<'pending' | 'moved' | 'all'>('pending'), [source, setSource] = useState(''), [stageF, setStageF] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [page, setPage] = useState(0), [selected, setSelected] = useState<string[]>([]), [open, setOpen] = useState<string | null>(null);
  const [target, setTarget] = useState<string[] | null>(null), [stageId, setStageId] = useState(''), [outcome, setOutcome] = useState<'won' | 'lost' | ''>(''), [busy, setBusy] = useState(false);
  const stagesFor = (l: Lead): BoardStage[] => (l.company_id ? data.companyStages.find(c => c.company_id === l.company_id)?.stages : data.personalStages) || [];
  const assigned = useMemo(() => (data.leads as Lead[]).filter(l => l.assigned_to === data.userId && l.created_by !== data.userId), [data]);
  const stageName = (l: Lead) => { const st = stagesFor(l), id = boardStageId(l, st); const s = st.find(x => x.id === id); return s ? stageLabel(s) + (['won', 'lost'].includes(l.status) ? ` (${l.status === 'won' ? 'Won' : 'Lost'})` : '') : '—'; };
  const srcName = (id: string | null) => data.sources.find(s => s.id === id)?.name || '—';
  const rows = assigned.filter(l => {
    const t = q.trim().toLowerCase();
    if (t && ![l.customer_name, l.phone, l.email].some(v => (v || '').toLowerCase().includes(t))) return false;
    if (view === 'pending' && l.board_moved_at) return false;
    if (view === 'moved' && !l.board_moved_at) return false;
    if (source && l.source_id !== source) return false;
    if (stageF && stageName(l).split(' (')[0] !== stageF) return false;
    return boardDateMatches(l.created_at, from, to);
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)), cur = Math.min(page, pages - 1), shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const pending = assigned.filter(l => !l.board_moved_at).length;
  const allStageNames = [...new Set([...data.personalStages, ...data.companyStages.flatMap(c => c.stages)].map(stageLabel))];
  const targetLeads = assigned.filter(l => target?.includes(l.id));
  const dialogStages = targetLeads[0] ? stagesFor(targetLeads[0]).filter(s => s.is_active).sort((a, b) => a.position - b.position) : [];
  const chosen = dialogStages.find(s => s.id === stageId);
  const allSel = rows.length > 0 && rows.every(r => selected.includes(r.id));
  const openMove = (ids: string[]) => { setTarget(ids); setStageId(''); setOutcome(''); };
  async function confirm() {
    if (!chosen) return;
    if (chosen.board_closed && !outcome) { toast.error('Choose Won or Lost'); return; }
    setBusy(true); let ok = 0; const failed: string[] = [];
    for (const l of targetLeads) {
      const st = stagesFor(l).find(s => s.id === chosen.id) || stagesFor(l).find(s => chosen.board_closed ? s.board_closed : chosen.board_initial ? s.board_initial : stageLabel(s) === stageLabel(chosen));
      try { if (!st) throw new Error('Stage not available'); await move({ data: { id: l.id, updated_at: l.updated_at, stage_id: st.id, outcome: st.board_closed ? (outcome || null) : null } }); ok++; }
      catch (e) { failed.push(`${l.customer_name}: ${e instanceof Error ? e.message : 'failed'}`); }
    }
    await Promise.all(leadCacheKeys.map(k => qc.invalidateQueries({ queryKey: k })));
    setBusy(false);
    if (ok) toast.success(`${ok} lead${ok > 1 ? 's' : ''} moved to Board`);
    if (failed.length) toast.error(`${failed.length} not moved — ${failed.slice(0, 3).join('; ')}`);
    setSelected(s => s.filter(id => !targetLeads.some(l => l.id === id) || failed.some(f => f.startsWith(assigned.find(a => a.id === id)?.customer_name + ':'))));
    if (!failed.length) setTarget(null);
  }
  const lead = assigned.find(l => l.id === open);
  return <UserWorkspace>
    <section className="leads-banner mb-6 border"><h1 className="text-2xl font-bold">All Assigned</h1><p className="mt-1 text-sm text-muted-foreground">Manage leads assigned to you</p>
      <div className="mt-4 flex flex-wrap gap-3"><Badge variant="secondary" className="px-3 py-1 text-sm">Total Assigned: {assigned.length}</Badge><Badge variant="secondary" className="px-3 py-1 text-sm">Pending Board: {pending}</Badge></div></section>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-40"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search leads" className="h-9 pl-9" placeholder="Search name, phone or email" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></div>
      <select aria-label="Source" className="inp h-9 w-full sm:w-32" value={source} onChange={e => { setSource(e.target.value); setPage(0); }}><option value="">All sources</option>{data.sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select aria-label="Board stage" className="inp h-9 w-full sm:w-32" value={stageF} onChange={e => { setStageF(e.target.value); setPage(0); }}><option value="">All stages</option>{allStageNames.map(n => <option key={n}>{n}</option>)}</select>
      <Input aria-label="Assigned date" type="date" className="h-9 w-auto" value={from} onChange={e => { setFrom(e.target.value); setTo(e.target.value); setPage(0); }} />
      <div className="flex h-9 items-center rounded-md border p-0.5">{(['pending', 'moved', 'all'] as const).map(v => <Button key={v} size="sm" variant={view === v ? 'default' : 'ghost'} onClick={() => { setView(v); setPage(0); setSelected([]); }}>{v[0]!.toUpperCase() + v.slice(1)}</Button>)}</div>
      <Button className="h-9" disabled={!selected.length} onClick={() => openMove(selected)}><ArrowRightLeft className="size-4" />Move to Board{selected.length ? ` (${selected.length})` : ''}</Button>
    </div>
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr>
      <th className="p-3"><Checkbox aria-label="Select all" checked={allSel} onCheckedChange={c => setSelected(c ? rows.map(r => r.id) : [])} /></th>
      {['Lead Name', 'Phone', 'Email', 'Lead Source', 'Campaign / Ad', 'Assigned Date', 'Board Stage', 'Status', ''].map(h => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{shown.length ? shown.map(l => <tr key={l.id} className="border-t hover:bg-muted/30">
        <td className="p-3"><Checkbox aria-label={`Select ${l.customer_name}`} checked={selected.includes(l.id)} onCheckedChange={c => setSelected(s => c ? [...s, l.id] : s.filter(x => x !== l.id))} /></td>
        <td className="p-3 font-medium"><button className="hover:underline" onClick={() => setOpen(l.id)}>{l.customer_name}</button></td>
        <td className="p-3">{l.phone}</td><td className="p-3">{l.email || '—'}</td><td className="p-3">{srcName(l.source_id)}</td>
        <td className="p-3">{[l.meta_campaign_name, l.meta_ad_name].filter(Boolean).join(' / ') || '—'}</td>
        <td className="p-3">{new Date(l.created_at).toLocaleDateString()}</td><td className="p-3">{l.board_moved_at ? stageName(l) : '—'}</td>
        <td className="p-3"><Badge variant={l.board_moved_at ? 'default' : 'outline'}>{l.board_moved_at ? 'Moved' : 'Pending'}</Badge></td>
        <td className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Lead actions"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(l.id)}>View Details</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(l.phone).then(() => toast.success('Phone number copied'), () => toast.error('Could not copy')); }}>Copy Phone Number</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openMove([l.id])}>Move to Board</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>
      </tr>) : <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">{assigned.length ? 'No leads match these filters.' : 'No leads have been assigned to you yet.'}</td></tr>}</tbody></table></div>
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground"><span>{rows.length} lead{rows.length === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button><span>Page {cur + 1} of {pages}</span><Button size="sm" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button></div></div>
    <Dialog open={!!target} onOpenChange={o => { if (!o && !busy) setTarget(null); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Move to Board</DialogTitle><DialogDescription>{targetLeads.length} lead{targetLeads.length === 1 ? '' : 's'} selected</DialogDescription></DialogHeader>
      <select aria-label="Target stage" className="inp w-full" value={stageId} onChange={e => { setStageId(e.target.value); setOutcome(''); }}><option value="">Select stage</option>{dialogStages.map(s => <option key={s.id} value={s.id}>{stageLabel(s)}</option>)}</select>
      {chosen?.board_closed && <div className="flex gap-3">{(['won', 'lost'] as const).map(o => <Button key={o} className="flex-1" variant={outcome === o ? 'default' : 'outline'} onClick={() => setOutcome(o)}>{o === 'won' ? 'Won' : 'Lost'}</Button>)}</div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Cancel</Button><Button disabled={busy || !chosen || (chosen.board_closed && !outcome)} onClick={() => void confirm()}>{busy ? 'Moving…' : 'Confirm'}</Button></DialogFooter></DialogContent></Dialog>
    {lead && <LeadDetails key={lead.id} lead={lead} data={{ ...data, stages: stagesFor(lead) as never }} close={() => setOpen(null)} />}
  </UserWorkspace>;
}
