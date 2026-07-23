import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents } from "@/lib/content";
import { isUpcoming, todayISO, weekendRange, formatDateRange } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";

/*
  Tijdgebonden landingspagina (SEO-PLAN fase 2): "opgietingen dit weekend".
  Toont events die (deels) in het eerstvolgende weekend vallen (vr t/m zo);
  in het weekend zelf telt vandaag t/m zondag. Met fallback tegen lege staat.
*/

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Opgietingen dit weekend",
  description:
    "Welke opgietingen, opgietweekenden en Aufguss-events zijn er dit weekend in sauna's in Nederland en België? Bekijk het actuele weekendoverzicht.",
  alternates: { canonical: "/opgietingen/dit-weekend" },
};

export default function DitWeekendPage() {
  const vandaag = todayISO();
  const { van, tot } = weekendRange(vandaag);
  const events = getAllEvents().filter(
    (e) => e.startDatum <= tot && (e.eindDatum ?? e.startDatum) >= van,
  );
  const eerstvolgende =
    events.length === 0 ? getAllEvents().filter((e) => isUpcoming(e, vandaag)).slice(0, 6) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {events.length > 0 && <JsonLd data={eventItemListSchema(events, "Opgietingen dit weekend", vandaag)} />}
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label: "Dit weekend" }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Opgietingen dit weekend
        </h1>
        <p className="mt-2 text-ink-soft">
          {events.length > 0
            ? `${events.length === 1 ? "Dit opgiet-event staat" : `Deze ${events.length} opgiet-events staan`} dit weekend (${formatDateRange(van, tot)}) op de agenda in Nederland en België.`
            : `Voor dit weekend (${formatDateRange(van, tot)}) staan er geen bijzondere opgiet-events op de agenda.`}{" "}
          Veel sauna&rsquo;s verzorgen in het weekend extra reguliere opgietingen, check daarvoor het
          opgietschema van de sauna zelf.
        </p>
      </header>

      {events.length > 0 ? (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.slug}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold text-ink">Eerstvolgende opgietingen</h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eerstvolgende.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Meer agenda" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/opgietingen/vandaag"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Opgietingen vandaag
        </Link>
        <Link
          href="/opgietweekenden"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Alle opgietweekenden
        </Link>
        <Link
          href="/agenda"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Volledige agenda
        </Link>
      </nav>
    </div>
  );
}
