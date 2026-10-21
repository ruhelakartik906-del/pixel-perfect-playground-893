import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Eye, LayoutGrid, List, LogIn, Mail, MoreVertical, Pencil, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb, Card, DataTable, EmptyState, PageHeader, SearchInput, StatusBadge, ToolbarButton } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { adminHead, initials } from "@/lib/admin-head";
import { SYSTEM_ROLES, type SystemRole } from "@/lib/permissions";
import { inviteUser, setUserAccountStatus, pendingEmployeeInvitees, resendEmployeeInvitation } from "@/lib/admin-users.functions";
import { cn } from "@/lib/utils";
import { INVITATION_REDIRECT_URL } from "@/lib/admin-invitation";

export const Route = createFileRoute("/_authenticated/admin/users/users")({
  head: () => adminHead("Users", "Manage all users, roles, companies and account status."),
  component: UsersPage,
});

const db = supabase as unknown as { from: (t: string) => any };
const QK = ["admin-users"];
const PAGE = 10;
type Profile = { id: string; full_name: string; email: string; phone: string; account_status: "pending" | "active" | "blocked"; avatar_url: string | null; created_at: string };
type U = Profile & { role: SystemRole; accessRoleId: string | null; accessRole: string; companyId: string | null; company: string; leads: number };

async function load() {
  const r = await Promise.all([
    db.from("profiles").select("id,full_name,email,phone,account_status,avatar_url,created_at").order("created_at"),
    db.from("user_roles").select("user_id,role"),
    db.from("user_access_roles").select("user_id,role_id"),
    db.from("access_roles").select("id,name").order("name"),
    db.from("company_members").select("user_id,company_id"),
    db.from("companies").select("id,name").order("name"),
    db.from("leads").select("assigned_to").not("assigned_to", "is", null).limit(10000),
  ]);
  const err = r.find((x) => x.error)?.error; if (err) throw err;
  const roles = r[3].data as { id: string; name: string }[];
  const companies = r[5].data as { id: string; name: string }[];
  const rank: SystemRole[] = ["super_admin", "manager", "employee", "client"];
  const users: U[] = (r[0].data as Profile[]).map((p) => {
    const sys = (r[1].data as any[]).filter((x) => x.user_id === p.id).map((x) => x.role as SystemRole).sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0] ?? "client";
    const ar = (r[2].data as any[]).find((x) => x.user_id === p.id)?.role_id ?? null;
    const co = (r[4].data as any[]).find((x) => x.user_id === p.id)?.company_id ?? null;
    return { ...p, role: sys, accessRoleId: ar, accessRole: roles.find((x) => x.id === ar)?.name ?? "", companyId: co, company: companies.find((c) => c.id === co)?.name ?? "",
      leads: (r[6].data as any[]).filter((l) => l.assigned_to === p.id).length };
  });
  return { users, roles, companies };
}

const sysLabel = (r: SystemRole) => SYSTEM_ROLES.find((x) => x.id === r)?.label ?? r;
type Form = { id?: string; email: string; full_name: string; phone: string; role: SystemRole; access_role_id: string; company_id: string };

function UsersPage() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const changeStatus = useServerFn(setUserAccountStatus);
  const getInvitees = useServerFn(pendingEmployeeInvitees);
  const resend = useServerFn(resendEmployeeInvitation);
  const { data: invitees } = useQuery({ queryKey: [...QK, 'invitees'], queryFn: () => getInvitees() });
  const [resending, setResending] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: QK, queryFn: load });
  const { data: me } = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [grid, setGrid] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<U | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => (data?.users ?? []).filter((u) => !q || [u.full_name, u.email, u.phone, sysLabel(u.role), u.accessRole, u.company].some((v) => v.toLowerCase().includes(q.toLowerCase()))), [data, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const refresh = () => qc.invalidateQueries({ queryKey: QK });

  const save = async () => {
    if (!form) return;
    if (!form.full_name.trim()) { toast.error("Name is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Enter a valid email"); return; }
    if (form.id === me && form.role !== "super_admin") { toast.error("You cannot remove your own Super Admin role"); return; }
    setBusy(true);
    try {
      if (!form.id) {
        await invite({ data: { email: form.email.trim(), full_name: form.full_name, phone: form.phone, role: form.role, access_role_id: form.access_role_id || null, company_id: form.company_id || null, redirect_to: INVITATION_REDIRECT_URL } });
        toast.success("Invitation sent — the user sets their own password from the email");
      } else {
        const id = form.id;
        const steps = [
          await db.from("profiles").update({ full_name: form.full_name.trim(), phone: form.phone.trim() }).eq("id", id),
          await db.from("user_roles").delete().eq("user_id", id).neq("role", form.role),
          await db.from("user_roles").upsert({ user_id: id, role: form.role }, { onConflict: "user_id,role" }),
          form.access_role_id ? await db.from("user_access_roles").upsert({ user_id: id, role_id: form.access_role_id }) : await db.from("user_access_roles").delete().eq("user_id", id),
          await db.from("company_members").delete().eq("user_id", id),
          ...(form.company_id ? [await db.from("company_members").insert({ user_id: id, company_id: form.company_id })] : []),
        ];
        const e = steps.find((s) => s.error)?.error; if (e) throw e;
        toast.success("User updated");
      }
      setForm(null); refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const setStatus = async (u: U, status: "active" | "blocked") => {
    if (u.id === me) { toast.error("You cannot block your own account"); return; }
    try {
      await changeStatus({ data: { user_id: u.id, status } });
      toast.success(status === "active" ? "User activated" : "User blocked"); refresh();
    } catch (error) { toast.error((error as Error).message); }
  };

  const edit = (u: U) => setForm({ id: u.id, email: u.email, full_name: u.full_name, phone: u.phone, role: u.role, access_role_id: u.accessRoleId ?? "", company_id: u.companyId ?? "" });
  const resendInvite = async (u: U) => {
    if (resending) return;
    setResending(u.id);
    try {
      await resend({ data: { user_id: u.id } });
      toast.success('Invitation email sent — the employee remains pending until password setup');
      refresh();
    } catch (error) { toast.error((error as Error).message); }
    finally { setResending(null); }
  };
  const tone = (s: U["account_status"]) => s === "active" ? "green" : s === "blocked" ? "red" : "orange";
  const Avatar = ({ u }: { u: U }) => u.avatar_url
    ? <img src={u.avatar_url} alt="" className="size-11 rounded-full object-cover" />
    : <span className="grid size-11 shrink-0 place-items-center rounded-full bg-admin-blue/10 text-sm font-bold text-admin-blue">{initials(u.full_name || u.email)}</span>;
  const Actions = ({ u }: { u: U }) => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Actions for ${u.full_name}`} className="grid size-8 place-items-center rounded hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setView(u)}><Eye className="size-4" />View details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => edit(u)}><Pencil className="size-4" />Edit / assign role & company</DropdownMenuItem>
        {u.account_status === 'pending' && u.role === 'employee' && invitees?.includes(u.id) &&
          <DropdownMenuItem disabled={resending !== null} onClick={() => resendInvite(u)}><Mail className="size-4" />Resend Invitation</DropdownMenuItem>}
        {u.account_status === "active"
          ? <DropdownMenuItem onClick={() => setStatus(u, "blocked")} className="text-admin-red"><ShieldOff className="size-4" />Block</DropdownMenuItem>
          : <DropdownMenuItem onClick={() => setStatus(u, "active")}><ShieldCheck className="size-4" />Activate</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const RoleBadge = ({ u }: { u: U }) => <span className="rounded bg-admin-blue/10 px-2.5 py-1 text-sm font-medium text-admin-blue">{u.accessRole || sysLabel(u.role)}</span>;

  return (
    <div className="space-y-5">
      <Breadcrumb trail={["User Management"]} label="Users" />
      <PageHeader title={`Users (${filtered.length})`} subtitle="Manage all users in the system">
        <SearchInput placeholder="Search users..." value={q} onChange={(v) => { setQ(v); setPage(1); }} className="w-72" />
        <div className="flex overflow-hidden rounded-md border">
          <button aria-label="List view" onClick={() => setGrid(false)} className={cn("grid size-10 place-items-center", !grid ? "bg-admin-blue text-primary-foreground" : "bg-card")}><List className="size-4" /></button>
          <button aria-label="Grid view" onClick={() => setGrid(true)} className={cn("grid size-10 place-items-center", grid ? "bg-admin-blue text-primary-foreground" : "bg-card")}><LayoutGrid className="size-4" /></button>
        </div>
        <ToolbarButton primary onClick={() => setForm({ email: "", full_name: "", phone: "", role: "employee", access_role_id: "", company_id: "" })}><Plus className="size-4" />Add User</ToolbarButton>
      </PageHeader>
      <Card className="p-8">
        {isLoading ? <p className="py-20 text-center text-muted-foreground">Loading users…</p>
          : error ? <EmptyState title="Could not load users" hint={(error as Error).message} />
          : filtered.length === 0 ? <EmptyState title="No users found" />
          : <>
            {grid ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((u) => (
                  <div key={u.id} className="rounded-xl border p-5">
                    <div className="flex items-start gap-3"><Avatar u={u} />
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.full_name || "—"}{u.id === me && <span className="ml-2 rounded bg-admin-blue/10 px-1.5 text-xs text-admin-blue">Me</span>}</p><p className="truncate text-sm text-muted-foreground">{u.email}</p></div>
                      <Actions u={u} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2"><RoleBadge u={u} /><StatusBadge tone={tone(u.account_status)}>{u.account_status.toUpperCase()}</StatusBadge></div>
                    <p className="mt-3 text-sm text-muted-foreground">{u.phone || "No phone"} · {u.leads} leads</p>
                  </div>))}
              </div>
            ) : (
              <DataTable columns={["User", "Role", "Phone", "Created At", "Status", "Actions"]} minWidth={900}>
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar u={u} /><div>
                      <p className="font-semibold">{u.full_name || "—"}{u.id === me && <span className="ml-2 rounded bg-admin-blue/10 px-1.5 py-0.5 text-xs font-semibold text-admin-blue">Me</span>}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p></div></div></td>
                    <td className="px-4 py-3"><RoleBadge u={u} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3"><StatusBadge tone={tone(u.account_status)}>{u.account_status.toUpperCase()}</StatusBadge></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><button aria-label="View" onClick={() => setView(u)} className="text-admin-blue"><LogIn className="size-4" /></button><Actions u={u} /></div></td>
                  </tr>))}
              </DataTable>
            )}
            <div className="mt-5 flex items-center justify-end gap-3">
              <span>Total {filtered.length} users</span>
              <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous" className="disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="grid size-10 place-items-center rounded-md bg-admin-blue font-semibold text-primary-foreground">{cur}</span>
              <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next" className="disabled:opacity-30"><ChevronRight className="size-4" /></button>
            </div>
          </>}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit User" : "Add User"}</DialogTitle></DialogHeader>
          {form && <div className="grid gap-3">
            <Field label="Full name"><input className="inp" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={120} /></Field>
            <Field label="Email"><input className="inp" type="email" value={form.email} disabled={!!form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="inp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} /></Field>
            <Field label="System role"><select className="inp" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SystemRole })}>{SYSTEM_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
            <Field label="Permission role"><select className="inp" value={form.access_role_id} onChange={(e) => setForm({ ...form, access_role_id: e.target.value })}><option value="">None</option>{data?.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            <Field label="Company"><select className="inp" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}><option value="">None</option>{data?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            {!form.id && <p className="text-xs text-muted-foreground">An invitation email is sent. The user sets their own password — passwords are never shown or stored here.</p>}
            <ToolbarButton primary onClick={save} className="justify-center">{busy ? "Saving…" : form.id ? "Save changes" : "Send invitation"}</ToolbarButton>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>User details</DialogTitle></DialogHeader>
          {view && <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            {([["Name", view.full_name], ["Email", view.email], ["Phone", view.phone || "—"], ["System role", sysLabel(view.role)], ["Permission role", view.accessRole || "—"],
              ["Company", view.company || "—"], ["Assigned leads", String(view.leads)], ["Status", view.account_status], ["Created", new Date(view.created_at).toLocaleString()]] as const).map(([k, v]) =>
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}
