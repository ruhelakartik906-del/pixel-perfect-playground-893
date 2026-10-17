import {
  Briefcase, Cable, FileText, Headphones, LayoutDashboard, MessageSquare, Phone, Route as RouteIcon,
  Settings, ShoppingCart, UserCog, Users, type LucideIcon,
} from "lucide-react";

export type NavLeaf = { label: string; path: string };
export type NavGroup = { label: string; icon: LucideIcon; badge?: string | undefined; items: NavLeaf[] };

const g = (label: string, icon: LucideIcon, base: string, items: string[], badge?: string): NavGroup => ({
  label, icon, badge,
  items: items.map((l) => ({ label: l, path: `${base}/${l.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}` })),
});

/** Master Admin navigation. Ad Lead Routing must stay directly after Dashboard. */
export const adminNav: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, items: [{ label: "Dashboard Overview", path: "dashboard" }] },
  g("Ad Lead Routing", RouteIcon, "routing", ["Ad Routing Setup", "Lead Assignment History", "Unassigned Leads"], "NEW"),
  g("CRM", Users, "crm", ["Leads", "Deals", "Contacts", "Companies", "Proposals", "Tasks", "Follow-ups", "Calendar", "Automation", "Reports", "Analytics", "Custom Forms", "CRM System Setup"]),
  { ...g("Sales", ShoppingCart, "sales", ["Products & Services", "Customers", "Invoices", "Credit Notes", "Revenue", "Reports", "Analytics"]), items: [
    { label: "Products & Services", path: "sales/products" },
    ...g("Sales", ShoppingCart, "sales", ["Customers", "Invoices", "Credit Notes", "Revenue", "Reports", "Analytics"]).items,
  ] },
  g("User Management", UserCog, "users", ["Users", "Role"]),
  g("Communication", MessageSquare, "communication", ["Mail", "Chat"]),
  g("WhatsApp", Phone, "whatsapp", ["WhatsApp Chat", "Message Templates", "Workflows", "Broadcast", "Message Log"]),
  { label: "Integrations", icon: Cable, badge: "NEW", items: [{ label: "Integrations", path: "integrations" }] },
  { ...g("HRM", Briefcase, "hrm", ["Employees", "Payroll", "Branches", "Designations", "Departments", "Attendance", "Holidays", "Leave Management", "HR Calendar", "Meetings", "Announcements", "Documents", "Training Setup"]), items: [{ label: "HRM Analytics", path: "hrm/analytics" }, ...g("HRM", Briefcase, "hrm", ["Employees", "Payroll", "Branches", "Designations", "Departments", "Attendance", "Holidays", "Leave Management", "HR Calendar", "Meetings", "Announcements", "Documents", "Training Setup"]).items] },
  g("Job", FileText, "job", ["Jobs", "Job Candidates", "Job Onboarding", "Job Applications", "Offer Letters", "Interviews"]),
  g("Setting", Settings, "settings", ["CRM Configuration", "Countries", "Currencies", "Tax", "E-Signature"]),
  { label: "Support", icon: Headphones, items: [{ label: "Support", path: "support" }] },
];

// Routing Overview is the group landing page.
adminNav[1]?.items.unshift({ label: "Routing Overview", path: "routing" });

export function titleForPath(splat: string) {
  for (const grp of adminNav) for (const it of grp.items) if (it.path === splat) return it.label;
  return "Admin";
}
