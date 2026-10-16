import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { setupCodeMatches } from "@/lib/admin-setup";

/** Whether the one-time Super Admin setup is still open (no Super Admin exists yet). */
export const getAdminSetupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (error) throw new Error("Could not check setup status");
    return { open: (count ?? 0) === 0, configured: !!process.env["ADMIN_SETUP_CODE"] };
  });

/**
 * One-time Super Admin initialization. Only succeeds when:
 * - the caller is signed in with a confirmed email,
 * - no Super Admin exists yet,
 * - the caller supplies the private ADMIN_SETUP_CODE set by the project owner.
 */
export const claimSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_SETUP_CODE"];
    if (!expected || expected.length < 12) return { ok: false as const, reason: "not_configured" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (countError) throw new Error("Could not check setup status");
    if ((count ?? 0) > 0) return { ok: false as const, reason: "closed" as const };

    if (!setupCodeMatches(data.code, expected)) return { ok: false as const, reason: "bad_code" as const };

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError || !userData.user) return { ok: false as const, reason: "no_user" as const };
    if (!userData.user.email_confirmed_at) return { ok: false as const, reason: "unconfirmed" as const };

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "super_admin" });
    if (roleError) throw new Error("Could not assign role");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: "active" })
      .eq("id", context.userId);
    if (profileError) throw new Error("Could not activate account");
    return { ok: true as const };
  });
