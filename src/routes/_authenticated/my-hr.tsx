import { WorkspaceAccessError } from '@/components/workspace/WorkspaceAccessError';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { LogIn, LogOut, CircleDashed, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
import { HrmPage } from '@/components/admin/hrm/HrmPage';
import { getHrmWorkspace } from '@/lib/hrm.functions';
import { loadMyAttendance, markMyAttendance } from '@/lib/personal-attendance.functions';
import { adminHead } from '@/lib/admin-head';
import { attendanceCell, indiaDate, type HrModule } from '@/lib/hrm-model';

export const Route = createFileRoute('/_authenticated/my-hr')({
  errorComponent: WorkspaceAccessError,
  head: () => adminHead('My Attendance', 'Your own daily attendance, Half Day status and check-in and check-out history.'),
  component: MyAttendance,
});
const time = (v: string | null) => v ? new Date(v).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—';
function MyAttendance() {
  const qc = useQueryClient();
  const load = useServerFn(loadMyAttendance), mark = useServerFn(markMyAttendance), hr = useServerFn(getHrmWorkspace);
  const rows = useQuery({ queryKey: ['my-attendance'], queryFn: () => load(), refetchInterval: 30000 });
  const official = useQuery({ queryKey: ['hr-portal-permissions'], queryFn: () => hr({ data: { module: 'attendance' } }), retry: false });
  const [busy, setBusy] = useState(false);
  const [module, setModule] = useState<HrModule>('leave');
  const [month, setMonth] = useState(indiaDate().slice(0, 7));
  const records = rows.data?.attendance ?? [];
  const person = rows.data?.people[0];
  const t = records.find(r => r.attendance_date === indiaDate());
  const act = async (action: 'check_in' | 'check_out' | 'half_day') => {
    if (busy) return;
    setBusy(true);
    try {
      await mark({ data: { action } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['my-attendance'] }), qc.invalidateQueries({ queryKey: ['hr-workspace', 'attendance'] })]);
      toast.success(action === 'check_in' ? 'Checked in' : action === 'half_day' ? 'Half Day saved' : 'Checked out');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };
  const year = Number(month.slice(0, 4)), m = Number(month.slice(5));
  const days = new Date(year, m, 0).getDate();
  const moveMonth = (delta: number) => { const d = new Date(year, m - 1 + delta, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const monthRecords = records.filter(r => r.attendance_date.startsWith(month));
  return <UserWorkspace>
    <h1 className="mb-1 text-2xl font-bold">My Attendance</h1>
    <p className="mb-5 text-sm text-muted-foreground">{indiaDate()} · Asia/Kolkata</p>
    {rows.error && <p role="alert" className="mb-4 text-admin-red">{rows.error.message}</p>}
    <div className="mb-6 flex flex-wrap items-center gap-4 border bg-card p-5">
      <div className="mr-auto"><p className="text-sm text-muted-foreground">Today · {t?.status === 'half_day' ? 'Half Day' : t?.status === 'present' ? 'Present' : t?.status || 'Unrecorded'}</p><p className="font-semibold">In {time(t?.check_in ?? null)} · Out {time(t?.check_out ?? null)}</p></div>
      <Button disabled={busy || !!t || !person} onClick={() => act('check_in')}><LogIn />Check In</Button>
      <Button variant="outline" disabled={busy || !person || t?.status === 'half_day' || (!!t && t.status !== 'present')} onClick={() => act('half_day')}><CircleDashed />Half Day</Button>
      <Button variant="outline" disabled={busy || !t?.check_in || !!t.check_out} onClick={() => act('check_out')}><LogOut />Check Out</Button>
    </div>
    <div className="mb-6 border bg-card p-5">
      <div className="mb-3 flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft /></Button><input aria-label="Attendance month" type="month" className="inp min-w-0" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight /></Button></div>
      <div className="grid grid-cols-7 gap-2 sm:grid-cols-10 lg:grid-cols-[repeat(16,minmax(0,1fr))]">
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const cell = person ? attendanceCell(person, date, records, rows.data?.holidays ?? [], rows.data?.leaves ?? []) : { status: 'unrecorded', label: '' };
          return <div key={date} aria-label={`${date}: ${cell.status}`} className={`min-h-16 rounded border px-1 py-2 text-center text-xs ${cell.status === 'present' ? 'bg-attendance-present/10 text-attendance-present' : cell.status === 'absent' ? 'bg-admin-red/10 text-admin-red' : cell.status === 'half_day' ? 'bg-admin-blue/10 text-admin-blue' : 'text-muted-foreground'}`}>{i + 1}<div className="mt-1 break-words text-[10px] font-semibold">{cell.label}</div></div>;
        })}
      </div>
    </div>
    <div className="mb-6 overflow-x-auto border bg-card">
      <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Check In</th><th className="p-3">Check Out</th></tr></thead><tbody>
        {rows.isPending ? <tr><td className="p-3" colSpan={4}>Loading…</td></tr> : !monthRecords.length ? <tr><td className="p-3 text-muted-foreground" colSpan={4}>No attendance recorded yet.</td></tr> : monthRecords.map(r => <tr key={r.id} className="border-b"><td className="p-3">{r.attendance_date}</td><td className="p-3">{r.status === 'half_day' ? 'Half Day' : r.status === 'present' ? 'Present' : r.status}</td><td className="p-3">{time(r.check_in)}</td><td className="p-3">{time(r.check_out)}</td></tr>)}
      </tbody></table>
    </div>
    {official.isSuccess && official.data.people.some(p=>p.profile_id===official.data.userId) && <section>
      <h2 className="mb-3 font-semibold">Official HR (company-linked)</h2>
      <div className="mb-3 flex flex-wrap gap-2">{(['leave', 'document', 'meeting', 'announcement'] as HrModule[]).map(x => <Button key={x} size="sm" variant={module === x ? 'default' : 'outline'} onClick={() => setModule(x)}>{x.charAt(0).toUpperCase() + x.slice(1)}</Button>)}</div>
      <HrmPage key={module} module={module} self />
    </section>}
  </UserWorkspace>;
}
