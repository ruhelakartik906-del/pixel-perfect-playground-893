import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePending } from "@/components/auth/RouteStates";
import { checkRouteAuth } from "@/lib/auth-check-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const authed = await checkRouteAuth({
      getSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return { userId: session?.user.id ?? null, expiresAt: session?.expires_at ?? null };
      },
      getUser: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (!authed) {
      if (location.pathname.startsWith("/admin")) throw redirect({ to: "/admin/login" });
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  pendingComponent: RoutePending,
  pendingMs: 0,
  component: () => <Outlet />,
});
