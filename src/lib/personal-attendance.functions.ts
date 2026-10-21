import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { HrRow } from './hrm-model';
export type AttendanceWorkspace = { people: HrRow[]; attendance: HrRow[]; holidays: HrRow[]; leaves: HrRow[]; isAdmin: boolean };

export const loadMyAttendance = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const r = await context.supabase.rpc('crm_attendance_workspace', {});
  if (r.error) throw new Error(r.error.message);
  return r.data as unknown as AttendanceWorkspace;
});

export const markMyAttendance = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ action: z.enum(['check_in', 'check_out', 'half_day']) }).parse(v))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc('personal_attendance_action', { _action: data.action });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });

export const manageAttendanceRoster = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ userId: z.string().uuid(), excluded: z.boolean() }).strict().parse(v))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc('attendance_roster_action', { _user: data.userId, _excluded: data.excluded });
    if (r.error) throw new Error(r.error.message);
  });
