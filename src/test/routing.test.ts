import { describe, expect, it } from "vitest";
import { assigneeFor } from "@/lib/routing";

describe("lead routing quotas", () => {
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
