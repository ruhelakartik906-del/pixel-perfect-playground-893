import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { currentLicense } from "./license-gate.server";
import { customerCreateSchema, type CustomerCreateInput, type CustomerCreateResult } from "./customer-create-schema";
import { createCustomerWorkspace, CustomerCreateError } from "./customer-create.server";

const allowedOrigins = new Set([
  "https://pixel-perfect-playground-893.lovable.app",
  "https://skyblue-falcon-639925.hostingersite.com",
]);

type Client = import("@supabase/supabase-js").SupabaseClient<Database>;
type Dependencies = {
  masterReady: () => Promise<boolean>;
  userClient: (token: string) => Client;
  create: (client: Client, actor: string, data: CustomerCreateInput) => Promise<CustomerCreateResult>;
};

const defaults: Dependencies = {
  masterReady: async () => (await currentLicense()).status === "master",
  userClient: (token) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Server not configured");
    return createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set("apikey", key);
          // Keep the caller JWT; never substitute the publishable key as bearer.
          return fetch(input, { ...init, headers });
        },
      },
    });
  },
  create: createCustomerWorkspace,
};

export async function handleCustomerCreate(request: Request, deps: Dependencies = defaults): Promise<Response> {
  const origin = request.headers.get("origin");
  const allowed = !origin || allowedOrigins.has(origin) || origin === new URL(request.url).origin;
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  const reply = (body: object, status: number) => Response.json(body, { status, headers });
  if (!allowed) return reply({ error: "ORIGIN_DENIED" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) return reply({ error: "UNAUTHORIZED" }, 401);
  try {
    if (!(await deps.masterReady())) return reply({ error: "MASTER_UNAVAILABLE" }, 503);
    const client = deps.userClient(match[1]);
    // Revalidate the real session with Auth on every request, including revocations.
    const verified = await client.auth.getUser(match[1]);
    if (verified.error || !verified.data.user) return reply({ error: "UNAUTHORIZED" }, 401);
    const authorized = await client.rpc("routing_admin");
    if (authorized.error || authorized.data !== true) return reply({ error: "FORBIDDEN" }, 403);
    const raw = await request.text();
    if (raw.length > 8192) return reply({ error: "PAYLOAD_TOO_LARGE" }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return reply({ error: "BAD_REQUEST" }, 400); }
    const parsed = customerCreateSchema.safeParse(input);
    if (!parsed.success) return reply({ error: "BAD_REQUEST" }, 400);
    const result = await deps.create(client, verified.data.user.id, parsed.data);
    return reply(result, 201);
  } catch (error) {
    if (error instanceof CustomerCreateError) return reply({ error: error.code, message: error.message }, error.status);
    // No raw Auth/DB errors, request body, credential or hash in logs/responses.
    return reply({ error: "CREATE_UNAVAILABLE", message: "Customer creation is unavailable. Check the Cloud server configuration." }, 503);
  }
}