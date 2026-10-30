import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2, ChevronLeft, ChevronRight, Clock3, MoreHorizontal, PauseCircle, PlayCircle,
  Plus, Archive, UserCheck, Users,
} from "lucide-react";
import { toast } from "sonner";
import { queryOptions } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Breadcrumb, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, StatusBadge } from "./ui";
import { archiveCustomer, listCustomers, setCustomerStatus } from "@/lib/customers.functions";
import { daysUntilExpiry, type CustomerRow } from "@/lib/org-features";

export const customersQuery = queryOptions({
  queryKey: ["admin-customers"],
  queryFn: () => listCustomers(),
});

const PAGE_SIZE = 20;
const statusTone = { active: "green", suspended: "orange", expired: "red" } as const;

export function AllUsers() {
  const { data: rows } = useSuspenseQuery(customersQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const changeStatus = useServerFn(setCustomerStatus);
  const archive = useServerFn(archiveCustomer);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [confirmArchive, setConfirmArchive] = useState<CustomerRow | null>(null);
  const [busy, setBusy] = useState(false);

  const planNames = useMemo(() => [...new Set(rows.map((r) => r.plan_name).filter((p): p is string => !!p))], [rows]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (plan !== "all" && (r.plan_name ?? "") !== plan) return false;
      if (!q) return true;
      return [r.name, r.admin_name, r.admin_email, r.email, r.phone, r.contact_person]
        .some((v) => v.toLowerCase().includes(q));
    });
    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "oldest") sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sort === "expiry") sorted.sort((a, b) => (a.expires_at ?? "9999").localeCompare(b.expires_at ?? "9999"));
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [rows, search, status, plan, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = list.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const counts = useMemo(() => {
    const c = { active: 0, suspended: 0, expired: 0, employees: 0, expiring: 0 };
    for (const r of rows) {
      c[r.status]++;
      c.employees += r.employee_count;
      const d = daysUntilExpiry(r.expires_at);
      if (r.status === "active" && d !== null && d <= 30 && d >= 0) c.expiring++;
    }
    return c;
  }, [rows]);

  async function applyStatus(row: CustomerRow, next: "active" | "suspended") {
    setBusy(true);
    try {
      await changeStatus({ data: { company_id: row.id, status: next } });
      toast.success(next === "active" ? `${row.name} activated` : `${row.name} suspended`);
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status could not be changed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchiveNow() {
    if (!confirmArchive) return;
    setBusy(true);
    try {
      await archive({ data: { company_id: confirmArchive.id } });
      toast.success(`${confirmArchive.name} archived`);
      setConfirmArchive(null);
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Customer could not be archived");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Breadcrumb label="All Users" trail={["User Management"]} />
      <PageHeader title="All Users" subtitle="Manage every customer organization, subscription and access.">
        <Button variant="hero" onClick={() => navigate({ to: "/admin/create-customer" })}>
          <Plus /> Create Customer
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard icon={Building2} label="Total Customers" value={rows.length} note="All organizations" tone="blue" />
        <KpiCard icon={UserCheck} label="Active" value={counts.active} note="Working customers" tone="green" />
        <KpiCard icon={PauseCircle} label="Suspended" value={counts.suspended} note="Access blocked" tone="orange" />
        <KpiCard icon={Clock3} label="Expired" value={counts.expired} note="Subscription ended" tone="red" />
        <KpiCard icon={Users} label="Employees" value={counts.employees} note="Across customers" tone="purple" />
        <KpiCard icon={Clock3} label="Expiring Soon" value={counts.expiring} note="Within 30 days" tone="pink" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput placeholder="Search name, company, email or phone" value={search} onChange={(v) => { setSearch(v); setPage(0); }} className="w-full sm:w-80" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="h-10 rounded-md border bg-card px-3 text-sm">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
        </select>
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(0); }} className="h-10 rounded-md border bg-card px-3 text-sm">
          <option value="all">All Plans</option>
          {planNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="expiry">Expiry date</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <DataTable columns={["Customer", "Admin", "Status", "Plan", "Employees", "Expires", "Registered", "Actions"]} minWidth={1100}>
        {visible.map((r) => {
          const days = daysUntilExpiry(r.expires_at);
          return (
            <tr key={r.id} className="align-top">
              <td className="px-4 py-3">
                <div className="font-semibold text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.email || "—"}</div>
              </td>
              <td className="px-4 py-3">
                <div>{r.admin_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{r.admin_email}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={r.is_active ? statusTone[r.status] : "gray"}>
                  {r.is_active ? r.status : "archived"}
                </StatusBadge>
              </td>
              <td className="px-4 py-3">{r.plan_name ?? "—"}</td>
              <td className="px-4 py-3">{r.employee_count}</td>
              <td className="px-4 py-3">
                {r.expires_at ? new Date(r.expires_at).toLocaleDateString("en-IN") : "—"}
                {days !== null && days >= 0 && days <= 30 && r.status === "active" && (
                  <div className="text-xs font-semibold text-warning">{days}d left</div>
                )}
              </td>
              <td className="px-4 py-3">{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
              <td className="px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger className="grid size-9 place-items-center rounded-md border hover:bg-muted" aria-label={`Actions for ${r.name}`}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin/all-users/$companyId", params: { companyId: r.id } })}>
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin/all-users/$companyId", params: { companyId: r.id } })}>
                      Manage Permissions
                    </DropdownMenuItem>
                    {r.status === "suspended" ? (
                      <DropdownMenuItem disabled={busy} onClick={() => applyStatus(r, "active")}>
                        <PlayCircle className="size-4" /> Activate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled={busy} onClick={() => applyStatus(r, "suspended")}>
                        <PauseCircle className="size-4" /> Suspend
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled={busy} className="text-destructive" onClick={() => setConfirmArchive(r)}>
                      <Archive className="size-4" /> Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          );
        })}
        {visible.length === 0 && (
          <tr><td colSpan={8}><EmptyState title="No customers found" hint="Create your first customer to get started." /></td></tr>
        )}
      </DataTable>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{list.length} customer{list.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          <span>Page {current + 1} of {pages}</span>
          <Button variant="outline" size="icon" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>

      <Dialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {confirmArchive?.name}?</DialogTitle>
            <DialogDescription>
              The customer is suspended and hidden from active lists. All data is retained and can be restored later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmArchive(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={confirmArchiveNow}>Archive Customer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
