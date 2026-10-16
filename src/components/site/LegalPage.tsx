import { PageHero } from "./PageHero";

export function LegalPage({ title, sections }: { title: string; sections: [string, string][] }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} desc="This summary describes how Routiva CRM handles your information. Please contact us with any questions." />
      <section className="py-16">
        <div className="mx-auto max-w-3xl space-y-8 px-5">
          {sections.map(([h, p]) => (
            <div key={h}><h2 className="text-xl font-bold">{h}</h2><p className="mt-2 leading-relaxed text-muted-foreground">{p}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
