import { supabase } from "@/integrations/supabase/client";
import { customerCreateSchema, type CustomerCreateInput, type CustomerCreateResult } from "./customer-create-schema";

const masterOrigin = "https://pixel-perfect-playground-893.lovable.app";

export async function createCustomerViaCloud(input: CustomerCreateInput): Promise<CustomerCreateResult> {
  const data = customerCreateSchema.parse(input);
  const { data: sessionData, error } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (error || !token) throw new Error("Sign in again to create a customer");
  // Local preview uses its local route; production always calls the Cloud Master.
  const origin = window.location.hostname === "localhost" ? window.location.origin : masterOrigin;
  const response = await fetch(`${origin}/api/public/customers/create`, {
    method: "POST", credentials: "omit",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("The Cloud customer API is not deployed yet. Ask the Master Admin to deploy the prepared update."); }
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message : response.status === 401 ? "Sign in again to create a customer"
        : response.status === 403 ? "Active Super Admin authorization required" : "Customer creation could not be completed";
    throw new Error(message);
  }
  const result = customerCreateSchemaResult(body);
  return result;
}

function customerCreateSchemaResult(body: unknown): CustomerCreateResult {
  if (!body || typeof body !== "object" || !("company_id" in body) || !("user_id" in body)
    || typeof body.company_id !== "string" || typeof body.user_id !== "string") {
    throw new Error("Customer creation returned an invalid response. Check the customer list before retrying.");
  }
  return { company_id: body.company_id, user_id: body.user_id };
}