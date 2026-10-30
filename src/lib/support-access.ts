// Browser-safe helpers for support access sessions. Display only — the database decides access.
export type SessionLike = { ended_at: string | null; revoked: boolean; expires_at: string; end_reason?: string | null };

export function sessionState(s: SessionLike, now = Date.now()): "live" | "expired" | "exited" | "revoked" {
  if (s.revoked || s.end_reason === "revoked") return "revoked";
  if (s.end_reason === "expired") return "expired";
  if (s.ended_at) return "exited";
  return new Date(s.expires_at).getTime() > now ? "live" : "expired";
}

export function remaining(expiresAt: string, now = Date.now()) {
  const ms = Math.max(0, new Date(expiresAt).getTime() - now);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${String(s).padStart(2, "0")}` };
}
