import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminHead } from "@/lib/admin-head";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, canDeleteRole, isPermission, summarize } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/users/role")({
  head: () => adminHead("Roles", "Manage all roles and permissions in the system."),
  component: RolesPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["admin-access-roles"];
type Role = { id: string; name: string; description: string; permissions: string[]; users: number };

async function load(): Promise<Role[]> {
  const [r, a] = await Promise.all([db.from("access_roles").select("*").order("created_at"), db.from("user_access_roles").select("role_id")]);
  if (r.error) throw r.error; if (a.error) throw a.error;
  return (r.data as any[]).map((x) => ({ ...x, users: (a.data as any[]).filter((u) => u.role_id === x.id).length }));
}
const label = (m: string) => m.replace("_", " ");

function RolesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState<{ id?: string; name: string; description: string; permissions: Set<string> } | null>(null);
  const [view, setView] = useState<Role | null>(null);
  const [del, setDel] = useState<Role | null>(null);

  const filtered = useMemo(() => data.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * size, cur * size);

  const toggle = (p: string) => form && setForm({ ...form, permissions: new Set(form.permissions.has(p) ? [...form.permissions].filter((x) => x !== p) : [...form.permissions, p]) });
  const toggleModule = (m: string, on: boolean) => form && setForm({ ...form, permissions: new Set([...[...form.permissions].filter((p) => !p.startsWith(`${m}.`)), ...(on ? PERMISSION_ACTIONS.map((a) => `${m}.${a}`) : [])]) });

  const save = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name || name.length > 60) { toast.error("Role name is required (max 60 characters)"); return; }
    if (data.some((r) => r.id !== form.id && r.name.toLowerCase() === name.toLowerCase())) { toast.error("A role with this name already exists"); return; }
    const payload = { name, description: form.description.trim(), permissions: [...form.permissions].filter(isPermission) };
    const { error } = form.id ? await db.from("access_roles").update(payload).eq("id", form.id) : await db.from("access_roles").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Role updated" : "Role created"); setForm(null); qc.invalidateQueries({ queryKey: QK });
  };
  const remove = async () => {
    if (!del) return;
    if (!canDeleteRole(del.users)) { toast.error("Reassign the users on this role before deleting it"); setDel(null); return; }
    const { error } = await db.from("access_roles").delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Role deleted"); setDel(null); qc.invalidateQueries({ queryKey: QK });
  };

  return (
    <div className="space-y-5">
      <Breadcrumb label="Roles" />
      <PageHeader title="Roles" subtitle="Manage all roles and permissions in the system">
        <SearchInput placeholder="Search..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-72" />
        <ToolbarButton primary onClick={() => setForm({ name: "", description: "", permissions: new Set() })}><Plus className="size-4" />Add Role</ToolbarButton>
      </PageHeader>
      <Card className="p-5">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading roles…</p>
          : error ? <EmptyState title="Could not load roles" hint={(error as Error).message} />
          : filtered.length === 0 ? <EmptyState title="No roles yet" hint="Create a role and pick which modules it can view, create, edit or delete." />
          : <>
            <DataTable columns={["Role Name", "Permissions", "Users", "Actions"]} minWidth={800}>
              {rows.map((r) => {
                const s = summarize(r.permissions);
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-5 font-semibold">{r.name}</td>
                    <td className="px-4 py-5"><div className="flex flex-wrap items-center gap-2">
                      {s.shown.length === 0 && <span className="text-sm text-muted-foreground">No permissions</span>}
                      {s.shown.map((m) => <span key={m} className="rounded bg-admin-blue/10 px-2.5 py-1 text-sm text-admin-blue">{label(m)}</span>)}
                      {s.more > 0 && <span className="rounded bg-muted px-2.5 py-1 text-sm">+{s.more} more</span>}
                      <button onClick={() => setView(r)} className="flex items-center gap-1 text-sm text-admin-blue"><Eye className="size-3.5" />View All</button>
                    </div></td>
                    <td className="px-4 py-5 text-muted-foreground">{r.users}</td>
                    <td className="px-4 py-5"><DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Actions for ${r.name}`} className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setView(r)}><Eye className="size-4" />View permissions</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setForm({ id: r.id, name: r.name, description: r.description, permissions: new Set(r.permissions) })}><Pencil className="size-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDel(r)} className="text-admin-red"><Trash2 className="size-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu></td>
                  </tr>);
              })}
            </DataTable>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous" className="disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="grid size-10 place-items-center rounded-md bg-admin-blue font-semibold text-primary-foreground">{cur}</span>
              <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next" className="disabled:opacity-30"><ChevronRight className="size-4" /></button>
              <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }} className="h-10 rounded-md border bg-card px-3">{[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}</select>
            </div>
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Edit Role" : "Add Role"}</DialogTitle></DialogHeader>
          {form && <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium">Role name<input className="inp" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Description<input className="inp" value={form.description} maxLength={200} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Module</th>{PERMISSION_ACTIONS.map((a) => <th key={a} className="px-3 py-2 capitalize">{a}</th>)}<th className="px-3 py-2">All</th></tr></thead>
                <tbody className="divide-y">{PERMISSION_MODULES.map((m) => {
                  const all = PERMISSION_ACTIONS.every((a) => form.permissions.has(`${m}.${a}`));
                  return <tr key={m}><td className="px-3 py-2 capitalize">{label(m)}</td>
                    {PERMISSION_ACTIONS.map((a) => <td key={a} className="text-center"><input type="checkbox" aria-label={`${m} ${a}`} className="size-4 accent-admin-blue" checked={form.permissions.has(`${m}.${a}`)} onChange={() => toggle(`${m}.${a}`)} /></td>)}
                    <td className="text-center"><input type="checkbox" aria-label={`${m} all`} className="size-4 accent-admin-blue" checked={all} onChange={(e) => toggleModule(m, e.target.checked)} /></td></tr>;
                })}</tbody>
              </table>
            </div>
            <ToolbarButton primary onClick={save} className="justify-center">{form.id ? "Save changes" : "Create role"}</ToolbarButton>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{view?.name} — permissions</DialogTitle></DialogHeader>
          {view && <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {PERMISSION_MODULES.filter((m) => view.permissions.some((p) => p.startsWith(`${m}.`))).map((m) =>
              <div key={m} className="flex items-center justify-between rounded border px-3 py-2"><span className="font-medium capitalize">{label(m)}</span>
                <span className="flex gap-1">{PERMISSION_ACTIONS.filter((a) => view.permissions.includes(`${m}.${a}`)).map((a) => <span key={a} className="rounded bg-admin-blue/10 px-2 py-0.5 text-xs capitalize text-admin-blue">{a}</span>)}</span></div>)}
            {view.permissions.length === 0 && <p className="text-sm text-muted-foreground">This role has no permissions.</p>}
            <p className="text-xs text-muted-foreground">{view.users} user(s) assigned.</p>
          </div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete role “{del?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>{del && !canDeleteRole(del.users) ? `${del.users} user(s) still have this role. Reassign them first.` : "This cannot be undone."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
