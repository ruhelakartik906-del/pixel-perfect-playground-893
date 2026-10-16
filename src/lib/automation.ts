export type Trigger = "lead_created" | "whatsapp_received" | "stage_changed" | "followup_due";
export type ActionType = "assign" | "create_task" | "notify" | "wait" | "check_condition" | "send_whatsapp" | "send_email";
export type WorkflowAction = { type: ActionType; delayHours: number; note: string };
export type Condition = { field: string; op: string; value: string };
export type Workflow = {
  id: string; name: string; description: string; trigger: Trigger; conditions: Condition[];
  actions: WorkflowAction[]; status: "active" | "paused"; is_default: boolean; created_at: string;
};

export const triggerLabels: Record<Trigger, string> = {
  lead_created: "LEAD CREATED", whatsapp_received: "WHATSAPP RECEIVED", stage_changed: "STAGE CHANGED", followup_due: "FOLLOW-UP DUE",
};

/** needsIntegration = no secure backend executor exists yet; never shown as operational. */
export const actionMeta: Record<ActionType, { label: string; needsIntegration: boolean }> = {
  assign: { label: "ASSIGN", needsIntegration: true },
  create_task: { label: "CREATE TASK", needsIntegration: true },
  notify: { label: "NOTIFY", needsIntegration: true },
  wait: { label: "WAIT", needsIntegration: false },
  check_condition: { label: "CHECK CONDITION", needsIntegration: false },
  send_whatsapp: { label: "SEND WHATSAPP", needsIntegration: true },
  send_email: { label: "SEND EMAIL", needsIntegration: true },
};

/** Assign actions never override Ad Lead Routing: they only apply to leads routing left unassigned. */
export const ASSIGN_RESPECTS_ROUTING_NOTE = "Only applies to leads that Ad Lead Routing left unassigned.";

export const defaultWorkflows: Omit<Workflow, "id" | "created_at">[] = [
  { name: "New Lead Welcome Flow", description: "Greets every new lead and opens a first-contact task.", trigger: "lead_created", conditions: [],
    actions: [{ type: "send_whatsapp", delayHours: 0, note: "Welcome template" }, { type: "create_task", delayHours: 1, note: "First call" }], status: "paused", is_default: true },
  { name: "WhatsApp Inquiry Auto-Reply", description: "Acknowledges incoming WhatsApp enquiries.", trigger: "whatsapp_received", conditions: [],
    actions: [{ type: "send_whatsapp", delayHours: 0.25, note: "Auto reply" }], status: "paused", is_default: true },
  { name: "Stage Change Notification", description: "Notifies the owner when a lead moves stage.", trigger: "stage_changed", conditions: [],
    actions: [{ type: "notify", delayHours: 0, note: "Owner" }], status: "paused", is_default: true },
  { name: "Follow-up Reminder", description: "Waits, checks status, then reminds the assignee.", trigger: "followup_due", conditions: [],
    actions: [{ type: "wait", delayHours: 2, note: "" }, { type: "check_condition", delayHours: 0, note: "Still open" }, { type: "notify", delayHours: 0, note: "Assignee" }], status: "paused", is_default: true },
];

export function workflowStats(wfs: Pick<Workflow, "status" | "is_default">[], execs: { status: string }[]) {
  const ok = execs.filter((e) => e.status === "success").length;
  return {
    active: wfs.filter((w) => w.status === "active").length,
    paused: wfs.filter((w) => w.status === "paused").length,
    custom: wfs.filter((w) => !w.is_default).length,
    executions: execs.length,
    successRate: execs.length ? Math.round((ok / execs.length) * 100) : null,
  };
}

/** Defaults to insert: skip names that already exist so customised copies are never touched. */
export function missingDefaults(existingNames: string[]) {
  const set = new Set(existingNames.map((n) => n.toLowerCase()));
  return defaultWorkflows.filter((d) => !set.has(d.name.toLowerCase()));
}
