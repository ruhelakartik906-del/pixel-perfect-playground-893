import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, UserRound } from "lucide-react";
import { adminNav } from "./nav";
import { cn } from "@/lib/utils";

export function AdminSidebar({ collapsed, onToggle, onLogout, onNavigate }: {
  collapsed: boolean; onToggle?: () => void; onLogout: () => void; onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname }).replace(/\/$/, "");
  const aliases: Record<string, string> = { "hrm/branch": "hrm/branches", "hrm/designation": "hrm/designations", "hrm/holiday": "hrm/holidays", "hrm/leave": "hrm/leave-management", "hrm/calendar": "hrm/hr-calendar", "hrm/meeting": "hrm/meetings", "hrm/announcement": "hrm/announcements", "hrm/document": "hrm/documents" };
  const path = pathname.replace(/^\/admin\/?/, "");
  const current = aliases[path] ?? path;
  const activeGroup = adminNav.find((grp) => grp.items.some((i) => i.path === current))?.label;
  const [open, setOpen] = useState<string | undefined>(activeGroup);

  return (
    <div className="flex h-full flex-col bg-admin-sidebar text-sidebar-foreground">
      <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-sidebar-border px-6">
        {!collapsed && <span className="text-2xl font-extrabold tracking-tight">Routiva CRM</span>}
        {onToggle && (
          <button onClick={onToggle} aria-label="Toggle sidebar" className="grid size-10 place-items-center rounded-lg bg-admin-blue text-primary-foreground">
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain scrollbar-none px-4 py-4">
        {adminNav.map((grp) => {
          const single = grp.items.length === 1;
          const isActive = grp.label === activeGroup;
          const isOpen = open === grp.label && !collapsed;
          const rowCls = cn(
            "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[17px] font-semibold transition-colors",
            isActive && single ? "bg-admin-blue text-primary-foreground shadow-cta"
              : isActive ? "bg-admin-sidebar-muted text-admin-blue" : "text-sidebar-foreground hover:bg-admin-sidebar-muted",
          );
          const Icon = grp.icon;
          if (single) return (
            <Link key={grp.label} to="/admin/$" params={{ _splat: grp.items[0]?.path ?? "" }} onClick={onNavigate} className={rowCls} title={grp.label}>
              <Icon className="size-5 shrink-0" />{!collapsed && <span className="flex-1">{grp.label}</span>}
              {!collapsed && grp.badge && <span className="rounded-full bg-admin-green px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{grp.badge}</span>}
            </Link>
          );
          return (
            <div key={grp.label}>
              <button className={rowCls} title={grp.label} onClick={() => setOpen(isOpen ? undefined : grp.label)}>
                <Icon className="size-5 shrink-0" />
                {!collapsed && <>
                  <span className="flex-1 text-left">{grp.label}</span>
                  {grp.badge && <span className="rounded-full bg-admin-green px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{grp.badge}</span>}
                  {isOpen ? <ChevronDown className="size-4 opacity-70" /> : <ChevronRight className="size-4 opacity-50" />}
                </>}
              </button>
              <div className={cn("grid transition-all duration-300", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="ml-6 overflow-hidden border-l border-sidebar-border pl-3">
                  {grp.items.map((it) => (
                    <Link key={it.path} to="/admin/$" params={{ _splat: it.path }} onClick={onNavigate}
                      className={cn("my-1 block rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors",
                        current === it.path ? "bg-admin-blue text-primary-foreground" : "text-sidebar-foreground/80 hover:bg-admin-sidebar-muted hover:text-sidebar-foreground")}>
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      <div className="shrink-0 space-y-1 border-t border-sidebar-border px-4 py-4">
        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[17px] font-semibold hover:bg-admin-sidebar-muted"><UserRound className="size-5" />{!collapsed && "Profile"}</button>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[17px] font-semibold text-admin-red hover:bg-admin-sidebar-muted"><LogOut className="size-5" />{!collapsed && "Logout"}</button>
      </div>
    </div>
  );
}
