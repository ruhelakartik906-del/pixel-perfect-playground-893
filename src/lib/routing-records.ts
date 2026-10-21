type Lead = { id: string; intake_source?: string | null; assigned_to?: string | null; created_at: string };

export function manualLeads<T extends Lead>(leads: T[]) {
  return leads.filter(lead => lead.intake_source === "manual").sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

export function unassignedLeads<T extends Lead>(leads: T[]) {
  // The canonical assignment is authoritative, including older leads without a queue row.
  return leads.filter(lead => !lead.assigned_to);
}

export function companyRecipients<T extends { company_id: string; user_id: string }>(recipients: T[], companyId: string) {
  return companyId ? recipients.filter(recipient => recipient.company_id === companyId) : [];
}

export function savedLeadAnswers(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function leadAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}