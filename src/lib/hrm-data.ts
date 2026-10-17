import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };
export type Named = { id: string; name: string };
export type Employee = {
  company_id: string | null;
  id: string; profile_id: string; employee_code: string | null; department_id: string | null; designation_id: string | null; branch_id: string | null;
  joining_date: string | null; access_status: "pending" | "approved" | "rejected"; phone: string; employment_type: string; reporting_manager_id: string | null; is_active: boolean; created_at: string;
  profiles: { full_name: string; email: string; phone: string; avatar_url: string | null; account_status: string } | null;
};

export async function loadHrm() {
  const r = await Promise.all([
    db.from("hr_employees").select("*, profiles(full_name,email,phone,avatar_url,account_status)").order("created_at"),
    db.from("hr_departments").select("id,name").order("name"), db.from("hr_designations").select("id,name").order("name"), db.from("hr_branches").select("id,name,is_active").order("name"),
    db.from("leads").select("id,assigned_to,status,created_at").not("assigned_to", "is", null).limit(20000),
    db.from("deals").select("id,assigned_to,status,created_at").not("assigned_to", "is", null).limit(20000),
    db.from("hr_attendance").select("employee_id,attendance_date,status,check_in,check_out").limit(20000),
    db.from("hr_meetings").select("id,company_id,status,start_date,details").limit(20000),
  ]);
  const err = r.find((x) => x.error)?.error; if (err) throw err;
  return { employees: r[0].data as Employee[], departments: r[1].data as Named[], designations: r[2].data as Named[], branches: r[3].data as (Named & { is_active: boolean })[],
    leads: r[4].data as { assigned_to: string; status: string; created_at: string }[], deals: r[5].data as { assigned_to: string; status: string; created_at: string }[],
    attendance: (r[6].data ?? []) as { employee_id: string; attendance_date: string; status: string; check_in: string | null; check_out: string | null }[],
    meetings: (r[7].data ?? []) as { id: string; company_id: string; status: string; start_date: string; details: { employee_ids?: string[] } }[] };
}

const CLOSED = new Set(["won", "lost", "closed", "converted"]);
/** Per-employee metrics from real lead/deal rows, optionally limited to a created_at date range (YYYY-MM-DD). */
export function employeeMetrics(profileId: string, leads: { assigned_to: string; status: string; created_at: string }[], deals: { assigned_to: string; status: string; created_at: string }[], from = "", to = "") {
  const inRange = (d: string) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to);
  const mine = leads.filter((l) => l.assigned_to === profileId && inRange(l.created_at));
  const myDeals = deals.filter((d) => d.assigned_to === profileId && inRange(d.created_at));
  return {
    assigned: mine.length,
    pending: mine.filter((l) => !CLOSED.has((l.status ?? "").toLowerCase())).length,
    won: myDeals.filter((d) => (d.status ?? "").toLowerCase() === "won").length,
    openDeals: myDeals.filter((d) => !CLOSED.has((d.status ?? "").toLowerCase())).length,
  };
}

export function csvDownload(name: string, rows: (string | number)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" }));
  a.download = name; a.click();
}
