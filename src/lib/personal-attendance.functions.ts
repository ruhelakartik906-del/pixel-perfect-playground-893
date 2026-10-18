import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const loadMyAttendance = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const r = await context.supabase.from('personal_attendance').select('*').eq('owner_id', context.userId).order('attendance_date', { ascending: false }).limit(400);
  if (r.error) throw new Error('Attendance could not be loaded');
  return r.data;
});

export const markMyAttendance = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ action: z.enum(['check_in', 'check_out']) }).parse(v))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc('personal_attendance_action', { _action: data.action });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
