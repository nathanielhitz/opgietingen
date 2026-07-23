import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents, getProvincesWithEvents, slugify } from "@/lib/content";
import { parseFilters, filterEvents, validateDateRange, activeFilterCount, type SearchParams } from "@/lib/filters";
import { todayISO } from "@/lib/dates";
import { AgendaFilters, type ProvinceOption } from "@/components/AgendaFilters";
import { AgendaEventCard } from "@/components/AgendaEventCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { eventItemListSchema } from "@/lib/schema";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agenda: alle opgietingen in NL & BE",
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
  const provinceOptions: ProvinceOption[] = getProvincesWithEvents().map((p) => ({
    ...p,
    slug: slugify(p.provincie),
  }));
  const filters = parseFilters(sp, provinceOptions);
  const filterError = validateDateRange(filters.van, filters.tot);
  const events = filterError ? [] : filterEvents(getAllEvents(), filters);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ItemList alleen op de ongefilterde weergave (de canonieke inhoud) */}
      {!filterError && activeFilterCount(filters) === 0 && (
        <JsonLd data={eventItemListSchema(events, "Alle komende opgietingen in Nederland en België", todayISO())} />
      )}
      <Breadcrumb items={[{ label: "Agenda" }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Agenda</h1>
        <p className="mt-2 text-ink-soft">
          Alle komende opgietingen en Aufguss-events in Nederland en België. Filter op land, provincie, datum of type.
        </p>
      </header>

      <div className="mt-6">
        <AgendaFilters provinces={provinceOptions} filters={filters} error={filterError} />
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

      {/* Retentie: abonneerbare agenda (webcal/ICS) + RSS van nieuwe events */}
      <div className="mt-10 rounded-[--radius-card] border border-sand bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Agenda in je eigen kalender</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Abonneer je op de opgietagenda in Google Calendar, Apple Agenda of Outlook, dan verschijnen nieuwe
          opgietingen er vanzelf bij. Of volg nieuwe events via RSS.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
          <a
            href={`${site.url.replace(/^https?:\/\//, "webcal://")}/agenda.ics`}
            className="rounded-full border border-sand bg-cream px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
          >
            Abonneer in je kalender-app
          </a>
          <a
            href="/agenda.ics"
            className="rounded-full border border-sand bg-cream px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
          >
            Download .ics
          </a>
          <a
            href="/feed.xml"
            className="rounded-full border border-sand bg-cream px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
          >
            RSS-feed
          </a>
        </div>
      </div>

      <p className="mt-10 text-xs text-ink-faint">
        Tip: sla een gefilterde weergave op door de URL te bewaren, filters staan in de link. Meer over {site.name} lees je{" "}
        <a href="/over" className="text-ember hover:underline">
          hier
        </a>
        . Programma en tijden kunnen wijzigen; de website van de sauna is leidend.
      </p>
    </div>
  );
}
