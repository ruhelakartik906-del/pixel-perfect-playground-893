import { z } from "zod";

export const installationSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  company_name: z.string().trim().min(1).max(160),
  admin_email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((v) => v.toLowerCase()),
  admin_phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || /^\+?[0-9 ()-]{7,30}$/.test(v), "Enter a valid phone number")
    .default(""),
  crm_url: z
    .string()
    .trim()
    .url()
    .max(500)
    .transform((v) => v.replace(/\/+$/, "").toLowerCase())
    .refine(
      (v) => /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:443)?$/.test(v),
      "Use a valid HTTPS installation address without a path",
    ),
  validity_years: z.union([z.literal(1), z.literal(2)]),
  notes: z.string().trim().max(2000).default(""),
});
export type Installation = Omit<
  import("@/integrations/supabase/types").Database["public"]["Tables"]["crm_installations"]["Row"],
  "credential_hash"
>;
/** Columns readable by Super Admins; the credential hash is never selected. */
export const installationColumns =
  "id,installation_id,client_name,company_name,admin_email,admin_phone,crm_url,validity_years,starts_at,expires_at,license_status,configuration_verified,enforcement_verified,admin_provisioned,created_by,created_at,updated_at,activated_at,valid_until,last_verified_at,last_renewed_at,notes,credential_rotated_at";
export type Audit =
  import("@/integrations/supabase/types").Database["public"]["Tables"]["crm_installation_audit"]["Row"];
export const installationChangeSchema = z.object({
  action: z.enum(["activate", "suspend", "resume", "renew", "rotate"]),
  id: z.string().uuid(),
  validity_years: z.union([z.literal(1), z.literal(2)]).optional(),
  expected_updated_at: z.string().datetime({ offset: true }),
});
export type LicenseAction = z.infer<typeof installationChangeSchema>["action"];
type StatusRow = Pick<Installation, "license_status" | "valid_until">;
export function installationStatus(row: StatusRow, now = new Date()) {
  if (row.valid_until && new Date(row.valid_until) <= now) return "expired";
  return row.license_status === "setup_required" ? "pending" : row.license_status;
}
/** Which actions are allowed for a license in its current state (mirrors the database rules). */
export function allowedActions(row: StatusRow, now = new Date()): LicenseAction[] {
  const s = installationStatus(row, now);
  if (s === "pending") return ["activate", "rotate"];
  if (s === "active") return ["suspend", "renew", "rotate"];
  if (s === "suspended") return ["resume", "renew", "rotate"];
  return ["renew", "rotate"];
}
export function remainingDays(row: StatusRow, now = new Date()) {
  if (!row.valid_until) return null;
  return Math.max(0, Math.ceil((new Date(row.valid_until).getTime() - now.getTime()) / 86400000));
}
export const statusLabels: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  expired: "Expired",
};
export function addLicenseYears(value: string, years: 1 | 2) {
  const date = new Date(new Date(value).getTime() + 19800000);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return new Date(date.getTime() - 19800000).toISOString();
}
export function renewalExpiry(expiry: string | null, years: 1 | 2, now = new Date()) {
  return addLicenseYears(expiry && new Date(expiry) > now ? expiry : now.toISOString(), years);
}
export function filterInstallations(
  rows: Installation[],
  search: string,
  status: string,
  soon: boolean,
  now = new Date(),
) {
  const end = now.getTime() + 30 * 86400000;
  return rows.filter(
    (row) =>
      (!search ||
        [row.client_name, row.company_name, row.admin_email, row.installation_id]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (status === "all" || installationStatus(row, now) === status) &&
      (!soon ||
        (!!row.valid_until &&
          new Date(row.valid_until).getTime() > now.getTime() &&
          new Date(row.valid_until).getTime() <= end)),
  );
}
export const licenseDate = (value: string | null) =>
  !value ? "—" : new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
