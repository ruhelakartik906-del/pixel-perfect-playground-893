import type { Database } from "@/integrations/supabase/types";

export type AccountStatus = Database["public"]["Enums"]["account_status"];

export function workspacePathForStatus(status: AccountStatus | null | undefined) {
  if (status === "blocked") return "/restricted";
  return "/dashboard";
}
