import type { Database } from "@/integrations/supabase/types";

export type AccountStatus = Database["public"]["Enums"]["account_status"];

export function workspacePathForStatus(status: AccountStatus | null | undefined) {
  if (status === "active") return "/dashboard";
  if (status === "blocked") return "/restricted";
  return "/pending-approval";
}
