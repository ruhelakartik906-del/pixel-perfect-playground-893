export function PageHero({ eyebrow, title, desc }: { eyebrow: string; title: React.ReactNode; desc: string }) {
  return (
    <section className="bg-hero">
      <div className="mx-auto max-w-4xl px-5 py-20 text-center lg:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-[52px]">{title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{desc}</p>
      </div>
    </section>
  );
}
