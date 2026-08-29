import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents } from "@/lib/content";
import { isUpcoming, todayISO, formatDate } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";

/*
  Tijdgebonden landingspagina (SEO-PLAN fase 2): "opgieting vandaag".
  ISR ververst elk uur; op dagen zonder events toont de pagina de
  eerstvolgende opgietingen zodat hij nooit leeg (thin) is.
*/

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Opgietingen vandaag",
  description:
    "Welke opgietingen en Aufguss-events zijn er vandaag in sauna's in Nederland en België? Bekijk het actuele overzicht en plan je saunabezoek.",
  alternates: { canonical: "/opgietingen/vandaag" },
};

export default function VandaagPage() {
  const vandaag = todayISO();
  const events = getAllEvents().filter(
    (e) => e.startDatum <= vandaag && (e.eindDatum ?? e.startDatum) >= vandaag,
  );
  const eerstvolgende =
    events.length === 0 ? getAllEvents().filter((e) => isUpcoming(e, vandaag)).slice(0, 6) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {events.length > 0 && <JsonLd data={eventItemListSchema(events, "Opgietingen vandaag", vandaag)} />}
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label: "Vandaag" }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Opgietingen vandaag</h1>
        <p className="mt-2 text-ink-soft">
          {events.length > 0
            ? `${events.length === 1 ? "Dit opgiet-event is" : `Deze ${events.length} opgiet-events zijn`} er vandaag (${formatDate(vandaag)}) in Nederland en België.`
            : `Er staan vandaag (${formatDate(vandaag)}) geen bijzondere opgiet-events op de agenda.`}{" "}
          Los van deze events verzorgen veel sauna&rsquo;s dagelijks reguliere opgietingen volgens hun
          eigen schema. Nieuw met opgieten?{" "}
          <Link href="/wat-is-een-opgieting" className="font-medium text-ember hover:underline">
            Lees eerst wat een opgieting is
          </Link>
          .
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
          href="/opgietingen/dit-weekend"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Opgietingen dit weekend
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
