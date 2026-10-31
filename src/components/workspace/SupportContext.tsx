import { createContext, useContext } from "react";
import { queryOptions } from "@tanstack/react-query";
import type { UserCrmData } from "@/lib/user-crm.functions";
import { userCrmQuery } from "@/lib/user-crm-query";
import { loadSupportWorkspace } from "@/lib/support-access.functions";
import type { OrgFeatureMap } from "@/lib/org-features";

export type SupportWorkspaceContext = { sessionId: string; mode: "view" | "support"; page: "dashboard" | "all-assigned"; features: OrgFeatureMap; companyName: string; onNavigate: (page: "dashboard" | "all-assigned") => void };
export const SupportContext = createContext<SupportWorkspaceContext | null>(null);
export const useSupportWorkspace = () => useContext(SupportContext);
export function supportCrmQuery(sessionId: string) {
  return queryOptions({ queryKey: ["support-ws", sessionId, "crm"], queryFn: async (): Promise<UserCrmData> => (await loadSupportWorkspace({ data: { session_id: sessionId } })).crm, staleTime: 0, retry: false });
}
export function useWorkspaceCrmQuery() { const support = useSupportWorkspace(); return support ? supportCrmQuery(support.sessionId) : userCrmQuery; }