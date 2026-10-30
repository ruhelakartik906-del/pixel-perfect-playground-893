import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code and loader data on hover/focus so sidebar clicks feel instant.
    defaultPreload: "intent",
    // TanStack Query owns data freshness (per-query staleTime); the router preload
    // cache must not serve stale loader results on its own.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
