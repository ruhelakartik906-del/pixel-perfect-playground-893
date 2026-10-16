export type RoutingStep = { user: string; limit: number | null };

/** Returns who receives the nth (1-based) lead for a rule. null limit = unlimited overflow. */
export function assigneeFor(steps: RoutingStep[], n: number) {
  let used = 0;
  for (const s of steps) {
    if (s.limit === null || n <= used + s.limit) return s.user;
    used += s.limit;
  }
  return steps[steps.length - 1]?.user ?? "";
}
