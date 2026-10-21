import { describe, expect, it } from "vitest";
import { companyRecipients, manualLeads, unassignedLeads } from "@/lib/routing-records";

const assigned = { id: "assigned", intake_source: "manual", assigned_to: "client", created_at: "2026-10-21T12:00:00Z" };
const unassigned = { id: "unassigned", intake_source: "manual", assigned_to: null, created_at: "2026-10-21T13:00:00Z" };
const facebook = { id: "facebook", intake_source: "facebook", assigned_to: "employee", created_at: "2026-10-21T14:00:00Z" };

describe("Admin routing record selection", () => {
  it("Manual Leads includes assigned and unassigned manual records only", () => {
    expect(manualLeads([assigned, facebook, unassigned]).map(lead => lead.id)).toEqual(["unassigned", "assigned"]);
  });
  it("Unassigned includes legacy leads without queue entries and excludes assigned leads", () => {
    expect(unassignedLeads([assigned, unassigned, facebook]).map(lead => lead.id)).toEqual(["unassigned"]);
  });
  it("a later assignment leaves Manual Leads but disappears from Unassigned after reread", () => {
    const refreshed = { ...unassigned, assigned_to: "employee" };
    expect(unassignedLeads([refreshed])).toEqual([]);
    expect(manualLeads([refreshed])).toEqual([refreshed]);
  });
  it("rule users require selection of their own company", () => {
    const recipients = [{ company_id: "a", user_id: "employee-a" }, { company_id: "b", user_id: "employee-b" }];
    expect(companyRecipients(recipients, "")).toEqual([]);
    expect(companyRecipients(recipients, "a")).toEqual([recipients[0]]);
    expect(companyRecipients(recipients, "b")).toEqual([recipients[1]]);
  });
});