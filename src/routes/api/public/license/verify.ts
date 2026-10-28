import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/license/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLicenseVerify } = await import("@/lib/license-verify.server");
        return handleLicenseVerify(request);
      },
      GET: () =>
        Response.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
