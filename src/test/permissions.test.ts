import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, canDeleteRole, summarize, validTemplateName } from "@/lib/permissions";

describe("permissions", () => {
  it("catalog has view/create/edit/delete for each module", () => {
    expect(ALL_PERMISSIONS).toContain("lead.delete");
    expect(ALL_PERMISSIONS.length % 4).toBe(0);
  });
  it("summarizes first three modules and counts the rest", () => {
    const r = summarize(["deal.view", "lead.view", "lead.edit", "task.view", "invoice.view", "user.view"]);
    expect(r.shown).toEqual(["lead", "deal", "task"]);
    expect(r.more).toBe(2);
  });
  it("blocks deleting a role that still has users", () => {
    expect(canDeleteRole(1)).toBe(false);
    expect(canDeleteRole(0)).toBe(true);
  });
  it("enforces Meta template naming", () => {
    expect(validTemplateName("order_update_1")).toBe(true);
    expect(validTemplateName("Order Update")).toBe(false);
  });
});
