import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  PauseCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  DataTable,
  EmptyState,
  KpiCard,
  PageHeader,
  SearchInput,
  StatusBadge,
} from "./ui";
import { installationsQuery } from "@/lib/crm-installations-query";
import { changeCrmInstallation, installationAudit } from "@/lib/crm-installations.functions";
import {
  filterInstallations,
  installationStatus,
  licenseDate,
  renewalExpiry,
  statusLabels,
  type Installation,
} from "@/lib/crm-installations";

type Action = "details" | "activate" | "suspend" | "extend" | "reset";
export function SoldCrmAdmins() {
  const { data: rows } = useSuspenseQuery(installationsQuery);
  const qc = useQueryClient();
  const change = useServerFn(changeCrmInstallation);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [soon, setSoon] = useState(false);
  const [sort, setSort] = useState("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Installation | null>(null);
  const [action, setAction] = useState<Action>("details");
  const [years, setYears] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const audit = useQuery({
    queryKey: ["crm-installation-audit", selected?.id],
    queryFn: () => installationAudit({ data: { id: selected?.id ?? "" } }),
    enabled: !!selected && action === "details",
  });
  const list = filterInstallations(rows, search, status, soon).sort(
    (a, b) =>
      (new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()) *
      (sort === "asc" ? 1 : -1),
  );
  const pages = Math.max(1, Math.ceil(list.length / 20));
  const current = Math.min(page, pages - 1);
  const counts = { active: 0, suspended: 0, expired: 0 };
  for (const row of rows) {
    const s = installationStatus(row);
    if (s === "active" || s === "suspended" || s === "expired") counts[s]++;
  }
  function open(row: Installation, next: Action) {
    setSelected(row);
    setAction(next);
    setYears(1);
    setError("");
    setMessage("");
  }
  async function confirm() {
    if (!selected || action !== "extend" || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await change({
        data: {
          action: "extend",
          id: selected.id,
          validity_years: years,
          expected_expiry: selected.expires_at,
        },
      });
      void qc.invalidateQueries({ queryKey: ["crm-installations"] }).catch(() => {});
      void qc.invalidateQueries({ queryKey: ["crm-installation-audit"] }).catch(() => {});
      setSelected(null);
      setMessage("Validity updated. Installation access remains Setup Required.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action could not be completed");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <Breadcrumb label="Sold CRM Admins" />
      <PageHeader title="Sold CRM Admins">
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh installations"
          onClick={() => qc.invalidateQueries({ queryKey: ["crm-installations"] })}
        >
          <RefreshCw className="size-4" />
        </Button>
        <Button asChild>
          <Link to="/admin/create-crm-admin">
            <Plus className="size-4" />
            Create CRM Admin
          </Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Building2}
          label="Total CRM installations sold"
          value={rows.length}
          note="Recorded installations"
          tone="blue"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Active CRM installations"
          value={counts.active}
          note="Valid active licenses"
          tone="green"
        />
        <KpiCard
          icon={PauseCircle}
          label="Suspended CRM installations"
          value={counts.suspended}
          note="Suspended licenses"
          tone="orange"
        />
        <KpiCard
          icon={Clock3}
          label="Expired CRM installations"
          value={counts.expired}
          note="Validity ended"
          tone="red"
        />
      </div>
      {message && (
        <p role="status" className="text-sm text-admin-blue">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Search client, company, email or installation ID"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          className="min-w-0 flex-1 basis-80"
        />
        <select
          aria-label="Status filter"
          className="inp w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soon}
            onChange={(e) => {
              setSoon(e.target.checked);
              setPage(0);
            }}
          />
          Expiring within 30 days
        </label>
        <select
          aria-label="Sort by expiry date"
          className="inp w-auto"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          <option value="asc">Expiry: earliest first</option>
          <option value="desc">Expiry: latest first</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        {list.length === 0 ? (
          <EmptyState
            title={rows.length ? "No matching installations" : "No CRM installations recorded"}
          />
        ) : (
          <DataTable
            columns={[
              "Client Name",
              "Company Name",
              "Admin Email",
              "Admin Phone",
              "CRM Installation ID",
              "CRM URL",
              "Start Date",
              "Expiry Date",
              "Validity",
              "Status",
              "Actions",
            ]}
            minWidth={1600}
          >
            {list.slice(current * 20, current * 20 + 20).map((row) => (
              <tr key={row.id}>
                {[
                  row.client_name,
                  row.company_name,
                  row.admin_email,
                  row.admin_phone || "—",
                  row.installation_id,
                ].map((v, i) => (
                  <td key={i} className="max-w-60 break-words px-4 py-3">
                    {v}
                  </td>
                ))}
                <td className="max-w-64 break-all px-4 py-3">
                  <a
                    href={row.crm_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-admin-blue"
                  >
                    {row.crm_url}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{licenseDate(row.starts_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">{licenseDate(row.expires_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.validity_years} Year{row.validity_years === 2 ? "s" : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge
                    tone={
                      installationStatus(row) === "expired"
                        ? "red"
                        : installationStatus(row) === "active"
                          ? "blue"
                          : "gray"
                    }
                  >
                    {statusLabels[installationStatus(row)]}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Actions for ${row.client_name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => open(row, "details")}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(row, "activate")}>
                        Activate CRM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(row, "suspend")}>
                        Suspend CRM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(row, "extend")}>
                        Extend Validity
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(row, "reset")}>
                        Reset Admin Access
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={row.crm_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-4" />
                          Open CRM
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span>
            {list.length} installation{list.length === 1 ? "" : "s"} · Page {current + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v && !busy) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {action === "details"
                ? "Installation Details"
                : {
                    activate: "Activate CRM",
                    suspend: "Suspend CRM",
                    extend: "Extend Validity",
                    reset: "Reset Admin Access",
                  }[action]}
            </DialogTitle>
            <DialogDescription>
              {selected?.client_name} · {selected?.company_name}
            </DialogDescription>
          </DialogHeader>
          {selected &&
            (action === "details" ? (
              <div className="space-y-4 text-sm">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["Installation ID", selected.installation_id],
                    ["Admin Email", selected.admin_email],
                    ["Admin Phone", selected.admin_phone || "—"],
                    ["CRM URL", selected.crm_url],
                    ["Start Date", licenseDate(selected.starts_at)],
                    ["Expiry Date", licenseDate(selected.expires_at)],
                    ["Status", statusLabels[installationStatus(selected)]],
                    [
                      "Installation Verification",
                      selected.configuration_verified ? "Verified" : "Not verified",
                    ],
                    [
                      "Admin Provisioning",
                      selected.admin_provisioned ? "Verified" : "Setup Required",
                    ],
                    [
                      "License Enforcement",
                      selected.enforcement_verified ? "Verified" : "Not configured",
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="break-all font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="border-t pt-4 font-semibold">Audit History</h3>
                {audit.isPending ? (
                  <p>Loading history…</p>
                ) : audit.isError ? (
                  <p role="alert">History could not be loaded.</p>
                ) : (
                  audit.data?.map((entry) => (
                    <div key={entry.id} className="border-b pb-2">
                      <p className="font-medium">
                        {entry.action === "create" ? "Installation recorded" : "Validity extended"}{" "}
                        · {licenseDate(entry.created_at)}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        Acting Super Admin: {entry.actor_id} ·{" "}
                        {new Date(entry.created_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                {action === "extend" ? (
                  <>
                    <label className="grid gap-1.5 font-medium">
                      Extend by
                      <select
                        className="inp"
                        value={years}
                        onChange={(e) => setYears(e.target.value === "2" ? 2 : 1)}
                      >
                        <option value="1">1 Year</option>
                        <option value="2">2 Years</option>
                      </select>
                    </label>
                    <p>
                      Current expiry: <b>{licenseDate(selected.expires_at)}</b>
                    </p>
                    <p>
                      Proposed expiry:{" "}
                      <b>{licenseDate(renewalExpiry(selected.expires_at, years))}</b>
                    </p>
                    <p className="text-muted-foreground">
                      A valid license extends from its current expiry; an expired license renews
                      from today. Saving validity does not activate access.
                    </p>
                  </>
                ) : (
                  <p className="rounded-md bg-muted p-3">
                    Setup Required. The independent customer installation and secure
                    provisioning/license enforcement connection are not configured. No Admin
                    invitation can be sent and actual access cannot be activated or suspended.
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>
                    Cancel
                  </Button>
                  {action === "extend" && (
                    <Button disabled={busy} onClick={confirm}>
                      {busy ? "Saving…" : "Confirm Extension"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
