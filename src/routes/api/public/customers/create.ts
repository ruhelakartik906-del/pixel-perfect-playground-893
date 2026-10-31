import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/customers/create")({
  server: {
    handlers: {
      POST: async ({ request }) => (await import("@/lib/customer-create-api.server")).handleCustomerCreate(request),
      OPTIONS: async ({ request }) => (await import("@/lib/customer-create-api.server")).handleCustomerCreate(request),
      GET: async ({ request }) => (await import("@/lib/customer-create-api.server")).handleCustomerCreate(request),
    },
  },
});