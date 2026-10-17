import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { indiaDate, bulkAttendanceSchema, type HrRow } from '@/lib/hrm-model';
import { human } from './config';

export function BulkAttendance({ people, open, onClose, onSave }: { people: HrRow[]; open: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(indiaDate());
  const [status, setStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Dialog open={open} onOpenChange={value => !value && !busy && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Bulk Attendance</DialogTitle></DialogHeader>
    <form className="grid gap-4" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const payload = bulkAttendanceSchema.parse({ employee_ids: selected, date, status, reason }); await onSave(payload); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <label className="grid gap-1 text-sm font-medium">Attendance Date<input className="inp" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="grid gap-1 text-sm font-medium">Attendance Status<select className="inp" value={status} onChange={e => setStatus(e.target.value)}>{['present','absent','half_day','leave','weekend'].map(s => <option key={s} value={s}>{s === 'leave' ? 'Approved Leave' : human(s)}</option>)}</select></label>
      <div className="flex items-center justify-between text-sm"><span className="font-medium">Employees · {selected.length} selected</span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(selected.length === people.length ? [] : people.map(p => p.id))}>{selected.length === people.length ? 'Clear selection' : 'Select all'}</Button></div>
      <div className="max-h-48 overflow-y-auto rounded-md border p-3">{people.map(p => <label key={p.id} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected,p.id] : selected.filter(id => id !== p.id))}/>{p.name || p.email}</label>)}{!people.length && <p className="text-sm text-muted-foreground">No authorized employees</p>}</div>
      <label className="grid gap-1 text-sm font-medium">Correction Reason<textarea className="min-h-20 rounded-md border bg-card p-3" minLength={3} maxLength={2000} required value={reason} onChange={e => setReason(e.target.value)}/></label>
      {error && <p role="alert" className="text-sm text-admin-red">{error}</p>}
      <Button type="submit" disabled={busy || !selected.length}>{busy ? 'Saving…' : 'Save Attendance'}</Button>
    </form>
  </DialogContent></Dialog>;
}