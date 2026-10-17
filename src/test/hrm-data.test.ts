import { describe, expect, it } from "vitest";
import { employeeMetrics } from "@/lib/hrm-data";

describe("employee metrics", () => {
  const leads = [
    { assigned_to: "u1", status: "open", created_at: "2026-10-01T00:00:00Z" },
    { assigned_to: "u1", status: "won", created_at: "2026-10-05T00:00:00Z" },
    { assigned_to: "u2", status: "open", created_at: "2026-10-05T00:00:00Z" },
  ];
  const deals = [{ assigned_to: "u1", status: "won", created_at: "2026-10-05T00:00:00Z" }];
  it("counts assigned, pending and won", () => {
    expect(employeeMetrics("u1", leads, deals)).toEqual({ assigned: 2, pending: 1, won: 1, openDeals: 0 });
  });
  it("respects date range", () => {
    expect(employeeMetrics("u1", leads, deals, "2026-10-03").assigned).toBe(1);
  });
});
