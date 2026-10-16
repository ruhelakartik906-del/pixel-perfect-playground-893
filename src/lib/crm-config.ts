/** Shared CRM System Setup helpers (pure — tested in src/test/crm-config.test.ts). */
export type OptionCategory = "source" | "tag" | "category" | "contract_type";
export type StageKind = "lead" | "deal";

export const leadColumnCatalog: { id: string; label: string }[] = [
  { id: "phone", label: "Contact No" }, { id: "stage", label: "Customer Stage" }, { id: "customer_name", label: "Customer Name" },
  { id: "source", label: "Customer Source" }, { id: "assignee", label: "Assignee" }, { id: "company", label: "Company" },
  { id: "campaign", label: "Campaign" }, { id: "email", label: "Email" }, { id: "business_name", label: "Business Name" },
  { id: "business_category", label: "Business Category" }, { id: "requirements", label: "Required Service" },
  { id: "interest_level", label: "Interest Level" }, { id: "created_at", label: "Lead Received" }, { id: "status", label: "Lead Status" },
];
export const dealColumnCatalog: { id: string; label: string }[] = [
  { id: "title", label: "Deal Name" }, { id: "stage", label: "Stage" }, { id: "amount", label: "Amount" },
  { id: "assignee", label: "Assignee" }, { id: "company", label: "Company" }, { id: "created_at", label: "Created" }, { id: "status", label: "Status" },
];

/** Move item at index by delta, returning new array with positions renumbered 0..n-1. */
export function moveItem<T extends { position: number }>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((it, i) => ({ ...it, position: i }));
}

/** A config item may be deleted only when nothing references it and it is not the default. */
export function canDelete(usage: number, isDefault = false): boolean {
  return usage === 0 && !isDefault;
}
