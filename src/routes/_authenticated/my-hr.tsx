import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { getHrmWorkspace } from '@/lib/hrm.functions';
import { loadMyAttendance, markMyAttendance } from '@/lib/personal-attendance.functions';
import { adminHead } from '@/lib/admin-head';
import type { HrModule } from '@/lib/hrm-model';

export const Route = createFileRoute('/_authenticated/my-hr')({
  errorComponent: WorkspaceAccessError,
  head: () => adminHead('My Attendance', 'Your own check-in, check-out and attendance history.'),
  component: MyAttendance,
});

const tz = 'Asia/Kolkata';
const time = (v: string | null) => (v ? new Date(v).toLocaleTimeString('en-IN', { timeZone: tz, hour: '2-digit', minute: '2-digit' }) : '—');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: tz });

function MyAttendance() {
  const qc = useQueryClient();
  const load = useServerFn(loadMyAttendance), mark = useServerFn(markMyAttendance), hr = useServerFn(getHrmWorkspace);
  const rows = useQuery({ queryKey: ['my-attendance'], queryFn: () => load() });
  const official = useQuery({ queryKey: ['hr-portal-permissions'], queryFn: () => hr({ data: { module: 'attendance' } }), retry: false });
  const [busy, setBusy] = useState(false);
  const [module, setModule] = useState<HrModule>('attendance');
  const t = rows.data?.find((r) => r.attendance_date === today());
  const act = async (action: 'check_in' | 'check_out') => {
    setBusy(true);
    try { await mark({ data: { action } }); await qc.invalidateQueries({ queryKey: ['my-attendance'] }); toast.success(action === 'check_in' ? 'Checked in' : 'Checked out'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const month = today().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y!, m!, 0).getDate();
  const byDate = new Map((rows.data ?? []).map((r) => [r.attendance_date, r]));
  return (
    <UserWorkspace>
      <h1 className="mb-1 text-2xl font-bold">My Attendance</h1>
      <p className="mb-5 text-sm text-muted-foreground">Personal attendance log (India time). Official company attendance is managed by HR separately.</p>
      <div className="mb-6 flex flex-wrap items-center gap-4 border bg-card p-5">
        <div className="mr-auto"><p className="text-sm text-muted-foreground">Today</p><p className="font-semibold">In {time(t?.check_in ?? null)} · Out {time(t?.check_out ?? null)}</p></div>
        <Button disabled={busy || !!t} onClick={() => act('check_in')}><LogIn />Check In</Button>
        <Button variant="outline" disabled={busy || !t || !!t.check_out} onClick={() => act('check_out')}><LogOut />Check Out</Button>
      </div>
      <div className="mb-6 border bg-card p-5">
        <h2 className="mb-3 font-semibold">This month</h2>
        <div className="grid grid-cols-7 gap-2 sm:grid-cols-10 lg:grid-cols-[repeat(16,minmax(0,1fr))]">
          {Array.from({ length: days }, (_, i) => { const d = `${month}-${String(i + 1).padStart(2, '0')}`; const r = byDate.get(d); return (
            <div key={d} title={r ? 'Present' : 'Not recorded'} className={`rounded border p-2 text-center text-xs ${r ? 'bg-success/15 text-success' : 'text-muted-foreground'}`}>{i + 1}<div>{r ? 'P' : '–'}</div></div>); })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">P = Present (checked in). Days without a record are not treated as absent.</p>
      </div>
      <div className="mb-6 overflow-x-auto border bg-card">
        <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Date</th><th className="p-3">Check In</th><th className="p-3">Check Out</th></tr></thead>
          <tbody>{rows.isPending ? <tr><td className="p-3" colSpan={3}>Loading…</td></tr> : (rows.data ?? []).length === 0 ? <tr><td className="p-3 text-muted-foreground" colSpan={3}>No attendance recorded yet.</td></tr> : rows.data!.map((r) => <tr key={r.id} className="border-b"><td className="p-3">{r.attendance_date}</td><td className="p-3">{time(r.check_in)}</td><td className="p-3">{time(r.check_out)}</td></tr>)}</tbody></table>
      </div>
      {official.isSuccess && (
        <section>
          <h2 className="mb-3 font-semibold">Official HR (company-linked)</h2>
          <div className="mb-3 flex flex-wrap gap-2">{(['attendance', 'leave', 'document', 'meeting', 'announcement'] as HrModule[]).map((x) => <Button key={x} size="sm" variant={module === x ? 'default' : 'outline'} onClick={() => setModule(x)}>{x.charAt(0).toUpperCase() + x.slice(1)}</Button>)}</div>
          <HrmPage key={module} module={module} self />
        </section>
      )}
    </UserWorkspace>
  );
}
