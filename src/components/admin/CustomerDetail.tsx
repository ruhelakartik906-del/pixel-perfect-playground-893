import { useEffect, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PauseCircle, PlayCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Breadcrumb, Card, PageHeader, StatusBadge } from "./ui";
import { SupportAccessCard } from "./SupportAccessCard";
import { LimitEditor } from "./LimitEditor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [features, setFeatures] = useState<Record<string, boolean>>(data.feature_overrides);
  const [limits, setLimits] = useState<OrgLimits>(data.limit_overrides);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [confirmAssignment, setConfirmAssignment] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setFeatures(data.feature_overrides); setLimits(data.limit_overrides); }, [data]);
  const assignedPlan = plans.find(p => p.id === data.subscription?.plan_id);

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
  const maxEmployees = data.limits.max_employees ?? null;

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
              <select aria-label="Assign plan" id="plan-select" className="h-11 min-w-0 flex-1 rounded-md border bg-card px-3 text-sm" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                <option value="" disabled>Select a plan</option>
                {plans.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button disabled={busy} onClick={() => {
                if (!selectedPlan) { toast.error("Select a plan first"); return; }
                setConfirmAssignment(true);
              }}>Apply</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Customer overrides and subscription dates are preserved.</p>
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

      <SupportAccessCard companyId={companyId} />



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
            <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3">
              <span className="text-[15px] font-medium">{FEATURE_LABELS[key]}<span className="block text-xs text-muted-foreground">{Object.hasOwn(features, key) ? "Customer override" : "Plan default"}</span></span>
              <Switch
                checked={features[key] ?? assignedPlan?.features[key] ?? true}
                onCheckedChange={(on) => setFeatures((f) => ({ ...f, [key]: on }))}
                aria-label={FEATURE_LABELS[key]}
              />
              {Object.hasOwn(features, key) && <Button variant="ghost" size="sm" onClick={() => setFeatures(f => { const next = { ...f }; delete next[key]; return next; })}>Reset to default</Button>}
            </div>
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
        <div className="mt-4"><LimitEditor value={limits} defaults={assignedPlan?.limits} onChange={setLimits} disabled={busy} /></div>
      </Card>
      <Dialog open={confirmAssignment} onOpenChange={setConfirmAssignment}><DialogContent><DialogHeader><DialogTitle>Apply {plans.find(p => p.id === selectedPlan)?.name}?</DialogTitle><DialogDescription>Customer-specific overrides, subscription dates and status remain unchanged. Settings without overrides use the selected plan.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmAssignment(false)}>Cancel</Button><Button disabled={busy} onClick={() => void run(async () => { await assign({ data: { company_id: companyId, plan_id: selectedPlan } }); setConfirmAssignment(false); }, "Plan assigned")}>Apply plan</Button></div></DialogContent></Dialog>
    </div>
  );
}
