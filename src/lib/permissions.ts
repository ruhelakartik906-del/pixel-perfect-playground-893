/** Reusable permission catalog shared by Roles and future module guards. */
export const PERMISSION_MODULES = [
  "lead", "deal", "contact", "company", "task", "report", "product", "customer", "invoice",
  "credit_note", "revenue", "user", "role", "mail", "chat", "whatsapp", "template",
] as const;
export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type Permission = `${PermissionModule}.${(typeof PERMISSION_ACTIONS)[number]}`;

export const ALL_PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap((m) => PERMISSION_ACTIONS.map((a) => `${m}.${a}` as Permission));

export function isPermission(p: string): p is Permission {
  return (ALL_PERMISSIONS as string[]).includes(p);
}

/** Unique module names covered by a permission list, in catalog order. */
export function modulesOf(perms: string[]): PermissionModule[] {
  return PERMISSION_MODULES.filter((m) => perms.some((p) => p.startsWith(`${m}.`)));
}

/** Badge summary: first `show` modules plus count of the remaining permissions. */
export function summarize(perms: string[], show = 3) {
  const mods = modulesOf(perms).slice(0, show);
  const covered = perms.filter((p) => mods.some((m) => p.startsWith(`${m}.`))).length;
  return { shown: mods, more: Math.max(0, perms.filter(isPermission).length - covered) };
}

/** A role can be deleted only when no user is assigned to it. */
export function canDeleteRole(assignedUsers: number) {
  return assignedUsers === 0;
}

export const SYSTEM_ROLES = [
  { id: "super_admin", label: "Super Admin" },
  { id: "manager", label: "Manager" },
  { id: "employee", label: "Employee" },
  { id: "client", label: "Client" },
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number]["id"];

/** WhatsApp template names must be lowercase letters, digits and underscores (Meta rule). */
export function validTemplateName(name: string) {
  return /^[a-z0-9_]{1,512}$/.test(name);
}
