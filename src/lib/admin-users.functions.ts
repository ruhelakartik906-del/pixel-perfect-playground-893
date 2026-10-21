import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { invitationSchema, validateInvitationRedirect, INVITATION_REDIRECT_URL, isPendingEmployeeInvitation } from './admin-invitation';

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("routing_admin");
  if (error || data !== true) throw new Error("Active Super Admin authorization required");
}

/** Privileged account write; browser profile grants remain restricted. */
export const setUserAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    user_id: z.string().uuid(), status: z.enum(["active", "blocked"]),
  }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot change your own account status");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.from("profiles")
      .update({ account_status: data.status }).eq("id", data.user_id)
      .select("id,account_status").single();
    if (result.error) throw new Error(result.error.message);
    if (!result.data || result.data.account_status !== data.status) throw new Error("Account status was not saved");
    return result.data;
  });

/** Invite a user by email (Auth sends a secure set-password link). No password is ever handled here. */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => invitationSchema.parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    validateInvitationRedirect(data.redirect_to);
    if (data.company_id) {
      const company = await context.supabase.from('companies').select('id').eq('id', data.company_id).eq('is_active', true).maybeSingle();
      if (company.error || !company.data) throw new Error('Select an active company');
    }
    if (data.access_role_id) {
      const role = await context.supabase.from('access_roles').select('id').eq('id', data.access_role_id).maybeSingle();
      if (role.error || !role.data) throw new Error('Select an existing permission role');
    }
    const existing = await context.supabase.from('profiles').select('id').ilike('email', data.email).maybeSingle();
    if (existing.error) throw new Error('Recipient eligibility could not be checked');
    if (existing.data) throw new Error('This account already exists. Do not send a duplicate invitation.');
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name, phone: data.phone }, redirectTo: INVITATION_REDIRECT_URL,
    });
    if (error || !inv.user) throw new Error(error?.message ?? "Invite failed");
    const id = inv.user.id;
    const setup = await supabaseAdmin.rpc('admin_complete_invitation', {
      _actor: context.userId, _user: id, _email: data.email, _name: data.full_name, _phone: data.phone, _role: data.role,
      ...(data.access_role_id ? { _access_role: data.access_role_id } : {}),
      ...(data.company_id ? { _company: data.company_id } : {}),
    });
    if (setup.error || setup.data !== id) throw new Error('Invitation email was requested, but account setup did not complete. No requested role or membership was committed; review the pending account before retrying.');
    return { id };
  });

/** Only expose invitation eligibility, never Auth records or tokens. */
export const pendingEmployeeInvitees = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const profiles = await context.supabase.from('profiles').select('id,email,account_status').eq('account_status', 'pending');
    const roles = await context.supabase.from('user_roles').select('user_id,role');
    if (profiles.error || roles.error) throw new Error('Invitation eligibility could not be checked');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ids: string[] = [];
    for (const profile of profiles.data ?? []) {
      const assigned = (roles.data ?? []).filter(row => row.user_id === profile.id).map(row => row.role);
      if (!assigned.includes('employee')) continue;
      const auth = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (auth.error) throw new Error('Invitation eligibility could not be checked');
      if (isPendingEmployeeInvitation(profile, assigned, auth.data.user)) ids.push(profile.id);
    }
    return ids;
  });

export const resendEmployeeInvitation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const profile = await context.supabase.from('profiles').select('email,account_status').eq('id', data.user_id).single();
    const roles = await context.supabase.from('user_roles').select('role').eq('user_id', data.user_id);
    if (profile.error || roles.error || !profile.data) throw new Error('Invitation eligibility could not be checked');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const auth = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (auth.error || !isPendingEmployeeInvitation(profile.data, (roles.data ?? []).map(row => row.role), auth.data.user)) {
      throw new Error('Only pending invited employees can receive another invitation');
    }
    // A consumed invite has already confirmed email. Renew password setup using
    // Auth recovery in that case; acceptance still requires the original invite.
    const result = auth.data.user?.email_confirmed_at
      ? await supabaseAdmin.auth.resetPasswordForEmail(profile.data.email, { redirectTo: INVITATION_REDIRECT_URL })
      : await supabaseAdmin.auth.admin.inviteUserByEmail(profile.data.email, { redirectTo: INVITATION_REDIRECT_URL });
    if (result.error) throw new Error(result.error.message || 'Invitation email could not be sent');
    return { sent: true };
  });

/** Save mailbox connection. Password goes to a table only the server can read. */
export const saveMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    from_name: z.string().trim().max(120), from_email: z.string().trim().email(),
    smtp_host: z.string().trim().min(1).max(255), smtp_port: z.number().int().min(1).max(65535), smtp_secure: z.boolean(),
    imap_host: z.string().trim().max(255), imap_port: z.number().int().min(1).max(65535),
    username: z.string().trim().min(1).max(255), password: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { password, ...rest } = data;
    const { data: existing } = await supabaseAdmin.from("mailbox_settings").select("has_password").eq("owner_id", context.userId).maybeSingle();
    if (password) {
      const r = await supabaseAdmin.from("mailbox_secrets").upsert({ owner_id: context.userId, password, updated_at: new Date().toISOString() });
      if (r.error) throw new Error(r.error.message);
    } else if (!existing?.has_password) throw new Error("Password is required");
    const r = await supabaseAdmin.from("mailbox_settings").upsert({ owner_id: context.userId, ...rest, has_password: true, updated_at: new Date().toISOString() });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

/** Move a draft into Sent/Scheduled is blocked by RLS; delivery requires a mail integration not yet active. */
export const disconnectMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = await supabaseAdmin.from("mailbox_secrets").delete().eq("owner_id", context.userId);
    if (secret.error) throw new Error('Mailbox credentials could not be removed');
    const settings = await supabaseAdmin.from("mailbox_settings").delete().eq("owner_id", context.userId);
    if (settings.error) throw new Error('Mailbox settings could not be removed; retry disconnecting');
    return { ok: true };
  });
