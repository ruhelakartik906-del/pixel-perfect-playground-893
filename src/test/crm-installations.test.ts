import { describe, expect, it } from "vitest";
import {
  addLicenseYears,
  filterInstallations,
  installationChangeSchema,
  installationSchema,
  installationStatus,
  renewalExpiry,
  type Installation,
} from "@/lib/crm-installations";
const row = (extra: Partial<Installation> = {}): Installation => ({
  id: "1",
  installation_id: "RCRM-ONE",
  client_name: "Asha",
  company_name: "Acme",
  admin_email: "asha@example.test",
  admin_phone: "",
  crm_url: "https://acme.example.test",
  validity_years: 1,
  starts_at: "2026-10-24T06:00:00Z",
  expires_at: "2027-10-24T06:00:00Z",
  license_status: "setup_required",
  configuration_verified: false,
  enforcement_verified: false,
  admin_provisioned: false,
  created_by: "admin",
  created_at: "2026-10-24T06:00:00Z",
  updated_at: "2026-10-24T06:00:00Z",
  ...extra,
});
describe("Sold CRM license rules", () => {
  it("renewal accepts the persisted offset and preserves exact microseconds", () => {
    const expected_expiry = "2027-10-24T06:36:52.645402+00:00";
    expect(
      installationChangeSchema.parse({
        action: "extend",
        id: "11111111-1111-4111-8111-111111111111",
        validity_years: 1,
        expected_expiry,
      }).expected_expiry,
    ).toBe(expected_expiry);
  });
  it("1 year validity uses a calendar year", () =>
    expect(addLicenseYears("2026-10-24T06:00:00Z", 1)).toBe("2027-10-24T06:00:00.000Z"));
  it("2 year validity uses two calendar years", () =>
    expect(addLicenseYears("2026-10-24T06:00:00Z", 2)).toBe("2028-10-24T06:00:00.000Z"));
  it("leap-day expiry is clamped in Kolkata time", () =>
    expect(addLicenseYears("2024-02-28T20:00:00Z", 1)).toBe("2025-02-27T20:00:00.000Z"));
  it("nonexpired renewal extends existing expiry", () =>
    expect(renewalExpiry("2027-10-24T06:00:00Z", 2, new Date("2026-10-24T06:00:00Z"))).toBe(
      "2029-10-24T06:00:00.000Z",
    ));
  it("expired renewal starts at renewal time", () =>
    expect(renewalExpiry("2025-10-24T06:00:00Z", 1, new Date("2026-10-24T06:00:00Z"))).toBe(
      "2027-10-24T06:00:00.000Z",
    ));
  it("expiry blocks active display at the exact expiry", () =>
    expect(
      installationStatus(row({ license_status: "active" }), new Date("2027-10-24T06:00:00Z")),
    ).toBe("expired"));
  it("expiring soon includes only the next 30 days", () =>
    expect(
      filterInstallations(
        [
          row({ id: "within", expires_at: "2026-11-23T06:00:00Z" }),
          row({ id: "outside", expires_at: "2026-11-23T06:00:01Z" }),
          row({ id: "past", expires_at: "2026-10-24T06:00:00Z" }),
        ],
        "",
        "all",
        true,
        new Date("2026-10-24T06:00:00Z"),
      ).map((r) => r.id),
    ).toEqual(["within"]));
  it.each(["Asha", "Acme", "asha@example.test", "RCRM-ONE"])("search matches %s", (search) =>
    expect(filterInstallations([row()], search, "all", false)).toHaveLength(1),
  );
  it("status filters exclude unrelated records", () =>
    expect(filterInstallations([row()], "", "active", false)).toHaveLength(0));
  it("email is required because phone authentication is unavailable", () =>
    expect(
      installationSchema.safeParse({ ...row(), admin_email: "", admin_phone: "+919999999999" })
        .success,
    ).toBe(false));
  it.each([
    "http://crm.example.test",
    "https://crm.example.test/path",
    "https://user:secret@crm.example.test",
    "https://a..example.test",
    "https://a-.example.test",
  ])("rejects unsafe customer URL %s", (crm_url) =>
    expect(installationSchema.safeParse({ ...row(), crm_url }).success).toBe(false),
  );
});
