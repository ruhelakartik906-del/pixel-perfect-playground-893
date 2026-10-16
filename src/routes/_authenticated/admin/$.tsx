import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { titleForPath } from "@/components/admin/nav";
import { Breadcrumb, Card, PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/$")({
  head: () => ({ meta: [
    { title: "Admin — Routiva CRM" },
    { name: "description", content: "Routiva CRM master admin module." },
    { property: "og:title", content: "Admin — Routiva CRM" },
    { property: "og:description", content: "Routiva CRM master admin module." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ModulePlaceholder,
});

function ModulePlaceholder() {
  const { _splat = "" } = Route.useParams();
  const title = titleForPath(_splat);
  return (
    <div className="space-y-5">
      <Breadcrumb label={title} />
      <PageHeader title={title} subtitle="This module is scheduled for an upcoming build phase." />
      <Card className="flex flex-col items-center gap-3 py-24 text-center">
        <Construction className="size-12 text-admin-blue" strokeWidth={1.4} />
        <p className="text-lg font-semibold">{title} is coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">The layout and navigation are ready. Data, forms and actions for this page will be added in a later phase.</p>
      </Card>
    </div>
  );
}
