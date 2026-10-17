import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/sales/products-services")({
  beforeLoad: () => { throw redirect({ to: "/admin/sales/products", replace: true }); },
  head: () => ({ meta: [{ title: "Product Catalog — Routiva CRM" }, { name: "description", content: "Routiva CRM product catalog." }, { property: "og:title", content: "Product Catalog — Routiva CRM" }, { property: "og:description", content: "Routiva CRM product catalog." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});