import { describe, expect, it } from "vitest";
import { missingDefaults, workflowStats, defaultWorkflows } from "@/lib/automation";

describe("automation stats", () => {
  it("success rate is null with no executions (never invented)", () => {
    expect(workflowStats([{ status: "active", is_default: false }], []).successRate).toBeNull();
  });
  it("counts active/paused/custom and success rate", () => {
    const s = workflowStats(
      [{ status: "active", is_default: true }, { status: "paused", is_default: false }],
      [{ status: "success" }, { status: "failed" }, { status: "success" }, { status: "success" }],
    );
    expect(s).toEqual({ active: 1, paused: 1, custom: 1, executions: 4, successRate: 75 });
  });
  it("generate defaults skips existing names", () => {
    expect(missingDefaults([defaultWorkflows[0]!.name]).length).toBe(defaultWorkflows.length - 1);
  });
});
