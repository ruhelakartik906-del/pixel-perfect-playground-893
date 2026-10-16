import { createServerFn } from "@tanstack/react-start";

/**
 * One-time Super Admin provisioning. Takes NO input: credentials come only from the
 * private SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD backend secrets set by the owner.
 * It does nothing once any super_admin exists, so calling it cannot grant anyone access.
 */
export const provisionSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env["SUPER_ADMIN_EMAIL"]?.trim().toLowerCase();
  const password = process.env["SUPER_ADMIN_PASSWORD"];
  if (!email || !password || password.length < 8) return { status: "not_configured" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error: countError } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");
  if (countError) throw new Error("Could not check existing admins");
  if ((count ?? 0) > 0) return { status: "already_provisioned" as const };

  let userId: string | undefined;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Super Admin" },
  });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) throw new Error("Could not create admin user");
  }

  const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "super_admin" });
  if (roleError) throw new Error("Could not assign role");
  await supabaseAdmin.from("profiles").update({ account_status: "active" }).eq("id", userId);
  return { status: "provisioned" as const };
});
