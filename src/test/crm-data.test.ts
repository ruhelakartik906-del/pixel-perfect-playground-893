import { describe, expect, it } from "vitest";
import { filterLeads, guessMapping, prepareImport } from "@/lib/crm-data";

describe("report filters", () => {
  const rows = [
    { created_at: "2026-10-01T10:00:00", source_id: "fb", status: "open", assigned_to: "u1" },
    { created_at: "2026-10-10T10:00:00", source_id: "web", status: "won", assigned_to: null },
  ];
  it("filters by date range", () => expect(filterLeads(rows, { from: "2026-10-05", to: "2026-10-31" })).toHaveLength(1));
  it("filters unassigned leads", () => expect(filterLeads(rows, { assignee: "unassigned" })[0]!.source_id).toBe("web"));
  it("filters by source and status", () => expect(filterLeads(rows, { sourceId: "fb", status: "won" })).toHaveLength(0));
});

describe("lead import", () => {
  const map = guessMapping(["Name", "Mobile", "Email"]);
  it("maps common headers", () => expect(map).toMatchObject({ customer_name: "Name", phone: "Mobile", email: "Email" }));
  it("flags duplicates against existing leads and within the file", () => {
    const res = prepareImport([
      { Name: "A", Mobile: "+91 98765 43210", Email: "" },
      { Name: "B", Mobile: "9876543210", Email: "" },
      { Name: "C", Mobile: "9000000000", Email: "c@x.com" },
    ], map, [{ phone: "", email: "C@x.com" }]);
    expect(res.map((r) => r.duplicate)).toEqual([false, true, true]);
  });
  it("rejects rows without name or valid phone", () => {
    const [r] = prepareImport([{ Name: "", Mobile: "12", Email: "bad" }], map, []);
    expect(r!.errors).toEqual(["Customer name missing", "Invalid phone", "Invalid email"]);
  });
});
