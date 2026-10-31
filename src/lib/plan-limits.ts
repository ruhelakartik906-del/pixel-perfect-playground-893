import { z } from "zod";
import { LIMIT_KEYS, type LimitKey, type OrgLimits } from "./org-features";

export type LimitMode = "default" | "custom" | "unlimited";
const amount = z.number().int().min(0).max(2147483647).nullable().optional();
export const planLimitsSchema = z.object(Object.fromEntries(LIMIT_KEYS.map(key => [key, amount])) as Record<LimitKey, typeof amount>).strict();
export function limitMode(limits: OrgLimits, key: LimitKey): LimitMode {
  return !Object.hasOwn(limits, key) ? "default" : limits[key] === null ? "unlimited" : "custom";
}
export function changeLimitMode(limits: OrgLimits, key: LimitKey, mode: LimitMode, fallback?: number | null): OrgLimits {
  const next = { ...limits };
  if (mode === "default") delete next[key];
  else next[key] = mode === "unlimited" ? null : (limits[key] ?? fallback ?? 0);
  return next;
}
export function effectiveLimits(defaults: OrgLimits, overrides: OrgLimits): OrgLimits { return { ...defaults, ...overrides }; }