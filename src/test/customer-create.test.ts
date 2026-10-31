import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createCustomerWorkspace } from "@/lib/customer-create.server";
import { handleCustomerCreate } from "@/lib/customer-create-api.server";

const input = { company_name: "Disposable Co", full_name: "Test Admin", email: "test@example.invalid", phone: "", password: "test-only-password" };
const actor = "11111111-1111-4111-8111-111111111111";
const user = "22222222-2222-4222-8222-222222222222";
const company = "33333333-3333-4333-8333-333333333333";
type Client = SupabaseClient<Database>;

function fixtures() {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: actor } }, error: null });
  const rpc = vi.fn().mockImplementation(async (name: string) => ({ data: name === "routing_admin" ? true : company, error: null }));
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const client = { auth: { getUser }, rpc, from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) } as unknown as Client;
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: user } }, error: null });
  const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
  const admin = { auth: { admin: { createUser, deleteUser } } } as unknown as Client;
  const loadAdmin = vi.fn().mockResolvedValue(admin);
  const create = vi.fn((c: Client, a: string, d: typeof input) => createCustomerWorkspace(c, a, d, loadAdmin));
  const deps = { masterReady: vi.fn().mockResolvedValue(true), userClient: vi.fn().mockReturnValue(client), create };
  return { client, getUser, rpc, maybeSingle, eq, createUser, deleteUser, loadAdmin, deps };
}

function request(token = "test-session", body: unknown = input, origin = "https://skyblue-falcon-639925.hostingersite.com") {
  return new Request("https://pixel-perfect-playground-893.lovable.app/api/public/customers/create", {
    method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Cloud customer API security and creation", () => {
  it("creates through the actor-scoped atomic RPC and returns only IDs", async () => {
    const f = fixtures();
    const res = await handleCustomerCreate(request(), f.deps);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ company_id: company, user_id: user });
    expect(f.getUser).toHaveBeenCalledWith("test-session");
    expect(f.rpc).toHaveBeenCalledWith("master_create_customer", { _actor: actor, _user: user, _email: input.email, _name: input.full_name, _phone: "", _company: input.company_name });
    expect(f.createUser).toHaveBeenCalledTimes(1);
    expect(f.eq).toHaveBeenCalledWith("email", input.email);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://skyblue-falcon-639925.hostingersite.com");
  });
  it("rejects missing sessions before any backend operation", async () => {
    const f = fixtures();
    expect((await handleCustomerCreate(request(""), f.deps)).status).toBe(401);
    expect(f.deps.userClient).not.toHaveBeenCalled();
  });
  it.each(["invalid", "expired", "revoked"])("rejects an %s session", async (token) => {
    const f = fixtures();
    f.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    expect((await handleCustomerCreate(request(token), f.deps)).status).toBe(401);
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.loadAdmin).not.toHaveBeenCalled();
  });
  it.each(["client", "employee", "suspended Super Admin", "revoked Super Admin"])("denies %s before loading privileged credentials", async () => {
    const f = fixtures();
    f.rpc.mockResolvedValue({ data: false, error: null });
    expect((await handleCustomerCreate(request(), f.deps)).status).toBe(403);
    expect(f.loadAdmin).not.toHaveBeenCalled();
  });
  it("checks authorization again before Auth creation", async () => {
    const f = fixtures();
    f.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect((await handleCustomerCreate(request(), f.deps)).status).toBe(403);
    expect(f.loadAdmin).not.toHaveBeenCalled();
  });
  it("rejects duplicate profiles without creating another Auth account", async () => {
    const f = fixtures();
    f.maybeSingle.mockResolvedValue({ data: { id: user }, error: null });
    const res = await handleCustomerCreate(request(), f.deps);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("DUPLICATE_ACCOUNT");
    expect(f.loadAdmin).not.toHaveBeenCalled();
  });
  it("lets Auth reject duplicate accounts absent from profiles without exposing raw errors", async () => {
    const f = fixtures();
    f.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: input.password } });
    const res = await handleCustomerCreate(request(), f.deps);
    expect(res.status).toBe(409);
    expect(await res.text()).not.toContain(input.password);
    expect(f.rpc.mock.calls.filter(([name]) => name === "master_create_customer")).toHaveLength(0);
  });
  it("rolls back only the newly created Auth user after a confirmed SQL failure", async () => {
    const f = fixtures();
    f.rpc.mockImplementation(async (name: string) => name === "routing_admin" ? { data: true, error: null } : { data: null, error: { message: input.password } });
    const res = await handleCustomerCreate(request(), f.deps);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("WORKSPACE_ROLLED_BACK");
    expect(f.deleteUser).toHaveBeenCalledExactlyOnceWith(user);
  });
  it("reports compensation failure honestly and does not leak the backend error", async () => {
    const f = fixtures();
    f.rpc.mockImplementation(async (name: string) => name === "routing_admin" ? { data: true, error: null } : { data: null, error: {} });
    f.deleteUser.mockResolvedValue({ error: { message: input.password } });
    const res = await handleCustomerCreate(request(), f.deps);
    const body = await res.json();
    expect(body.error).toBe("ROLLBACK_FAILED");
    expect(JSON.stringify(body)).not.toContain(input.password);
  });
  it("does not delete a potentially committed account when the RPC response is lost", async () => {
    const f = fixtures();
    f.rpc.mockImplementation(async (name: string) => { if (name === "routing_admin") return { data: true, error: null }; throw new Error("network"); });
    const res = await handleCustomerCreate(request(), f.deps);
    expect((await res.json()).error).toBe("CREATION_UNCERTAIN");
    expect(f.deleteUser).not.toHaveBeenCalled();
  });
  it("fails closed outside master mode", async () => {
    const f = fixtures();
    f.deps.masterReady.mockResolvedValue(false);
    expect((await handleCustomerCreate(request(), f.deps)).status).toBe(503);
    expect(f.deps.userClient).not.toHaveBeenCalled();
  });
  it("denies unexpected browser origins", async () => {
    const f = fixtures();
    const res = await handleCustomerCreate(request("test", input, "https://unrelated.example"), f.deps);
    expect(res.status).toBe(403);
    expect(res.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect(f.deps.create).not.toHaveBeenCalled();
  });
  it("supports Hostinger HTTPS preflight without granting credentials or writes", async () => {
    const f = fixtures();
    const res = await handleCustomerCreate(new Request(request().url, { method: "OPTIONS", headers: { Origin: "https://skyblue-falcon-639925.hostingersite.com" } }), f.deps);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
    expect(res.headers.has("Access-Control-Allow-Credentials")).toBe(false);
    expect(f.deps.create).not.toHaveBeenCalled();
  });
  it("rejects malformed input before privileged operations", async () => {
    const f = fixtures();
    expect((await handleCustomerCreate(request("test", { ...input, _actor: user }), f.deps)).status).toBe(400);
    expect(f.loadAdmin).not.toHaveBeenCalled();
  });
});