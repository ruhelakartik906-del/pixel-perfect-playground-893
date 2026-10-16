import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePending } from "@/components/auth/RouteStates";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (location.pathname.startsWith("/admin")) throw redirect({ to: "/admin/login" });
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  pendingComponent: RoutePending,
  pendingMs: 0,
  component: () => <Outlet />,
});
