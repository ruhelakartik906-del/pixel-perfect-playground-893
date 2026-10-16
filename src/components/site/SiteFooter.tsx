import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { productLinks } from "./SiteHeader";

export function SiteFooter() {
  const h = "mb-4 text-sm font-bold text-foreground";
  const a = "text-sm text-muted-foreground transition-colors hover:text-primary";
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] lg:px-8">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A lead management CRM that captures Meta ad enquiries and routes each one to the right person — with exact quotas per ad.
          </p>
        </div>
        <div>
          <p className={h}>Product</p>
          <ul className="space-y-2.5">
            {productLinks.map((l) => <li key={l.hash}><Link to="/features" hash={l.hash} className={a}>{l.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className={h}>Company</p>
          <ul className="space-y-2.5">
            <li><Link to="/about" className={a}>About Us</Link></li>
            <li><Link to="/how-it-works" className={a}>How It Works</Link></li>
            <li><Link to="/contact" className={a}>Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <p className={h}>Support</p>
          <ul className="space-y-2.5">
            <li><Link to="/faq" className={a}>FAQ & Help</Link></li>
            <li><Link to="/login" className={a}>Login</Link></li>
            <li><Link to="/register" className={a}>Register</Link></li>
          </ul>
        </div>
        <div>
          <p className={h}>Contact</p>
          <p className="text-sm text-muted-foreground">Send us a message through the contact form and our team will reply by email.</p>
          <Link to="/contact" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Open contact form →</Link>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <p>© {new Date().getFullYear()} Routiva CRM. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className={a}>Privacy Policy</Link>
            <Link to="/terms" className={a}>Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
