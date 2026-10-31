import { describe, expect, it, beforeAll } from "vitest";
import { connectionStatus, decryptToken, encryptToken, validMetaSignature } from "@/lib/whatsapp-meta.server";

beforeAll(() => { process.env["WHATSAPP_TOKEN_ENCRYPTION_KEY"] = "test-key-for-unit-tests-only-0123456789"; });

describe("org WhatsApp helpers", () => {
  it("round-trips tokens and never stores plaintext", async () => {
    const enc = await encryptToken("EAAG-secret-token");
    expect(enc).not.toContain("EAAG");
    expect(await decryptToken(enc)).toBe("EAAG-secret-token");
  });
  it("rejects a token decrypted with a different key", async () => {
    const enc = await encryptToken("abc");
    process.env["WHATSAPP_TOKEN_ENCRYPTION_KEY"] = "another-key-entirely-9876543210";
    await expect(decryptToken(enc)).rejects.toBeTruthy();
    process.env["WHATSAPP_TOKEN_ENCRYPTION_KEY"] = "test-key-for-unit-tests-only-0123456789";
  });
  it("accepts only a correct Meta signature", async () => {
    const body = '{"object":"whatsapp_business_account"}';
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("appsecret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hex = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await validMetaSignature("appsecret", body, `sha256=${hex}`)).toBe(true);
    expect(await validMetaSignature("wrong", body, `sha256=${hex}`)).toBe(false);
    expect(await validMetaSignature("appsecret", body + " ", `sha256=${hex}`)).toBe(false);
    expect(await validMetaSignature("appsecret", body, null)).toBe(false);
  });
  it("is connected only when authorization, registration and webhooks are all verified", () => {
    expect(connectionStatus({ token_ok: true, number_registered: true, webhook_subscribed: true })).toBe("connected");
    expect(connectionStatus({ token_ok: true, number_registered: false, webhook_subscribed: true })).toBe("error");
    expect(connectionStatus({ token_ok: true, number_registered: true, webhook_subscribed: false })).toBe("error");
  });
});
