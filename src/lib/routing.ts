export type RoutingStep = { user: string; limit: number | null };

/** Returns who receives the nth (1-based) lead for a rule. null limit = unlimited overflow. */
export function assigneeFor(steps: RoutingStep[], n: number) {
  if (!Number.isInteger(n) || n < 1) return "";
  let used = 0;
  for (const s of steps) {
    if (s.limit === null || n <= used + s.limit) return s.user;
    used += s.limit;
  }
  return "";
}

export type Allocation = { id?: string | undefined; user_id: string; quota: number | null; assigned_count?: number };
export function validateAllocations(steps: Allocation[]) {
  if (!steps.length) return "Add at least one user";
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step?.user_id) return "Select a user for every step";
    if (step.quota !== null && (!Number.isInteger(step.quota) || step.quota <= 0)) return "Quotas must be positive whole numbers";
    if (step.quota === null && i !== steps.length - 1) return "Unlimited must be the last step";
  }
  return null;
}
