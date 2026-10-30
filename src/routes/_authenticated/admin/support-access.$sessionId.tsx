import { createFileRoute } from "@tanstack/react-router";
import { SupportWorkspace } from "@/components/admin/SupportWorkspace";

export const Route = createFileRoute("/_authenticated/admin/support-access/$sessionId")({
  head: () => ({
    meta: [
      { title: "Customer Support Access — Routiva CRM Admin" },
      { name: "description", content: "Time-limited, audited access to a customer workspace." },
      { property: "og:title", content: "Customer Support Access — Routiva CRM Admin" },
      { property: "og:description", content: "Time-limited, audited access to a customer workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: function SupportAccessRoute() {
    const { sessionId } = Route.useParams();
    return <SupportWorkspace key={sessionId} sessionId={sessionId} />;
  },
});
