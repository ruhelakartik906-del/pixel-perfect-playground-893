// Web Crypto only, so this runs on Workers and in tests.
export function generateInstallationCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "rlic_" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function hashInstallationCredential(credential: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const credentialPattern = /^rlic_[A-Za-z0-9_-]{43}$/;
export const installationIdPattern = /^RCRM-[A-F0-9]{32}$/;
