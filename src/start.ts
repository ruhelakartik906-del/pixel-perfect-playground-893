import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Customer installations (LICENSE_MODE=customer) block server functions while the
// central license is inactive. The Master CRM (default) is never blocked.
const licenseServerFnMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (!new URL(request.url).pathname.startsWith("/_serverFn")) return next();
  const { enforceLicenseForServerFn } = await import("./lib/license-gate.server");
  const blocked = await enforceLicenseForServerFn(request);
  if (blocked) return blocked;
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, licenseServerFnMiddleware],
}));
