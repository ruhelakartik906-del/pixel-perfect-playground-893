import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Breadcrumb, Card, EmptyState, PageHeader, StatusBadge } from "./ui";
import { deletePlan, savePlan } from "@/lib/customers.functions";
import { plansQuery } from "./CustomerDetail";
import { FEATURE_KEYS, FEATURE_LABELS, LIMIT_KEYS, LIMIT_LABELS, type OrgLimits, type PlanRow } from "@/lib/org-features";

type Draft = { id: string | null; name: string; description: string; limits: OrgLimits; features: Record<string, boolean> };

const emptyDraft = (): Draft => ({ id: null, name: "", description: "", limits: {}, features: {} });

export function Plans() {
  const { data: plans } = useSuspenseQuery(plansQuery);
  const qc = useQueryClient();
  const save = useServerFn(savePlan);
  const remove = useServerFn(deletePlan);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlanRow | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(plan: PlanRow) {
    setDraft({ id: plan.id, name: plan.name, description: plan.description, limits: plan.limits, features: plan.features });
  }

  async function submit() {
    if (!draft) return;
    if (!draft.name.trim()) { toast.error("Plan name is required"); return; }
    setBusy(true);
    try {
      await save({ data: { id: draft.id, name: draft.name, description: draft.description, limits: draft.limits, features: draft.features } });
      toast.success(draft.id ? "Plan updated" : "Plan created");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function deleteNow() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await remove({ data: { plan_id: confirmDelete.id } });
      toast.success(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan could not be deleted");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Breadcrumb label="Plans" trail={["User Management", "All Users"]} />
      <PageHeader title="Plans" subtitle="Reusable feature and limit templates you can apply to any customer.">
        <Button variant="hero" onClick={() => setDraft(emptyDraft())}><Plus /> Create Plan</Button>
      </PageHeader>

      {plans.length === 0 ? (
        <Card><EmptyState title="No plans yet" hint="Create a plan to apply the same features and limits to many customers at once." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const enabled = FEATURE_KEYS.filter((k) => p.features[k] ?? true).length;
            return (
              <Card key={p.id} className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">{p.name}</h2>
                    {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  </div>
                  <StatusBadge tone={p.is_active ? "green" : "gray"}>{p.is_active ? "active" : "inactive"}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {enabled} of {FEATURE_KEYS.length} features enabled
                  {p.limits.max_employees ? ` · up to ${p.limits.max_employees} employees` : ""}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => edit(p)}><Pencil /> Edit</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDelete(p)}><Trash2 /> Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>Features and limits in this plan replace a customer's settings when applied.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <div>
                <Label htmlFor="plan-name" className="text-sm font-semibold">Plan Name</Label>
                <Input id="plan-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="plan-desc" className="text-sm font-semibold">Description</Label>
                <Input id="plan-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div>
                <p className="text-sm font-semibold">Features</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {FEATURE_KEYS.map((key) => (
                    <label key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span>{FEATURE_LABELS[key]}</span>
                      <Switch
                        checked={draft.features[key] ?? true}
                        onCheckedChange={(on) => setDraft({ ...draft, features: { ...draft.features, [key]: on } })}
                        aria-label={FEATURE_LABELS[key]}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Limits</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {LIMIT_KEYS.map((key) => (
                    <div key={key}>
                      <Label htmlFor={`plan-${key}`} className="text-xs">{LIMIT_LABELS[key]}</Label>
                      <Input
                        id={`plan-${key}`}
                        type="number"
                        min={1}
                        placeholder="No limit"
                        value={draft.limits[key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, limits: { ...draft.limits, [key]: e.target.value === "" ? null : Number(e.target.value) } })}
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                <Button variant="hero" disabled={busy} onClick={submit}>
                  {busy ? <Loader2 className="animate-spin" /> : <Plus />} {draft.id ? "Save Plan" : "Create Plan"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>Customers using this plan keep their current settings; the plan is simply no longer assignable.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={deleteNow}>Delete Plan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
