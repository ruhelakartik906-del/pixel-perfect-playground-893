import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CustomerCreateInput, CustomerCreateResult } from "./customer-create-schema";

type Client = SupabaseClient<Database>;

export class CustomerCreateError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
  }
}

// The RPC owns the atomic company/membership/role/subscription transaction.
// Auth creation is separate and compensated only after a confirmed SQL failure.
export async function createCustomerWorkspace(
  userClient: Client,
  actor: string,
  data: CustomerCreateInput,
  loadAdmin: () => Promise<Client> = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin,
): Promise<CustomerCreateResult> {
  const authorized = await userClient.rpc("routing_admin");
  if (authorized.error || authorized.data !== true) {
    throw new CustomerCreateError("FORBIDDEN", 403, "Active Super Admin authorization required");
  }
  // Exact email comparison: ilike must not interpret '_' or '%' as wildcards.
  const existing = await userClient.from("profiles").select("id").eq("email", data.email).maybeSingle();
  if (existing.error) throw new CustomerCreateError("ELIGIBILITY_FAILED", 503, "Customer eligibility could not be checked");
  if (existing.data) throw new CustomerCreateError("DUPLICATE_ACCOUNT", 409, "An account with this email already exists");
  const admin = await loadAdmin();
  const created = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name, phone: data.phone },
  });
  if (created.error || !created.data.user) {
    const duplicate = created.error?.code === "email_exists" || created.error?.code === "email_address_exists" || created.error?.code === "user_already_exists";
    throw new CustomerCreateError(duplicate ? "DUPLICATE_ACCOUNT" : "ACCOUNT_CREATE_FAILED", duplicate ? 409 : 503,
      duplicate ? "An account with this email already exists" : "Customer account could not be created");
  }
  const userId = created.data.user.id;
  let setup;
  try {
    setup = await userClient.rpc("master_create_customer", {
      _actor: actor, _user: userId, _email: data.email,
      _name: data.full_name, _phone: data.phone, _company: data.company_name,
    });
  } catch {
    // A disconnected response does not establish whether the transaction committed.
    throw new CustomerCreateError("CREATION_UNCERTAIN", 503, "Creation could not be confirmed. Ask the Master Admin to check the account before retrying.");
  }
  if (setup.error) {
    let rolledBack = false;
    try { rolledBack = !(await admin.auth.admin.deleteUser(userId)).error; } catch { /* Never log passwords or backend errors. */ }
    throw new CustomerCreateError(rolledBack ? "WORKSPACE_ROLLED_BACK" : "ROLLBACK_FAILED", 503,
      rolledBack ? "Customer workspace could not be created; the account was rolled back. Please retry."
        : "Customer workspace could not be created and account cleanup failed. Ask the Master Admin to resolve it before retrying.");
  }
  if (!setup.data) throw new CustomerCreateError("CREATION_UNCERTAIN", 503, "Creation could not be confirmed. Ask the Master Admin to check the account before retrying.");
  return { company_id: setup.data, user_id: userId };
}