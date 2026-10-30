import { describe, expect, it } from "vitest";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  ROUTE_FEATURES,
  featureEnabled,
  type FeatureKey,
} from "@/lib/org-features";

describe("org feature gating", () => {
  it("defaults to enabled when no permission row exists", () => {
    expect(featureEnabled({}, "leads")).toBe(true);
    expect(featureEnabled(null, "whatsapp")).toBe(true);
    expect(featureEnabled(undefined, "reports")).toBe(true);
  });

  it("blocks only explicitly disabled features", () => {
    const features = { leads: false, whatsapp: true };
    expect(featureEnabled(features, "leads")).toBe(false);
    expect(featureEnabled(features, "whatsapp")).toBe(true);
    expect(featureEnabled(features, "deals")).toBe(true);
  });

  it("maps every gated destination to a valid feature key", () => {
    for (const key of Object.values(ROUTE_FEATURES)) {
      expect(FEATURE_KEYS).toContain(key);
    }
  });

  it("gates the expected workspace destinations", () => {
    expect(ROUTE_FEATURES["/all-assigned"]).toBe("leads");
    expect(ROUTE_FEATURES["/my-leads"]).toBe("leads");
    expect(ROUTE_FEATURES["/lead-status"]).toBe("leads");
    expect(ROUTE_FEATURES["/pipeline"]).toBe("pipeline");
    expect(ROUTE_FEATURES["/proposals"]).toBe("quotations");
    expect(ROUTE_FEATURES["/invoices"]).toBe("invoices");
    expect(ROUTE_FEATURES["/deals"]).toBe("deals");
    expect(ROUTE_FEATURES["/tasks"]).toBe("tasks");
    expect(ROUTE_FEATURES["/follow-ups"]).toBe("tasks");
    expect(ROUTE_FEATURES["/my-work-table"]).toBe("tasks");
    expect(ROUTE_FEATURES["/my-reports"]).toBe("reports");
    expect(ROUTE_FEATURES["/whatsapp/chats"]).toBe("whatsapp");
    expect(ROUTE_FEATURES["/whatsapp/templates"]).toBe("whatsapp_templates");
  });

  it("keeps personal destinations ungated", () => {
    const gated = Object.keys(ROUTE_FEATURES);
    for (const open of ["/dashboard", "/calendar", "/my-hr", "/team-chat", "/support", "/settings"]) {
      expect(gated).not.toContain(open);
    }
  });

  it("has a label for every feature key", () => {
    for (const key of FEATURE_KEYS) {
      expect(FEATURE_LABELS[key as FeatureKey].length).toBeGreaterThan(0);
    }
  });
});
