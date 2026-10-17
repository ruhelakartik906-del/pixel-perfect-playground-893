export function adminHead(title: string, description: string) {
  const t = `${title} — Routiva CRM Admin`;
  return { meta: [
    { title: t }, { name: "description", content: description },
    { property: "og:title", content: t }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] };
}

export function initials(name: string) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
