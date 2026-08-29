import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents } from "@/lib/content";
import { isUpcoming, todayISO } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";

/*
  Type-landingspagina (SEO-PLAN fase 2): "opgietweekend" is een eigen zoekterm
  met eigen intentie. Programmatische lijst + redactionele uitleg.
*/

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Opgietweekenden in Nederland & België",
  description:
    "Alle komende opgietweekenden: hele weekenden vol extra opgietingen, gastopgieters en showsessies in sauna's in Nederland en België. Bekijk data en locaties.",
  alternates: { canonical: "/opgietweekenden" },
};

export default function OpgietweekendenPage() {
  const vandaag = todayISO();
  const events = getAllEvents().filter((e) => e.type === "opgietweekend" && isUpcoming(e, vandaag));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {events.length > 0 && <JsonLd data={eventItemListSchema(events, "Komende opgietweekenden", vandaag)} />}
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label: "Opgietweekenden" }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Opgietweekenden</h1>
        <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">
          <p>
            Een <strong className="text-ink">opgietweekend</strong> is een weekend waarin een sauna
            het gewone opgietschema flink opschroeft: extra veel sessies, vaak met gastopgieters van
            andere sauna&rsquo;s of deelnemers aan het NK en BK Aufguss, bijzondere geuren en
            showopgietingen die je doordeweeks niet ziet.
          </p>
          <p>
            Voor liefhebbers is het dé manier om in één dagentree veel verschillende opgietstijlen
            mee te maken; voor nieuwkomers een leuke (maar warme) kennismaking.{" "}
            <Link href="/wat-is-een-opgieting" className="font-medium text-ember hover:underline">
              Lees eerst wat een opgieting is
            </Link>{" "}
            als het je eerste keer wordt. Het programma is meestal inbegrepen bij de entree; check
            altijd de website van de sauna voor het actuele schema.
          </p>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold text-ink">Komende opgietweekenden</h2>
        {events.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 max-w-2xl text-ink-soft">
            Er staan op dit moment geen opgietweekenden in de agenda. Nieuwe events worden wekelijks
            toegevoegd, bekijk intussen de{" "}
            <Link href="/agenda" className="font-medium text-ember hover:underline">
              volledige agenda
            </Link>
            .
          </p>
        )}
      </section>

      <nav aria-label="Meer agenda" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/opgietingen/dit-weekend"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Opgietingen dit weekend
        </Link>
        <Link
          href="/aufguss-kampioenschappen"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Aufguss-kampioenschappen
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
