import { describe, expect, it } from "vitest";
import { changeLimitMode, effectiveLimits, limitMode, planLimitsSchema } from "@/lib/plan-limits";
import { LIMIT_KEYS } from "@/lib/org-features";

describe("Plan limit rules", () => {
  it.each(LIMIT_KEYS)("%s supports explicit unlimited", key => {
    const value = changeLimitMode({}, key, "unlimited");
    expect(value[key]).toBeNull();
    expect(limitMode(value, key)).toBe("unlimited");
    expect(planLimitsSchema.parse(value)[key]).toBeNull();
  });
  it.each(LIMIT_KEYS)("%s distinguishes zero from unlimited", key => {
    expect(planLimitsSchema.parse({ [key]: 0 })[key]).toBe(0);
    expect(limitMode({ [key]: 0 }, key)).toBe("custom");
  });
  it("default preserves the configured plan value", () => {
    const overrides = changeLimitMode({ max_leads: 9 }, "max_leads", "default");
    expect(Object.hasOwn(overrides, "max_leads")).toBe(false);
    expect(effectiveLimits({ max_leads: 4 }, overrides).max_leads).toBe(4);
  });
  it("customer overrides survive a change of plan", () => {
    expect(effectiveLimits({ max_leads: 3, max_employees: 8 }, { max_leads: null, max_employees: 0 })).toEqual({ max_leads: null, max_employees: 0 });
  });
  it.each([-1, 1.5, Infinity, 2147483648])("rejects invalid numeric amount %s", value => {
    expect(planLimitsSchema.safeParse({ max_leads: value }).success).toBe(false);
  });
});