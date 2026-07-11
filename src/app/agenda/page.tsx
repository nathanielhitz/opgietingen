import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents, getProvincesWithEvents, slugify } from "@/lib/content";
import { parseFilters, filterEvents, validateDateRange, type SearchParams } from "@/lib/filters";
import { AgendaFilters, type ProvinceOption } from "@/components/AgendaFilters";
import { AgendaEventCard } from "@/components/AgendaEventCard";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agenda — alle opgietingen in NL & BE",
  description:
    "Bekijk alle komende opgietingen, opgietweekenden en Aufguss-events in Nederland en België. Filter op land, provincie, datum en type.",
  alternates: { canonical: "/agenda" },
};

// Verse "komende events" via ISR (elk uur), zonder per-request te renderen als er geen filters zijn.
export const revalidate = 3600;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const filterError = validateDateRange(filters.van, filters.tot);
  const events = filterError ? [] : filterEvents(getAllEvents(), filters);

  const provinceOptions: ProvinceOption[] = getProvincesWithEvents().map((p) => ({
    ...p,
    slug: slugify(p.provincie),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Agenda</h1>
        <p className="mt-2 text-ink-soft">
          Alle komende opgietingen en Aufguss-events in Nederland en België. Filter op land, provincie, datum of type.
        </p>
      </header>

      <div className="mt-6">
        <AgendaFilters provinces={provinceOptions} error={filterError} />
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <p aria-live="polite" className="text-sm text-ink-faint">
          {events.length} {events.length === 1 ? "event" : "events"} gevonden
        </p>
      </div>

      {filterError ? null : events.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <li key={event.slug}>
              <AgendaEventCard event={event} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-[--radius-card] border border-dashed border-sand bg-surface p-10 text-center">
          <p className="font-display text-lg font-semibold text-ink">Geen events gevonden</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Pas je filters aan of bekijk de volledige agenda. Nieuwe opgietingen worden regelmatig toegevoegd.
          </p>
          <Link
            href="/agenda"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-ember px-4 text-sm font-medium text-white transition-colors hover:bg-ember/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2"
          >
            Wis alle filters
          </Link>
        </div>
      )}

      <p className="mt-10 text-xs text-ink-faint">
        Tip: sla een gefilterde weergave op door de URL te bewaren — filters staan in de link. Meer over {site.name} lees je{" "}
        <a href="/over" className="text-ember hover:underline">
          hier
        </a>
        .
      </p>
    </div>
  );
}
