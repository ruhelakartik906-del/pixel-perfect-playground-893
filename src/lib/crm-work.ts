import { z } from "zod";

export const workSearchSchema = z.object({ q: z.string().max(200).catch(""), tab: z.enum(["today", "upcoming", "overdue", "completed", "all"]).catch("all"), status: z.string().catch(""), priority: z.string().catch(""), assignee: z.string().catch(""), due: z.string().catch(""), interaction: z.string().catch(""), view: z.enum(["list", "kanban"]).catch("list"), page: z.number().int().min(1).catch(1) });
export type WorkSearch = z.infer<typeof workSearchSchema>;
const nullableId = z.string().uuid().nullable();
export const workSchema = z.object({
  id: z.string().uuid().optional(), version: z.number().int().positive().optional(), kind: z.enum(["task", "follow_up"]), company_id: z.string().uuid(), assigned_to: z.string().uuid(), lead_id: nullableId,
  title: z.string().trim().min(1, "Title is required").max(200), notes: z.string().max(5000), priority: z.enum(["low", "medium", "high", "highest"]), status: z.enum(["not_started", "in_progress", "scheduled", "completed", "skipped"]),
  start_date: z.string().date().nullable(), due_date: z.string().date().nullable(), scheduled_at: z.string().datetime({ offset: true }).nullable(), interaction_type: z.enum(["call", "whatsapp", "email", "meeting"]).nullable(),
}).superRefine((v, ctx) => {
  if (v.kind === "task" && (!v.start_date || !v.due_date || v.due_date < v.start_date || !["not_started", "in_progress", "completed"].includes(v.status) || v.scheduled_at !== null || v.interaction_type !== null)) ctx.addIssue({ code: "custom", message: "Task due date must be on or after start date, with a valid task status" });
  if (v.kind === "follow_up" && (!v.lead_id || !v.scheduled_at || !v.interaction_type || !["scheduled", "completed", "skipped"].includes(v.status) || v.start_date !== null || v.due_date !== null)) ctx.addIssue({ code: "custom", message: "Select a real lead, interaction and scheduled time" });
});
export function localDay(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function workBucket(item: { kind: string; status: string; due_date: string | null; scheduled_at: string | null }, now = new Date()) {
  if (item.status === "completed" || item.status === "skipped") return item.status;
  const day = item.kind === "task" ? item.due_date : item.scheduled_at ? localDay(new Date(item.scheduled_at)) : null;
  if (!day) return "all";
  if (item.kind === "follow_up" && item.scheduled_at && new Date(item.scheduled_at).getTime() < now.getTime()) return "overdue";
  return day < localDay(now) ? "overdue" : day === localDay(now) ? "today" : "upcoming";
}
export function scheduleInput(iso: string) { return new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 16); }
export function scheduleUtc(local: string) { return new Date(`${local}:00+05:30`).toISOString(); }