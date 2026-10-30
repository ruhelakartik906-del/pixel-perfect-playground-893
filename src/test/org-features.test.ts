import { describe, expect, it } from "vitest";
import { customerStatus, daysUntilExpiry, FEATURE_KEYS, LIMIT_KEYS } from "@/lib/org-features";

describe("customerStatus", () => {
  it("treats companies without a subscription row as active (legacy default)", () => {
    expect(customerStatus(null)).toBe("active");
    expect(customerStatus(undefined)).toBe("active");
  });
  it("passes through suspended and active statuses", () => {
    expect(customerStatus({ status: "suspended", expires_at: null })).toBe("suspended");
    expect(customerStatus({ status: "active", expires_at: null })).toBe("active");
  });
  it("marks an active subscription past its expiry as expired", () => {
    expect(customerStatus({ status: "active", expires_at: "2020-01-01T00:00:00Z" })).toBe("expired");
    expect(customerStatus({ status: "active", expires_at: "2999-01-01T00:00:00Z" })).toBe("active");
  });
  it("keeps suspended status even when expiry has passed", () => {
    expect(customerStatus({ status: "suspended", expires_at: "2020-01-01T00:00:00Z" })).toBe("suspended");
  });
});

describe("daysUntilExpiry", () => {
  it("returns null without an expiry date", () => {
    expect(daysUntilExpiry(null)).toBeNull();
    expect(daysUntilExpiry(undefined)).toBeNull();
  });
  it("returns a positive day count for future dates", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    expect(daysUntilExpiry(future)).toBe(10);
  });
});

describe("catalogs", () => {
  it("covers the brief's CRM, WhatsApp, chatbot, flow, drip and integration features", () => {
    for (const key of ["leads", "contacts", "companies", "pipeline", "deals", "tasks", "quotations", "invoices", "payments", "products", "whatsapp", "chatbots", "flows", "drip_campaigns", "integrations"]) {
      expect(FEATURE_KEYS).toContain(key);
    }
  });
  it("covers the brief's usage limits", () => {
    for (const key of ["max_employees", "max_leads", "monthly_whatsapp_messages", "max_whatsapp_numbers", "max_chatbots", "max_workflows", "max_drip_campaigns"]) {
      expect(LIMIT_KEYS).toContain(key);
    }
  });
});
