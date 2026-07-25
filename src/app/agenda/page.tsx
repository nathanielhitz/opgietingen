import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents, getProvincesWithEvents, slugify } from "@/lib/content";
import { parseFilters, filterEvents, validateDateRange, activeFilterCount, type SearchParams, type EventFilters } from "@/lib/filters";
import { todayISO, monthYearSlug } from "@/lib/dates";
import { AgendaFilters, type ProvinceOption } from "@/components/AgendaFilters";
import { AgendaEventCard } from "@/components/AgendaEventCard";
import { AgendaKalender, maandSlugNaarISO, maandPlus } from "@/components/AgendaKalender";
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

/** Querystring voor agenda-links; bewaart actieve filters en zet weergave/maand. */
function agendaQuery(filters: EventFilters, extra: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.land) params.set("land", filters.land);
  if (filters.provincie) params.set("provincie", filters.provincie);
  if (filters.type) params.set("type", filters.type);
  if (filters.van) params.set("van", filters.van);
  if (filters.tot) params.set("tot", filters.tot);
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/agenda?${qs}` : "/agenda";
}

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

  // Kalenderweergave (?weergave=kalender&maand=<maand-jaar>): navigeerbaar van de
  // huidige maand t/m de laatste maand met events; de maand vervangt het
  // van/tot-datumfilter, en afgelopen events blijven zichtbaar (gedimd).
  const isKalender = (Array.isArray(sp.weergave) ? sp.weergave[0] : sp.weergave) === "kalender";
  const vandaag = todayISO();
  const huidigeMaand = monthYearSlug(vandaag);
  const maandenMetEvents = new Set(getAllEvents().map((e) => monthYearSlug(e.startDatum)));
  const laatsteEventISO = getAllEvents()
    .map((e) => e.startDatum)
    .sort()
    .at(-1);
  const laatsteMaand =
    laatsteEventISO && laatsteEventISO > vandaag ? monthYearSlug(laatsteEventISO) : huidigeMaand;

  const gevraagdeMaand = Array.isArray(sp.maand) ? sp.maand[0] : sp.maand;
  const gevraagdISO = gevraagdeMaand ? maandSlugNaarISO(gevraagdeMaand) : null;
  const laatsteISO = maandSlugNaarISO(laatsteMaand)!;
  const maandSlug =
    gevraagdISO && gevraagdISO >= vandaag.slice(0, 8) + "01" && gevraagdISO <= laatsteISO
      ? gevraagdeMaand!
      : huidigeMaand;

  const kalenderEvents = filterError
    ? []
    : filterEvents(getAllEvents(), { ...filters, van: undefined, tot: undefined, toonAfgelopen: true });

  const vorigeMaand = maandPlus(maandSlug, -1);
  const volgendeMaand = maandPlus(maandSlug, 1);
  const vorige =
    vorigeMaand && maandSlugNaarISO(vorigeMaand)! >= vandaag.slice(0, 8) + "01" ? vorigeMaand : null;
  const volgende = volgendeMaand && maandSlugNaarISO(volgendeMaand)! <= laatsteISO ? volgendeMaand : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ItemList alleen op de ongefilterde lijstweergave (de canonieke inhoud) */}
      {!filterError && !isKalender && activeFilterCount(filters) === 0 && (
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-ink-faint">
          {isKalender
            ? `Kalenderweergave${activeFilterCount(filters) > 0 ? " (met filters)" : ""}`
            : `${events.length} ${events.length === 1 ? "event" : "events"} gevonden`}
        </p>
        <nav aria-label="Weergave" className="flex rounded-full border border-sand bg-cream p-0.5 text-sm font-medium">
          <Link
            href={agendaQuery(filters, {})}
            aria-current={!isKalender ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              !isKalender ? "bg-ember text-white" : "text-ink-soft hover:text-ember"
            }`}
          >
            Lijst
          </Link>
          <Link
            href={agendaQuery(filters, { weergave: "kalender" })}
            aria-current={isKalender ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              isKalender ? "bg-ember text-white" : "text-ink-soft hover:text-ember"
            }`}
          >
            Kalender
          </Link>
        </nav>
      </div>

      {filterError ? null : isKalender ? (
        <div className="mt-6">
          <AgendaKalender
            events={kalenderEvents}
            maandSlug={maandSlug}
            vandaag={vandaag}
            vorige={vorige}
            volgende={volgende}
            maandUrl={(slug) => agendaQuery(filters, { weergave: "kalender", maand: slug })}
            heeftMaandPagina={maandenMetEvents.has(maandSlug)}
          />
        </div>
      ) : events.length > 0 ? (
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
