import { createFileRoute, redirect } from "@tanstack/react-router";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/routing/campaign-ad-mapping")({
  head: () => adminHead("Campaign Mapping", "Campaign mapping has moved to Ad Routing Setup."),
  beforeLoad: () => { throw redirect({ to: "/admin/routing/ad-routing-setup", replace: true }); },
});