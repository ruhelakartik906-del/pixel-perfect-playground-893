import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, ShieldCheck, Trash2, Ban, CircleCheck, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createOrgEmployee, listAccessRoles, listOrgEmployees, myAdminCompanies, orgEmployeeAction, type OrgEmployee } from '@/lib/employees.functions';
import { cn } from '@/lib/utils';

export function OrgEmployees() {
  const queryClient = useQueryClient();
  const companies = useQuery({ queryKey: ['my-admin-companies'], queryFn: () => myAdminCompanies() });
  const [companyId, setCompanyId] = useState<string>('');
  const company = companyId || companies.data?.[0]?.id || '';
  const roles = useQuery({ queryKey: ['access-roles'], queryFn: () => listAccessRoles() });
  const employees = useQuery({
    queryKey: ['org-employees', company],
    queryFn: () => listOrgEmployees({ data: { company_id: company } }),
    enabled: Boolean(company),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgEmployee | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OrgEmployee | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', access_role_id: '' });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['org-employees', company] });
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (companies.data && companies.data.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
        <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h3 className="text-lg font-bold">Customer Admin access required</h3>
        <p className="mt-2 text-sm text-muted-foreground">Only the Customer Admin of an organization can manage its employees.</p>
      </div>
    );
  }

  const data = employees.data;
  const limit = data?.limit ?? null;
  const used = data?.employees.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {companies.data && companies.data.length > 1 && (
          <Select value={company} onValueChange={setCompanyId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select organization" /></SelectTrigger>
            <SelectContent>
              {companies.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-3">
          {limit !== null && (
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', used >= limit ? 'bg-admin-red/10 text-admin-red' : 'bg-admin-blue/10 text-admin-blue')}>
              Employees: {used} of {limit}{limit - used > 0 ? ` · ${limit - used} remaining` : ' · limit reached'}
            </span>
          )}
          <Button onClick={() => { setForm({ full_name: '', email: '', phone: '', password: '', access_role_id: '' }); setCreateOpen(true); }} disabled={limit !== null && used >= limit}>
            <UserPlus className="mr-2 size-4" /> Add Employee
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Permission role</th>
              <th className="px-4 py-3">Assigned leads</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.employees ?? []).map((e) => (
              <tr key={e.user_id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold">{e.full_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{e.email}</div>
                </td>
                <td className="px-4 py-3">{e.phone || '—'}</td>
                <td className="px-4 py-3">{e.access_role_name ?? <span className="text-muted-foreground">Default</span>}</td>
                <td className="px-4 py-3">{e.lead_count}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize', e.account_status === 'active' ? 'bg-admin-blue/10 text-admin-blue' : 'bg-admin-red/10 text-admin-red')}>
                    {e.account_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Edit employee" onClick={() => { setEditTarget(e); setForm({ full_name: e.full_name, email: e.email, phone: e.phone, password: '', access_role_id: e.access_role_id ?? '' }); }}>
                      <Pencil className="size-4" />
                    </Button>
                    {e.account_status === 'active' ? (
                      <Button variant="ghost" size="icon" title="Deactivate employee" disabled={busy} onClick={() => run(() => orgEmployeeAction({ data: { company_id: company, user_id: e.user_id, action: 'set_status', status: 'blocked' } }), 'Employee deactivated')}>
                        <Ban className="size-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" title="Activate employee" disabled={busy} onClick={() => run(() => orgEmployeeAction({ data: { company_id: company, user_id: e.user_id, action: 'set_status', status: 'active' } }), 'Employee activated')}>
                        <CircleCheck className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Remove employee" className="text-admin-red" onClick={() => setRemoveTarget(e)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.employees.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No employees yet. Add your first employee to get started.</td></tr>
            )}
            {employees.isPending && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading employees…</td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.audit.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><History className="size-4" /> Recent employee activity</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {data.audit.slice(0, 10).map((a) => (
              <li key={a.id} className="flex justify-between gap-4">
                <span className="capitalize">{a.action.replace('_', ' ')}{a.employee_name ? ` — ${a.employee_name}` : ''}</span>
                <span>{new Date(a.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={createOpen || Boolean(editTarget)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditTarget(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTarget ? 'Edit employee' : 'Add employee'}</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (editTarget) {
                void run(async () => {
                  await orgEmployeeAction({ data: { company_id: company, user_id: editTarget.user_id, action: 'update', full_name: form.full_name, phone: form.phone } });
                  await orgEmployeeAction({ data: { company_id: company, user_id: editTarget.user_id, action: 'assign_role', access_role: form.access_role_id || null } });
                }, 'Employee updated');
                setEditTarget(null);
              } else {
                void run(() => createOrgEmployee({ data: { company_id: company, full_name: form.full_name, email: form.email, phone: form.phone, password: form.password, access_role_id: form.access_role_id || null } }), 'Employee created');
                setCreateOpen(false);
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Full name</Label>
              <Input id="emp-name" required maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            {!editTarget && (
              <div className="space-y-1.5">
                <Label htmlFor="emp-email">Email</Label>
                <Input id="emp-email" type="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="emp-phone">Mobile number</Label>
              <Input id="emp-phone" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {!editTarget && (
              <div className="space-y-1.5">
                <Label htmlFor="emp-pass">Password</Label>
                <Input id="emp-pass" type="password" required minLength={8} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-xs text-muted-foreground">Share this password with the employee securely. They can change it after signing in.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Permission role</Label>
              <Select value={form.access_role_id} onValueChange={(v) => setForm({ ...form, access_role_id: v === 'default' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Default (no custom role)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (no custom role)</SelectItem>
                  {(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{editTarget ? 'Save changes' : 'Create employee'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.full_name || removeTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the employee from your organization and revokes their CRM access. Their account and historical records are preserved. This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                const target = removeTarget;
                setRemoveTarget(null);
                if (target) void run(() => orgEmployeeAction({ data: { company_id: company, user_id: target.user_id, action: 'remove' } }), 'Employee removed');
              }}
            >
              Remove employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
