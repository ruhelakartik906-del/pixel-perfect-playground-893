import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Routiva CRM home">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground shadow-cta">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M5 8v2a4 4 0 0 0 4 4h1.5M19 8v2a4 4 0 0 1-4 4h-1.5M12 14v2" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">
        Routiva<span className="text-primary"> CRM</span>
      </span>
    </Link>
  );
}
