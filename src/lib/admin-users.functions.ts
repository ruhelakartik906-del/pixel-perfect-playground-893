import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (error || data !== true) throw new Error("Super Admin authorization required");
}

/** Invite a user by email (Auth sends a secure set-password link). No password is ever handled here. */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    email: z.string().trim().email().max(255),
    full_name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).default(""),
    role: z.enum(["super_admin", "manager", "employee", "client"]),
    access_role_id: z.string().uuid().nullable(),
    company_id: z.string().uuid().nullable(),
    redirect_to: z.string().url(),
  }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name, phone: data.phone }, redirectTo: data.redirect_to,
    });
    if (error || !inv.user) throw new Error(error?.message ?? "Invite failed");
    const id = inv.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, email: data.email, full_name: data.full_name, phone: data.phone, company_name: "", account_status: "active" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    if (data.access_role_id) await supabaseAdmin.from("user_access_roles").upsert({ user_id: id, role_id: data.access_role_id });
    if (data.company_id) await supabaseAdmin.from("company_members").insert({ user_id: id, company_id: data.company_id });
    return { id };
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
    await supabaseAdmin.from("mailbox_secrets").delete().eq("owner_id", context.userId);
    await supabaseAdmin.from("mailbox_settings").delete().eq("owner_id", context.userId);
    return { ok: true };
  });
