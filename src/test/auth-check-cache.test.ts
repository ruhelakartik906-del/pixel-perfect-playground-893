import { beforeEach, describe, expect, it } from "vitest";
import { AUTH_CHECK_TTL_MS, checkRouteAuth, resetAuthCheckCache } from "@/lib/auth-check-cache";

const T = 1_800_000_000_000;
function deps(state: { session: string | null; exp?: number | null; server: string | null }) {
  const calls = { getUser: 0 };
  return {
    calls,
    d: {
      getSession: async () => ({ userId: state.session, expiresAt: state.exp ?? null }),
      getUser: async () => { calls.getUser++; return state.server; },
    },
  };
}

describe("route auth cache", () => {
  beforeEach(() => resetAuthCheckCache());

  it("skips the server check within 60s for the same session", async () => {
    const { d, calls } = deps({ session: "u1", server: "u1" });
    expect(await checkRouteAuth(d, T)).toBe(true);
    expect(await checkRouteAuth(d, T + 30_000)).toBe(true);
    expect(calls.getUser).toBe(1);
  });

  it("re-verifies with the server after the TTL and denies revoked sessions", async () => {
    const s = { session: "u1", server: "u1" as string | null };
    const { d } = deps(s);
    await checkRouteAuth(d, T);
    s.server = null;
    expect(await checkRouteAuth(d, T + AUTH_CHECK_TTL_MS)).toBe(false);
  });

  it("denies immediately after logout even inside the TTL", async () => {
    const s = { session: "u1" as string | null, server: "u1" as string | null };
    const { d } = deps(s);
    await checkRouteAuth(d, T);
    s.session = null; s.server = null;
    expect(await checkRouteAuth(d, T + 1_000)).toBe(false);
  });

  it("never reuses one user's verification for a different account", async () => {
    const s = { session: "u1", server: "u1" };
    const { d, calls } = deps(s);
    await checkRouteAuth(d, T);
    s.session = "u2"; s.server = "u2";
    expect(await checkRouteAuth(d, T + 1_000)).toBe(true);
    expect(calls.getUser).toBe(2);
  });

  it("re-checks the server when the local token has expired", async () => {
    const s = { session: "u1", exp: (T + 5_000) / 1000, server: "u1" as string | null };
    const { d } = deps(s);
    await checkRouteAuth(d, T);
    s.server = null;
    expect(await checkRouteAuth(d, T + 10_000)).toBe(false);
  });

  it("reset (sign-in/out events) forces a fresh server check", async () => {
    const { d, calls } = deps({ session: "u1", server: "u1" });
    await checkRouteAuth(d, T);
    resetAuthCheckCache();
    await checkRouteAuth(d, T + 1_000);
    expect(calls.getUser).toBe(2);
  });
});
