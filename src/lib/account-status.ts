import type { Database } from "@/integrations/supabase/types";

export type AccountStatus = Database["public"]["Enums"]["account_status"];

export function workspacePathForStatus(status: AccountStatus | null | undefined) {
  if (status === "blocked") return "/restricted";
  return "/dashboard";
}

// Approval/restriction screens must not silently bypass the company-data gate.
export function accountStatePath(kind: "pending" | "restricted", status: AccountStatus | null | undefined) {
  if (status === "blocked") return "/restricted";
  if (kind === "pending" && status !== "active") return "/pending-approval";
  return workspacePathForStatus(status);
}
