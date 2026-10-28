import { createFileRoute } from "@tanstack/react-router";

// Shows only this installation's own license state (no secrets) so a blocked customer CRM can explain why.
export const Route = createFileRoute("/api/public/license/status")({
  server: {
    handlers: {
      GET: async () => {
        const { currentLicense } = await import("@/lib/license-gate.server");
        const d = await currentLicense();
        return Response.json(
          { mode: d.status === "master" ? "master" : "customer", allowed: d.allowed, status: d.status },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
