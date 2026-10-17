import { describe,it,expect } from "vitest";
import { workBucket,workSchema,scheduleInput,scheduleUtc } from "@/lib/crm-work";
const now = new Date("2026-10-17T10:17:00Z");
describe("CRM work rules",()=>{
 it("completed tasks never count as overdue",()=>expect(workBucket({kind:"task",status:"completed",due_date:"2026-10-15",scheduled_at:null},now)).toBe("completed"));
 it("tasks due today remain Today until the next Kolkata day",()=>expect(workBucket({kind:"task",status:"not_started",due_date:"2026-10-17",scheduled_at:null},now)).toBe("today"));
 it("earlier scheduled followups are overdue even today",()=>expect(workBucket({kind:"follow_up",status:"scheduled",due_date:null,scheduled_at:"2026-10-17T10:00:00Z"},now)).toBe("overdue"));
 it("future followups today are Today",()=>expect(workBucket({kind:"follow_up",status:"scheduled",due_date:null,scheduled_at:"2026-10-17T11:00:00Z"},now)).toBe("today"));
 it("skipped followups never count overdue",()=>expect(workBucket({kind:"follow_up",status:"skipped",due_date:null,scheduled_at:"2026-10-15T10:00:00Z"},now)).toBe("skipped"));
 it("uses Kolkata timezone at midnight boundary",()=>expect(workBucket({kind:"task",status:"in_progress",due_date:"2026-10-18",scheduled_at:null},new Date("2026-10-17T19:00:00Z"))).toBe("today"));
 it("converts scheduled local times without browser timezone dependence",()=>{expect(scheduleUtc("2026-10-17T15:47")).toBe("2026-10-17T10:17:00.000Z");expect(scheduleInput("2026-10-17T10:17:00Z")).toBe("2026-10-17T15:47");});
 const task={kind:"task",company_id:"11111111-1111-4111-8111-111111111111",assigned_to:"22222222-2222-4222-8222-222222222222",lead_id:null,title:"Call customer",notes:"",priority:"medium",status:"not_started",start_date:"2026-10-17",due_date:"2026-10-18",scheduled_at:null,interaction_type:null};
 it("rejects task due date before start date",()=>expect(workSchema.safeParse({...task,due_date:"2026-10-16"}).success).toBe(false));
 it("followups require real lead identifiers",()=>expect(workSchema.safeParse({...task,kind:"follow_up",status:"scheduled",start_date:null,due_date:null,scheduled_at:"2026-10-17T10:17:00Z",interaction_type:"call"}).success).toBe(false));
 it("rejects whitespace titles",()=>expect(workSchema.safeParse({...task,title:"  "}).success).toBe(false));
});