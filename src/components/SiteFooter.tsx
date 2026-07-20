import Link from "next/link";
import { site } from "@/lib/site";
import { getProvincesWithEvents, slugify } from "@/lib/content";

export function SiteFooter() {
  const year = 2026; // statisch: geen Date() in build om SSG-determinisme te bewaren
  // Top-provincies op event-aantal: sitewide interne links naar de
  // regiopagina's met het meeste aanbod (SEO-PLAN §8).
  const topProvincies = [...getProvincesWithEvents()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <footer className="mt-20 border-t border-sand bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-lg font-semibold text-ink">
            Opgietingen<span className="text-ember">.nl</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-ink-soft">{site.tagline}.</p>
        </div>

        <FooterCol title="Ontdekken">
          <FooterLink href="/agenda">Agenda</FooterLink>
          <FooterLink href="/opgietingen/vandaag">Opgietingen vandaag</FooterLink>
          <FooterLink href="/opgietingen/dit-weekend">Dit weekend</FooterLink>
          <FooterLink href="/opgietweekenden">Opgietweekenden</FooterLink>
          <FooterLink href="/aufguss-kampioenschappen">Kampioenschappen</FooterLink>
          <FooterLink href="/saunas">Sauna’s</FooterLink>
          <FooterLink href="/gids">Saunagids</FooterLink>
        </FooterCol>

        <FooterCol title="Per provincie">
          {topProvincies.map((p) => (
            <FooterLink key={p.provincie} href={`/opgietingen/${slugify(p.provincie)}`}>
              Opgietingen in {p.provincie}
            </FooterLink>
          ))}
        </FooterCol>

        <FooterCol title="Over ons">
          <FooterLink href="/wat-is-een-opgieting">Wat is een opgieting?</FooterLink>
          <FooterLink href="/over">Over Opgietingen.nl</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
          <FooterLink href="/voor-saunas">Voor sauna’s</FooterLink>
        </FooterCol>

        <FooterCol title="Meer">
          <FooterLink href="/privacybeleid">Privacybeleid</FooterLink>
          <FooterLink href="/cookiebeleid">Cookiebeleid</FooterLink>
          <FooterLink href="/sitemap.xml">Sitemap</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-sand/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {year} {site.name} · Gemaakt voor saunaliefhebbers in NL &amp; BE.</span>
          <span>
            Built by{" "}
            <a
              href="https://www.hitzdigital.nl/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink-soft transition-colors hover:text-ember"
            >
              HitzDigital
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-soft transition-colors hover:text-ember">
        {children}
      </Link>
    </li>
  );
}
