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
  allowedActions,
  filterInstallations,
  remainingDays,
  installationStatus,
  licenseDate,
  renewalExpiry,
  statusLabels,
  type Installation,
  type LicenseAction,
} from "@/lib/crm-installations";

type Action = "details" | LicenseAction;
const actionTitles: Record<LicenseAction, string> = {
  activate: "Activate License",
  suspend: "Suspend License",
  resume: "Resume License",
  renew: "Renew License",
  rotate: "Rotate Installation Credential",
};
const auditLabels: Record<string, string> = {
  create: "Installation registered",
  activate: "License activated",
  suspend: "License suspended",
  resume: "License resumed",
  renew: "License renewed",
  extend: "Validity extended",
  rotate: "Credential rotated",
};
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
  const [credential, setCredential] = useState("");
  const submitting = useRef(false);
  const audit = useQuery({
    queryKey: ["crm-installation-audit", selected?.id],
    queryFn: () => installationAudit({ data: { id: selected?.id ?? "" } }),
    enabled: !!selected && action === "details",
  });
  const list = filterInstallations(rows, search, status, soon).sort(
    (a, b) =>
      (new Date(a.valid_until ?? "9999-12-31").getTime() -
        new Date(b.valid_until ?? "9999-12-31").getTime()) *
      (sort === "asc" ? 1 : -1),
  );
  const pages = Math.max(1, Math.ceil(list.length / 20));
  const current = Math.min(page, pages - 1);
  const counts = { active: 0, suspended: 0, expired: 0, pending: 0 };
  for (const row of rows) {
    const s = installationStatus(row);
    if (s in counts) counts[s as keyof typeof counts]++;
  }
  function open(row: Installation, next: Action) {
    setSelected(row);
    setAction(next);
    setYears(1);
    setError("");
    setMessage("");
    setCredential("");
  }
  async function confirm() {
    if (!selected || action === "details" || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await change({
        data: {
          action,
          id: selected.id,
          validity_years: action === "renew" ? years : undefined,
          expected_updated_at: selected.updated_at,
        },
      });
      void qc.invalidateQueries({ queryKey: ["crm-installations"] }).catch(() => {});
      void qc.invalidateQueries({ queryKey: ["crm-installation-audit"] }).catch(() => {});
      if (result.credential) {
        setCredential(result.credential);
      } else {
        setSelected(null);
      }
      setMessage(`${actionTitles[action]} saved for ${selected.installation_id}.`);
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
      <p className="text-sm text-muted-foreground">
        Pending (not yet activated): <b>{counts.pending}</b> · Customer installations re-check
        their license at least every 60 seconds and before every change.
      </p>
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
              "Activated",
              "Expiry Date",
              "Remaining",
              "Validity",
              "Last Verified",
              "Status",
              "Actions",
            ]}
            minWidth={1800}
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
                <td className="whitespace-nowrap px-4 py-3">{licenseDate(row.activated_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">{licenseDate(row.valid_until)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {remainingDays(row) === null ? "—" : `${remainingDays(row)} days`}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.validity_years} Year{row.validity_years === 2 ? "s" : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.last_verified_at
                    ? new Date(row.last_verified_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "Never"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge
                    tone={
                      installationStatus(row) === "expired"
                        ? "red"
                        : installationStatus(row) === "active"
                          ? "blue"
                          : installationStatus(row) === "suspended"
                            ? "orange"
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
                      {allowedActions(row).map((next) => (
                        <DropdownMenuItem key={next} onClick={() => open(row, next)}>
                          {next === "renew" ? "Renew License" : actionTitles[next]}
                        </DropdownMenuItem>
                      ))}
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
                : actionTitles[action]}
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
                    ["Contact Name", selected.client_name],
                    ["Activation Date", licenseDate(selected.activated_at)],
                    ["Expiry Date", licenseDate(selected.valid_until)],
                    ["Remaining", remainingDays(selected) === null ? "Not activated" : `${remainingDays(selected)} days`],
                    ["License Duration", `${selected.validity_years} Year${selected.validity_years === 2 ? "s" : ""}`],
                    ["Status", statusLabels[installationStatus(selected)]],
                    ["Registered", licenseDate(selected.created_at)],
                    ["Last Renewal", licenseDate(selected.last_renewed_at)],
                    [
                      "Last Successful Verification",
                      selected.last_verified_at
                        ? new Date(selected.last_verified_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                        : "Never",
                    ],
                    ["Credential Last Issued", licenseDate(selected.credential_rotated_at)],
                    ["Internal Notes", selected.notes || "—"],
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
                        {auditLabels[entry.action] ?? entry.action}{" "}
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
                {credential ? (
                  <CredentialNotice installationId={selected.installation_id} credential={credential} />
                ) : action === "renew" ? (
                  <>
                    <label className="grid gap-1.5 font-medium">
                      Renew for
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
                      Current expiry: <b>{licenseDate(selected.valid_until)}</b>
                    </p>
                    <p>
                      New expiry: <b>{licenseDate(renewalExpiry(selected.valid_until, years))}</b>
                    </p>
                    <p className="text-muted-foreground">
                      Remaining valid time is kept; an expired license renews from today. Renewal
                      does not change a suspension.
                    </p>
                  </>
                ) : (
                  <p className="rounded-md bg-muted p-3">
                    {action === "activate" &&
                      `Starts the ${selected.validity_years}-year term now. The customer CRM gets access on its next license check.`}
                    {action === "suspend" &&
                      "The customer CRM will be blocked within 60 seconds. The expiry date is not changed."}
                    {action === "resume" &&
                      "Restores access with the existing expiry date."}
                    {action === "rotate" &&
                      "The current credential stops working immediately. The customer CRM stays blocked until the new credential is configured."}
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>
                    {credential ? "Done" : "Cancel"}
                  </Button>
                  {!credential && (
                    <Button
                      disabled={busy}
                      variant={action === "suspend" || action === "rotate" ? "destructive" : "default"}
                      onClick={confirm}
                    >
                      {busy ? "Saving…" : `Confirm ${actionTitles[action as LicenseAction]}`}
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

export function CredentialNotice({ installationId, credential }: { installationId: string; credential: string }) {
  return (
    <div role="status" className="space-y-2 rounded-md border border-admin-blue/30 bg-admin-blue/10 p-3">
      <p className="font-semibold">Copy this credential now — it is shown only once.</p>
      <p>
        Installation ID: <code className="break-all">{installationId}</code>
      </p>
      <p>
        Credential: <code className="break-all">{credential}</code>
      </p>
      <p className="text-muted-foreground">
        Add both to the customer CRM as private server settings (LICENSE_INSTALLATION_ID,
        LICENSE_CREDENTIAL). Never paste them into browser code or chat.
      </p>
    </div>
  );
}
