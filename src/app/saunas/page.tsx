import type { Metadata } from "next";
import { getAllSaunas, getEventsForSauna } from "@/lib/content";
import { COUNTRY_LABELS, type Country } from "@/lib/site";
import { isUpcoming } from "@/lib/dates";
import { SaunaCard } from "@/components/SaunaCard";

export const metadata: Metadata = {
  title: "Sauna's met opgietingen in NL & BE",
  description:
    "Ontdek sauna's in Nederland en België met opgietingen en Aufguss-events. Bekijk faciliteiten, locatie en de komende agenda per sauna.",
  alternates: { canonical: "/saunas" },
};

export const revalidate = 3600;

export default function SaunasPage() {
  const saunas = getAllSaunas();
  const upcomingCount = (slug: string) => getEventsForSauna(slug).filter((e) => isUpcoming(e)).length;

  const byCountry = (["NL", "BE"] as Country[])
    .map((land) => ({ land, saunas: saunas.filter((s) => s.land === land) }))
    .filter((g) => g.saunas.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Sauna's</h1>
        <p className="mt-2 text-ink-soft">
          Sauna's in Nederland en België met opgietingen en Aufguss-events. Bekijk faciliteiten, locatie en de komende
          agenda per sauna.
        </p>
      </header>

      {byCountry.map((group) => (
        <section key={group.land} className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink">
            {COUNTRY_LABELS[group.land]}{" "}
            <span className="text-sm font-normal text-ink-faint">({group.saunas.length})</span>
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.saunas.map((sauna) => (
              <li key={sauna.slug}>
                <SaunaCard sauna={sauna} eventCount={upcomingCount(sauna.slug)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-10 text-xs text-ink-faint">
        Een interactieve overzichtskaart met alle sauna's volgt. Locatie per sauna vind je nu op de saunapagina zelf.
      </p>
    </div>
  );
}
