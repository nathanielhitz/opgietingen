import type { Metadata } from "next";
import Link from "next/link";
import { getAllEvents } from "@/lib/content";
import { isUpcoming, todayISO, formatDateRange } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";

/*
  Evergreen kampioenschapspagina (SEO-PLAN fase 2): bewust géén jaartal in de
  URL, zodat "NK aufguss 2026", "NK aufguss 2027" enz. jaar na jaar op
  dezelfde, steeds rijkere pagina landen. Verlopen edities blijven zichtbaar
  als archief.
*/

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Aufguss-kampioenschappen: NK & BK opgieten",
  description:
    "Alles over Aufguss-kampioenschappen in Nederland en België: wat wedstrijd-opgieten is en waar en wanneer het NK en BK plaatsvinden. Bekijk de komende edities.",
  alternates: { canonical: "/aufguss-kampioenschappen" },
};

export default function KampioenschappenPage() {
  const vandaag = todayISO();
  const alle = getAllEvents().filter((e) => e.type === "kampioenschap");
  const komend = alle.filter((e) => isUpcoming(e, vandaag));
  const eerdere = alle.filter((e) => !isUpcoming(e, vandaag)).reverse(); // recentste eerst

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {komend.length > 0 && <JsonLd data={eventItemListSchema(komend, "Komende Aufguss-kampioenschappen")} />}
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label: "Kampioenschappen" }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Aufguss-kampioenschappen
        </h1>
        <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">
          <p>
            Bij een <strong className="text-ink">Aufguss-kampioenschap</strong> strijden
            saunameesters met wedstrijdopgietingen om de titel: sessies van 12 tot 15 minuten waarin
            handdoektechniek, verhaal, muziek, geurkeuze en hittebeheersing door een jury worden
            beoordeeld. Winnaars mogen vaak door naar internationale wedstrijden, zoals het
            wereldkampioenschap Aufguss.
          </p>
          <p>
            In Nederland wordt jaarlijks het <strong className="text-ink">NK Aufguss</strong>{" "}
            gehouden en in België het <strong className="text-ink">BK</strong>, spektakelstukken
            die je ook als bezoeker kunt bijwonen. Ook zonder verstand van wedstrijdopgieten is het
            een indrukwekkende ervaring;{" "}
            <Link href="/wat-is-een-opgieting" className="font-medium text-ember hover:underline">
              lees hier wat een opgieting is
            </Link>{" "}
            als je nieuw bent. Kom op tijd: finales zitten snel vol.
          </p>
        </div>

        {/* Editie-uitlichting: de actuele WK-subpagina (audit-item 12 / V5) */}
        <p className="mt-5 rounded-2xl border border-sand bg-surface px-5 py-4">
          <strong className="text-ink">Dit jaar:</strong> het WK Aufguss 2026 vindt van 14 t/m 20
          september plaats bij Satama Sauna Resort, vlak bij Berlijn, met eind augustus de
          WM-playoffs bij Thermen Bussloo.{" "}
          <Link
            href="/aufguss-kampioenschappen/wk-2026"
            className="font-medium text-ember hover:underline"
          >
            Lees alles over het WK Aufguss 2026
          </Link>
          .
        </p>
      </header>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold text-ink">Komende kampioenschappen</h2>
        {komend.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {komend.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 max-w-2xl text-ink-soft">
            Er is op dit moment geen kampioenschap aangekondigd. Zodra de volgende editie van het NK
            of BK bekend is, vind je hem hier en in de{" "}
            <Link href="/agenda" className="font-medium text-ember hover:underline">
              volledige agenda
            </Link>
            .
          </p>
        )}
      </section>

      {eerdere.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-ink">Eerdere edities</h2>
          <ul className="mt-4 space-y-2 text-ink-soft">
            {eerdere.map((event) => (
              <li key={event.slug}>
                <Link href={`/event/${event.slug}`} className="font-medium text-ember hover:underline">
                  {event.titel}
                </Link>
                , {event.sauna.naam}, {formatDateRange(event.startDatum, event.eindDatum)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Meer agenda" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/opgietweekenden"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Opgietweekenden
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
