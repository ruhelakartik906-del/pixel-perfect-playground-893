import {
  Briefcase, Cable, Headphones, LayoutDashboard, MessageSquare, Phone, Route as RouteIcon,
  Settings, ShoppingCart, UserCog, Users, type LucideIcon,
} from "lucide-react";

export type NavLeaf = { label: string; path: string; children?: NavLeaf[] };
export type NavGroup = { label: string; icon: LucideIcon; badge?: string | undefined; items: NavLeaf[] };

const g = (label: string, icon: LucideIcon, base: string, items: string[], badge?: string): NavGroup => ({
  label, icon, badge,
  items: items.map((l) => ({ label: l, path: `${base}/${l.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}` })),
});

/** Master Admin navigation. Ad Lead Routing must stay directly after Dashboard. */
export const adminNav: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, items: [{ label: "Dashboard Overview", path: "dashboard" }] },
  g("Ad Lead Routing", RouteIcon, "routing", ["Ad Routing Setup", "Lead Assignment History", "Unassigned Leads"], "NEW"),
  { ...g("CRM", Users, "crm", ["Leads", "Pipeline", "Deals", "Contacts", "Companies", "Tasks", "Follow-ups", "Automation", "Reports", "Analytics", "Custom Forms", "CRM System Setup"]), items: [
    {label:"Leads",path:"crm/leads"},
    ...g("CRM",Users,"crm",["Pipeline", "Deals", "Contacts", "Companies", "Tasks", "Follow-ups", "Automation", "Reports", "Analytics", "Custom Forms", "CRM System Setup"]).items,
  ] },
  { ...g("Sales", ShoppingCart, "sales", ["Products & Services", "Customers", "Invoices", "Credit Notes", "Revenue", "Reports", "Analytics"]), items: [
    { label: "Products & Services", path: "sales/products" },
    ...g("Sales", ShoppingCart, "sales", ["Customers", "Proposals", "Invoices", "Credit Notes", "Revenue", "Reports", "Analytics"]).items,
  ] },
  g("User Management", UserCog, "users", ["Users", "Role"]),
  g("Communication", MessageSquare, "communication", ["Mail", "Chat"]),
  g("WhatsApp", Phone, "whatsapp", ["WhatsApp Chat", "Message Templates", "Workflows", "Broadcast", "Message Log"]),
  { label: "Integrations", icon: Cable, badge: "NEW", items: [{ label: "Integrations", path: "integrations" }] },
  { label: "All Users", icon: Briefcase, items: [
    { label: "All Users", path: "all-users" },
    { label: "Create Customer", path: "create-customer" },
    { label: "Plans", path: "plans" },
  ] },
  g("HRM", Briefcase, "hrm", ["Employees", "Attendance", "Holidays", "Leave Management", "Meetings", "Announcements"]),
  { label: "Settings", icon: Settings, items: [
    { label: "Admin Account & Security", path: "settings/admin-account-security" },
    { label: "Business Settings", path: "settings/business-settings" },
  ] },
  { label: "Support", icon: Headphones, items: [{ label: "Support", path: "support" }] },
];

// Routing Overview is the group landing page.
adminNav[1]?.items.unshift({ label: "Routing Overview", path: "routing" });

export function titleForPath(splat: string) {
  for (const grp of adminNav) for (const it of grp.items) { for (const child of it.children ?? []) if (child.path === splat) return child.label; if (it.path === splat) return it.label; }
  return "Admin";
}
