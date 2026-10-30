// Routing-only cache for the _authenticated gate. It never authorizes data: every server
// function re-validates the bearer (requireSupabaseAuth) and every table read/write is RLS-checked.
export const AUTH_CHECK_TTL_MS = 60_000;

type Verified = { userId: string; at: number };
let lastVerified: Verified | null = null;

export function resetAuthCheckCache() {
  lastVerified = null;
}

export async function checkRouteAuth(
  deps: {
    getSession: () => Promise<{ userId: string | null; expiresAt: number | null }>;
    getUser: () => Promise<string | null>;
  },
  now = Date.now(),
): Promise<boolean> {
  if (lastVerified && now - lastVerified.at < AUTH_CHECK_TTL_MS) {
    const s = await deps.getSession();
    const notExpired = s.expiresAt === null || s.expiresAt * 1000 > now;
    if (s.userId && s.userId === lastVerified.userId && notExpired) return true;
    lastVerified = null;
  }
  const userId = await deps.getUser();
  lastVerified = userId ? { userId, at: now } : null;
  return Boolean(userId);
}
