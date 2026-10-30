import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePending } from "@/components/auth/RouteStates";

// Revalidate the auth token with the server at most once per minute. Between checks the
// local session is enough for routing: every real data read/write is still enforced by
// backend RLS, and SIGNED_OUT in __root invalidates the router immediately.
const AUTH_CHECK_TTL_MS = 60_000;
let lastVerified: { userId: string; at: number } | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const now = Date.now();
    let authed = false;
    if (lastVerified && now - lastVerified.at < AUTH_CHECK_TTL_MS) {
      const { data: { session } } = await supabase.auth.getSession();
      authed = Boolean(session?.user && session.user.id === lastVerified.userId);
      if (!authed) lastVerified = null;
    } else {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        lastVerified = { userId: data.user.id, at: now };
        authed = true;
      } else {
        lastVerified = null;
      }
    }
    if (!authed) {
      if (location.pathname.startsWith("/admin")) throw redirect({ to: "/admin/login" });
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  pendingComponent: RoutePending,
  pendingMs: 0,
  component: () => <Outlet />,
});
