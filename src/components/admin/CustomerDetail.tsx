import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PauseCircle, PlayCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Breadcrumb, Card, PageHeader, StatusBadge } from "./ui";
import {
  assignPlan, customerDetail, listPlans, saveCustomerFeatures, saveCustomerLimits, setCustomerStatus,
} from "@/lib/customers.functions";
import {
  FEATURE_KEYS, FEATURE_LABELS, LIMIT_KEYS, LIMIT_LABELS, daysUntilExpiry, type OrgLimits,
} from "@/lib/org-features";

export const customerDetailQuery = (companyId: string) => queryOptions({
  queryKey: ["admin-customer", companyId],
  queryFn: () => customerDetail({ data: { company_id: companyId } }),
  staleTime: 15_000,
});

export const plansQuery = queryOptions({
  queryKey: ["admin-plans"],
  queryFn: () => listPlans(),
  staleTime: 30_000,
});

const statusTone = { active: "green", suspended: "orange", expired: "red" } as const;

export function CustomerDetail({ companyId }: { companyId: string }) {
  const { data } = useSuspenseQuery(customerDetailQuery(companyId));
  const { data: plans } = useSuspenseQuery(plansQuery);
  const qc = useQueryClient();
  const saveFeatures = useServerFn(saveCustomerFeatures);
  const saveLimits = useServerFn(saveCustomerLimits);
  const changeStatus = useServerFn(setCustomerStatus);
  const assign = useServerFn(assignPlan);
  const [features, setFeatures] = useState<Record<string, boolean>>(data.features);
  const [limits, setLimits] = useState<OrgLimits>(data.limits);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-customer", companyId] });

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The change could not be saved");
    } finally {
      setBusy(false);
    }
  }

  const sub = data.subscription;
  const status = sub?.status ?? "active";
  const days = daysUntilExpiry(sub?.expires_at);
  const maxEmployees = limits.max_employees ?? null;

  return (
    <div className="grid gap-5">
      <Breadcrumb label={data.company.name} trail={["User Management", "All Users"]} />
      <PageHeader title={data.company.name} subtitle={`${data.company.email || "No email"} · Registered ${new Date(data.company.created_at).toLocaleDateString("en-IN")}`}>
        {status === "suspended" ? (
          <Button variant="hero" disabled={busy} onClick={() => run(() => changeStatus({ data: { company_id: companyId, status: "active" } }), "Customer activated")}>
            <PlayCircle /> Activate
          </Button>
        ) : (
          <Button variant="outline" disabled={busy} onClick={() => run(() => changeStatus({ data: { company_id: companyId, status: "suspended" } }), "Customer suspended")}>
            <PauseCircle /> Suspend
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-bold">Subscription</h2>
          <div className="mt-4 grid gap-3 text-[15px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge tone={statusTone[status]}>{status}</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-semibold">{sub?.plan_name ?? "No plan assigned"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Term</span>
              <span>{sub ? `${sub.term_months} months` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span>
                {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"}
                {days !== null && days >= 0 && status === "active" && <span className="ml-2 text-xs font-semibold text-warning">{days}d left</span>}
              </span>
            </div>
          </div>
          <div className="mt-5">
            <label className="text-sm font-semibold">Assign plan</label>
            <div className="mt-1.5 flex gap-2">
              <select id="plan-select" className="h-11 flex-1 rounded-md border bg-card px-3 text-sm" defaultValue="">
                <option value="" disabled>Select a plan</option>
                {plans.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button disabled={busy} onClick={() => {
                const select = document.getElementById("plan-select") as HTMLSelectElement | null;
                if (!select?.value) { toast.error("Select a plan first"); return; }
                void run(() => assign({ data: { company_id: companyId, plan_id: select.value } }), "Plan assigned");
              }}>Apply</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Applying a plan replaces this customer's features and limits with the plan defaults.</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold">Employees</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.members.length} employee{data.members.length === 1 ? "" : "s"}
            {maxEmployees !== null && ` · limit ${maxEmployees} · ${Math.max(0, maxEmployees - data.members.length)} remaining`}
          </p>
          <ul className="mt-4 divide-y">
            {data.members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-2.5 text-[15px]">
                <div>
                  <div className="font-semibold">{m.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.roles.join(", ") || "—"}</span>
                  <StatusBadge tone={m.account_status === "active" ? "green" : m.account_status === "blocked" ? "red" : "orange"}>
                    {m.account_status}
                  </StatusBadge>
                </div>
              </li>
            ))}
            {data.members.length === 0 && <li className="py-3 text-sm text-muted-foreground">No employees yet.</li>}
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Plan & Permissions</h2>
          <Button disabled={busy} onClick={() => run(() => saveFeatures({ data: { company_id: companyId, features } }), "Permissions saved")}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} Save Permissions
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Disabled features are hidden and their requests are rejected for this customer. Data is preserved.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-[15px] font-medium">{FEATURE_LABELS[key]}</span>
              <Switch
                checked={features[key] ?? true}
                onCheckedChange={(on) => setFeatures((f) => ({ ...f, [key]: on }))}
                aria-label={FEATURE_LABELS[key]}
              />
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Usage Limits</h2>
          <Button disabled={busy} onClick={() => run(() => saveLimits({ data: { company_id: companyId, limits } }), "Limits saved")}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} Save Limits
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Leave a field empty for no limit. Limits are enforced by the backend.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {LIMIT_KEYS.map((key) => (
            <div key={key}>
              <label className="text-sm font-semibold" htmlFor={`limit-${key}`}>{LIMIT_LABELS[key]}</label>
              <Input
                id={`limit-${key}`}
                type="number"
                min={1}
                value={limits[key] ?? ""}
                onChange={(e) => setLimits((l) => ({ ...l, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
                className="mt-1.5 h-11 rounded-xl"
                placeholder="No limit"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
