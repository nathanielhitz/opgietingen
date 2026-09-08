import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { currentMonthSlug, todayISO } from "@/lib/dates";
import { kanaalUitParam } from "@/lib/utm";
import { linkKnoppen } from "@/lib/links-in-bio";
import { SocialLinks } from "@/components/SocialLinks";

/*
  Link-in-bio op eigen domein (spec §3.3). De bio-URL per kanaal is
  /links?k=instagram|facebook|tiktok; elke knop krijgt UTM's met die bron.
  Dynamisch (searchParams + huidige maand), noindex, niet in de sitemap.
*/

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Links",
  description: `Snel naar de agenda, dit weekend, de saunagids en meer van ${site.name}.`,
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const knoppen = linkKnoppen(currentMonthSlug(todayISO()), kanaalUitParam(k));

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="font-display text-3xl font-semibold text-ink">
          Opgietingen<span className="text-ember">.nl</span>
        </p>
        <p className="mt-2 text-ink-soft">{site.tagline}.</p>
      </div>

      <ul className="mt-8 space-y-3">
        {knoppen.map((knop) => (
          <li key={knop.label}>
            <Link
              href={knop.href}
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-sand bg-surface px-5 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-ember hover:text-ember"
            >
              {knop.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Volg ons</p>
        <SocialLinks />
      </div>
    </div>
  );
}
