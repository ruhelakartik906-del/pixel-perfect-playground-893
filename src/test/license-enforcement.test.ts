import { describe, expect, it } from "vitest";
import {
  LICENSE_CACHE_MS,
  cachedDecisionUsable,
  readLicenseConfig,
  verifyWithMaster,
} from "@/lib/license-enforcement";
import {
  credentialPattern,
  generateInstallationCredential,
  hashInstallationCredential,
} from "@/lib/license-crypto";
import { allowedActions, installationStatus, remainingDays } from "@/lib/crm-installations";

const ID = "RCRM-" + "A".repeat(32);
const cfg = { mode: "customer" as const, installationId: ID, credential: "rlic_x", masterUrl: "https://master.example.test" };
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const now = "2026-10-28T10:00:00Z";

describe("license credentials", () => {
  it("are unique, high-entropy and hashed to 64 hex chars", async () => {
    const a = generateInstallationCredential();
    expect(credentialPattern.test(a)).toBe(true);
    expect(a).not.toBe(generateInstallationCredential());
    expect(await hashInstallationCredential(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("customer enforcement", () => {
  it("Master mode is never blocked", async () => {
    expect(readLicenseConfig({}).mode).toBe("master");
    expect((await verifyWithMaster(readLicenseConfig({}))).allowed).toBe(true);
  });
  it("customer mode without configuration fails closed", async () => {
    expect((await verifyWithMaster(readLicenseConfig({ LICENSE_MODE: "customer" }))).allowed).toBe(false);
  });
  it("active answer for this installation allows access", async () => {
    const d = await verifyWithMaster(cfg, reply(200, { ok: true, installation_id: ID, status: "active", access_allowed: true, valid_until: "2027-10-28T10:00:00Z", server_time: now }));
    expect(d.allowed).toBe(true);
  });
  it.each(["suspended", "expired", "pending"])("%s license is blocked", async (status) => {
    const d = await verifyWithMaster(cfg, reply(200, { ok: true, installation_id: ID, status, access_allowed: false, valid_until: "2027-10-28T10:00:00Z", server_time: now }));
    expect(d.allowed).toBe(false);
  });
  it("answer for another installation is rejected", async () => {
    const d = await verifyWithMaster(cfg, reply(200, { ok: true, installation_id: "RCRM-" + "B".repeat(32), status: "active", access_allowed: true, valid_until: "2027-10-28T10:00:00Z", server_time: now }));
    expect(d.allowed).toBe(false);
  });
  it("invalid credential and network failure fail closed", async () => {
    expect((await verifyWithMaster(cfg, reply(401, { ok: false }))).status).toBe("invalid_credentials");
    const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect((await verifyWithMaster(cfg, broken)).allowed).toBe(false);
  });
  it("an active answer is trusted for at most 60 seconds", () => {
    const d = { allowed: true, status: "active", checkedAt: 0, validUntil: null };
    expect(cachedDecisionUsable(d, LICENSE_CACHE_MS - 1)).toBe(true);
    expect(cachedDecisionUsable(d, LICENSE_CACHE_MS)).toBe(false);
  });
});

describe("license states", () => {
  const at = new Date(now);
  it("pending has no validity and can only be activated", () => {
    const row = { license_status: "pending", valid_until: null };
    expect(remainingDays(row, at)).toBeNull();
    expect(allowedActions(row, at)).toEqual(["activate", "rotate"]);
  });
  it("an expired license cannot be resumed, only renewed", () => {
    const row = { license_status: "suspended", valid_until: "2026-10-01T00:00:00Z" };
    expect(installationStatus(row, at)).toBe("expired");
    expect(allowedActions(row, at)).not.toContain("resume");
  });
  it("active status field cannot override an elapsed expiry", () =>
    expect(installationStatus({ license_status: "active", valid_until: now }, at)).toBe("expired"));
});
