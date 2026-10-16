import { describe, expect, it } from "vitest";
import { setupCodeMatches } from "@/lib/admin-setup";

describe("setupCodeMatches", () => {
  it("accepts the exact configured code", () => {
    expect(setupCodeMatches("routiva-owner-2026", "routiva-owner-2026")).toBe(true);
  });
  it("rejects a wrong code", () => {
    expect(setupCodeMatches("routiva-owner-2025", "routiva-owner-2026")).toBe(false);
  });
  it("rejects when no code is configured", () => {
    expect(setupCodeMatches("", "")).toBe(false);
  });
});
