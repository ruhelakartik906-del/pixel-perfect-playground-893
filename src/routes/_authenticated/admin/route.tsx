import { useState } from "react";
import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Menu, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { titleForPath } from "@/components/admin/nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
    return { adminEmail: u.user.email ?? "", adminName: (u.user.user_metadata?.full_name as string | undefined) ?? "Admin" };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { adminEmail, adminName } = Route.useRouteContext();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titleForPath(pathname.replace(/^\/admin\/?/, "").replace(/\/$/, ""));

  const logout = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-admin-bg">
      <aside className={cn("hidden shrink-0 transition-[width] duration-300 lg:block", collapsed ? "w-[88px]" : "w-[280px]")}>
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onLogout={logout} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminSidebar collapsed={false} onLogout={logout} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[88px] shrink-0 items-center gap-4 border-b bg-card px-4 lg:px-8">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu className="size-6" /></button>
          <h2 className="min-w-0 truncate text-2xl font-bold text-admin-blue lg:w-52">{title}</h2>
          <label className="mx-auto hidden h-12 w-full max-w-xl items-center gap-3 rounded-lg border bg-admin-bg px-4 md:flex">
            <Search className="size-4 text-muted-foreground" />
            <input placeholder="Search modules (Leads, Deals, Routing…)" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
          </label>
          <div className="ml-auto flex items-center gap-4">
            <button aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full hover:bg-muted">
              <Bell className="size-5" />
            </button>
            <span className="hidden h-8 w-px bg-border sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger className="grid size-10 place-items-center rounded-full bg-admin-blue text-lg font-bold text-primary-foreground">
                {adminName.charAt(0).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel><div>{adminName}</div><div className="text-xs font-normal text-muted-foreground">{adminEmail}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/admin/$", params: { _splat: "settings/crm-configuration" } })}>Company settings</DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive">Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
          <footer className="mt-10 flex flex-wrap justify-between gap-2 text-[15px] text-muted-foreground">
            <span>© 2026 Routiva CRM. All rights reserved.</span>
            <span className="flex gap-6"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></span>
          </footer>
        </main>
      </div>
    </div>
  );
}
