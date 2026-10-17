export const WF_TRIGGERS = [
  { id: "lead_created", label: "New Lead Created" },
  { id: "lead_stage_changed", label: "Lead Stage Changed" },
  { id: "wa_message_received", label: "WhatsApp Message Received" },
  { id: "customer_replied", label: "Customer Replied" },
  { id: "followup_due", label: "Follow-up Due" },
  { id: "manual", label: "Manual Trigger" },
] as const;

export const WF_NODE_TYPES = [
  { id: "send_template", label: "Send WhatsApp Template" },
  { id: "wait", label: "Wait / Delay" },
  { id: "condition", label: "Condition" },
  { id: "update_lead_status", label: "Update Lead Status" },
  { id: "assign_lead", label: "Assign Lead (fallback only)" },
  { id: "create_followup", label: "Create Follow-up" },
  { id: "notify_employee", label: "Notify Employee" },
  { id: "end", label: "End Workflow" },
] as const;
export type NodeType = (typeof WF_NODE_TYPES)[number]["id"];

export type WfNode = {
  id: string;
  type: NodeType;
  config: Record<string, string>;
  /** Next node id; for conditions this is the "yes" branch. */
  next: string | null;
  /** Condition "no" branch. */
  no?: string | null | undefined;
};

export const triggerLabel = (id: string) => WF_TRIGGERS.find((t) => t.id === id)?.label ?? id;
export const nodeLabel = (id: string) => WF_NODE_TYPES.find((t) => t.id === id)?.label ?? id;

/** Returns a list of human-readable problems; empty means the workflow can be activated. */
export function validateWorkflow(wf: { name: string; trigger: string; nodes: WfNode[] }, templateIds: string[] = []): string[] {
  const errs: string[] = [];
  if (!wf.name.trim()) errs.push("Workflow name is required");
  if (!WF_TRIGGERS.some((t) => t.id === wf.trigger)) errs.push("Choose a trigger");
  if (wf.nodes.length === 0) { errs.push("Add at least one step"); return errs; }
  const ids = new Set(wf.nodes.map((n) => n.id));
  wf.nodes.forEach((n, i) => {
    const step = `Step ${i + 1} (${nodeLabel(n.type)})`;
    for (const ref of [n.next, n.no]) if (ref && !ids.has(ref)) errs.push(`${step} points to a missing step`);
    if (n.next === n.id || n.no === n.id) errs.push(`${step} cannot connect to itself`);
    if (n.type === "condition") {
      if (!n.config["field"] || !n.config["value"]) errs.push(`${step} needs a field and value`);
      if (!n.next || !n.no) errs.push(`${step} needs both Yes and No branches`);
    } else if (n.type !== "end" && !n.next) errs.push(`${step} must connect to a next step or End`);
    if (n.type === "end" && n.next) errs.push(`${step} cannot continue after End`);
    if (n.type === "send_template" && !templateIds.includes(n.config["template_id"] ?? "")) errs.push(`${step} needs a saved template`);
    if (n.type === "wait" && !(Number(n.config["minutes"]) > 0)) errs.push(`${step} needs a delay greater than 0 minutes`);
    if (n.type === "update_lead_status" && !n.config["status"]) errs.push(`${step} needs a status`);
    if (n.type === "notify_employee" && !n.config["message"]) errs.push(`${step} needs a message`);
  });
  // Every step must be reachable from the first one, and no cycles.
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const stack = new Set<string>();
  let cycle = false;
  const walk = (id: string | null | undefined) => {
    if (!id || !byId.has(id)) return;
    if (stack.has(id)) { cycle = true; return; }
    if (seen.has(id)) return;
    seen.add(id); stack.add(id);
    const n = byId.get(id)!;
    walk(n.next); walk(n.no);
    stack.delete(id);
  };
  walk(wf.nodes[0]!.id);
  if (cycle) errs.push("Steps form a loop — every path must reach End");
  const unreachable = wf.nodes.filter((n) => !seen.has(n.id)).length;
  if (unreachable) errs.push(`${unreachable} step(s) are not connected to the flow`);
  if (!wf.nodes.some((n) => n.type === "end")) errs.push("Add an End Workflow step");
  return errs;
}

/** Broadcast delivery rate = delivered / sent, 0 when nothing was sent. */
export function deliveryRate(sent: number, delivered: number) {
  return sent > 0 ? Math.round((delivered / sent) * 100) : 0;
}

/** Normalizes a phone to digits-only E.164 (no +). Indian 10-digit numbers get the 91 prefix. */
export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d;
}
