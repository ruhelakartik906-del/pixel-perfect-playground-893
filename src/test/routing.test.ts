import { describe, expect, it } from "vitest";
import { assigneeFor, validateAllocations } from "@/lib/routing";

describe("lead routing quotas", () => {
  it("Video A: first 5 to A, next 10 to D, remaining to C", () => {
    const steps = [{ user: "A", limit: 5 }, { user: "D", limit: 10 }, { user: "C", limit: null }];
    expect(assigneeFor(steps, 5)).toBe("A");
    expect(assigneeFor(steps, 6)).toBe("D");
    expect(assigneeFor(steps, 15)).toBe("D");
    expect(assigneeFor(steps, 16)).toBe("C");
  });
  it("exhausted fixed quotas leave the lead unassigned", () => {
    expect(assigneeFor([{ user: "A", limit: 5 }], 6)).toBe("");
  });
  it("supports unlimited sequential allocation steps", () => {
    const steps = Array.from({ length: 50 }, (_, i) => ({ user: String(i), limit: 1 }));
    expect(assigneeFor(steps, 50)).toBe("49");
    expect(assigneeFor(steps, 51)).toBe("");
  });
  it("rejects zero or negative quotas", () => {
    expect(validateAllocations([{ user_id: "A", quota: 0 }])).toBe("Quotas must be positive whole numbers");
    expect(validateAllocations([{ user_id: "A", quota: -1 }])).toBe("Quotas must be positive whole numbers");
  });
  it("unlimited fallback must be last", () => {
    expect(validateAllocations([{ user_id: "A", quota: null }, { user_id: "B", quota: 5 }])).toBe("Unlimited must be the last step");
  });
  it("Video Ad A: first 5 to User A, then User D", () => {
    const steps = [{ user: "A", limit: 5 }, { user: "D", limit: null }];
    expect(assigneeFor(steps, 5)).toBe("A");
    expect(assigneeFor(steps, 6)).toBe("D");
    expect(assigneeFor(steps, 50)).toBe("D");
  });
  it("Video Ad C: 10 to B, next 10 to E, then F", () => {
    const steps = [{ user: "B", limit: 10 }, { user: "E", limit: 10 }, { user: "F", limit: null }];
    expect(assigneeFor(steps, 10)).toBe("B");
    expect(assigneeFor(steps, 11)).toBe("E");
    expect(assigneeFor(steps, 20)).toBe("E");
    expect(assigneeFor(steps, 21)).toBe("F");
  });
});
