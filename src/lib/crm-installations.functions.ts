import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { installationSchema, installationChangeSchema, installationColumns } from "./crm-installations";
import { generateInstallationCredential, hashInstallationCredential } from "./license-crypto";
import { readAllPages } from "./backend-read";

type Context = {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
};
async function authorize(context: Context) {
  const result = await context.supabase.rpc("routing_admin");
  if (result.error || result.data !== true)
    throw new Error("Active Super Admin authorization required");
}
export const listCrmInstallations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context);
    return readAllPages((start, end) =>
      context.supabase
        .from("crm_installations")
        .select(installationColumns)
        .order("created_at")
        .order("id")
        .range(start, end),
    );
  });
export const createCrmInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => installationSchema.parse(input))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const origin = new URL(data.crm_url).hostname;
    if (
      ["pixel-perfect-playground-893.lovable.app", "app.hatflow.in", "hatflow.in"].includes(
        origin,
      ) ||
      (origin.endsWith(".lovable.app") && origin.startsWith("id-preview--"))
    )
      throw new Error("Use a separate customer installation, not this CRM or the legacy app");
    const credential = generateInstallationCredential();
    const result = await context.supabase.rpc("crm_installation_action", {
      _action: "create",
      _payload: { ...data, credential_hash: await hashInstallationCredential(credential) },
    });
    if (result.error)
      throw new Error(
        result.error.code === "23505"
          ? "An installation already uses this email or CRM address"
          : "Installation could not be saved. Check the details and try again.",
      );
    // The plaintext credential is shown once; only its hash is stored.
    return { installation: result.data, credential };
  });
export const installationAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await authorize(context);
    const result = await context.supabase
      .from("crm_installation_audit")
      .select("*")
      .eq("installation_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw new Error("Audit history could not be loaded");
    return result.data;
  });
const actionErrors = [
  "License changed. Refresh and try again",
  "Only pending licenses can be activated",
  "Only active licenses can be suspended",
  "Only suspended licenses can be resumed",
  "License expired. Renew it before resuming",
  "Activate the license before renewing",
  "Select 1 Year or 2 Years",
];
export const changeCrmInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => installationChangeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await authorize(context);
    if (data.action === "renew" && !data.validity_years) throw new Error("Select 1 Year or 2 Years");
    const credential = data.action === "rotate" ? generateInstallationCredential() : null;
    const result = await context.supabase.rpc("crm_installation_action", {
      _action: data.action,
      _payload: credential
        ? { ...data, credential_hash: await hashInstallationCredential(credential) }
        : data,
    });
    if (result.error) {
      const known = actionErrors.find((m) => result.error.message.includes(m));
      throw new Error(known ?? "License could not be updated. Refresh and try again.");
    }
    return { installation: result.data, credential };
  });
