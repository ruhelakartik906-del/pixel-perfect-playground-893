import { createFileRoute, redirect } from "@tanstack/react-router";
import { adminHead } from "@/lib/admin-head";
export const Route = createFileRoute("/_authenticated/admin/routing/distribution-rules")({
  head: () => adminHead("Distribution Rules", "Lead distribution has moved to Ad Routing Setup."),
  beforeLoad: () => { throw redirect({ to: "/admin/routing/ad-routing-setup", replace: true }); },
});