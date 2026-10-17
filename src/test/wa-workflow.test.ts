import { describe, expect, it } from "vitest";
import { deliveryRate, normalizePhone, validateWorkflow, type WfNode } from "@/lib/wa-workflow";

const end: WfNode = { id: "e", type: "end", config: {}, next: null };

describe("workflow validation", () => {
  it("accepts a simple template → end flow", () => {
    const nodes: WfNode[] = [{ id: "a", type: "send_template", config: { template_id: "t1" }, next: "e" }, end];
    expect(validateWorkflow({ name: "Welcome", trigger: "lead_created", nodes }, ["t1"])).toEqual([]);
  });
  it("requires both branches on a condition", () => {
    const nodes: WfNode[] = [{ id: "c", type: "condition", config: { field: "status", value: "open" }, next: "e", no: null }, end];
    expect(validateWorkflow({ name: "x", trigger: "manual", nodes })).toContain("Step 1 (Condition) needs both Yes and No branches");
  });
  it("rejects loops", () => {
    const nodes: WfNode[] = [{ id: "a", type: "wait", config: { minutes: "5" }, next: "b" }, { id: "b", type: "wait", config: { minutes: "5" }, next: "a" }, end];
    const e = validateWorkflow({ name: "x", trigger: "manual", nodes });
    expect(e.some((m) => m.includes("loop"))).toBe(true);
  });
  it("rejects a template step without a saved template", () => {
    const nodes: WfNode[] = [{ id: "a", type: "send_template", config: { template_id: "zzz" }, next: "e" }, end];
    expect(validateWorkflow({ name: "x", trigger: "manual", nodes }, ["t1"])).toContain("Step 1 (Send WhatsApp Template) needs a saved template");
  });
});

describe("broadcast helpers", () => {
  it("delivery rate is 0 when nothing sent", () => { expect(deliveryRate(0, 0)).toBe(0); expect(deliveryRate(200, 150)).toBe(75); });
  it("normalizes Indian numbers", () => { expect(normalizePhone("+91 98765-43210")).toBe("919876543210"); expect(normalizePhone("9876543210")).toBe("919876543210"); });
});
