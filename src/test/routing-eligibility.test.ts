import { describe, expect, it } from "vitest";
import { eligibilityReason, personLabel } from "@/components/admin/AdRouting";

const data = (over: Partial<Parameters<typeof eligibilityReason>[0]> = {}) => ({
  companies: [{ id: "c1", name: "Co", is_active: true }],
  people: [{ id: "u1", full_name: "Jane", email: "jane@x.com", account_status: "active" }],
  excluded: [],
  ...over,
}) as unknown as Parameters<typeof eligibilityReason>[0];

describe("routing eligibility display", () => {
  it("shows name and email for dropdown labels", () => {
    expect(personLabel(data(), "u1")).toBe("Jane (jane@x.com)");
    expect(personLabel(data(), "missing")).toBe("Unknown user");
  });
  it("explains why a company has no eligible users instead of a blank dropdown", () => {
    expect(eligibilityReason(data(), "")).toContain("Select a company");
    expect(eligibilityReason(data(), "c1")).toContain("No team members");
    const withBlocked = data({ excluded: [{ company_id: "c1", user_id: "u2", reason: "account blocked" }] });
    expect(eligibilityReason(withBlocked, "c1")).toBe("No eligible users for this company: account blocked.");
    const withClient = data({ excluded: [{ company_id: "c1", user_id: "u3", reason: "client accounts cannot receive routed leads" }] });
    expect(eligibilityReason(withClient, "c1")).toContain("client accounts cannot receive routed leads");
  });
});
