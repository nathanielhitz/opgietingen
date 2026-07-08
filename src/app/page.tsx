import Link from "next/link";
import { getAllEvents, getAllSaunas, getProvincesWithEvents, slugify } from "@/lib/content";
import { EVENT_TYPES, COUNTRY_LABELS, type EventType } from "@/lib/site";
import { isUpcoming, monthYearSlug, monthYearLabel } from "@/lib/dates";
import { EventCard } from "@/components/EventCard";
import { SaunaCard } from "@/components/SaunaCard";
import { JsonLd } from "@/components/JsonLd";
import { siteSchema } from "@/lib/schema";

export const revalidate = 3600;

export default function HomePage() {
  const upcoming = getAllEvents().filter((e) => isUpcoming(e));
  const komende = upcoming.slice(0, 6);
  const provinces = getProvincesWithEvents();
  const saunas = getAllSaunas();

  // Unieke maanden met events, voor snelle SEO-links.
  const months = Array.from(
    new Map(upcoming.map((e) => [monthYearSlug(e.startDatum), e.startDatum])).entries()
  ).slice(0, 6);

  return (
    <div>
      <JsonLd data={siteSchema()} />
      {/* Hero — licht, met zoekbalk */}
      <section className="warmth-gradient border-b border-sand">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-ember">Opgietingen · Aufguss · NL &amp; BE</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Vind de mooiste opgietingen bij jou in de buurt
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">
            Dé agenda voor opgietweekenden, thema-avonden en Aufguss-kampioenschappen in sauna's in Nederland en België.
          </p>

          {/* Zoekbalk: GET-form naar /agenda (werkt zonder JS) */}
          <form action="/agenda" className="mt-8 flex max-w-2xl flex-col gap-3 rounded-[--radius-card] border border-sand bg-surface/90 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block px-1 text-xs font-medium text-ink-faint">Provincie</span>
              <select name="provincie" className="w-full rounded-lg border border-sand bg-cream px-3 py-2.5 text-sm text-ink focus:border-ember focus:outline-none">
                <option value="">Alle provincies</option>
                {provinces.map((p) => (
                  <option key={p.provincie} value={slugify(p.provincie)}>
                    {p.provincie} — {COUNTRY_LABELS[p.land]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="mb-1 block px-1 text-xs font-medium text-ink-faint">Type</span>
              <select name="type" className="w-full rounded-lg border border-sand bg-cream px-3 py-2.5 text-sm text-ink focus:border-ember focus:outline-none">
                <option value="">Alle types</option>
                {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPES[t]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
            >
              Zoek opgietingen
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Komende events */}
        <section className="py-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Binnenkort</h2>
              <p className="mt-1 text-ink-soft">De eerstvolgende opgietingen op de kalender.</p>
            </div>
            <Link href="/agenda" className="hidden shrink-0 text-sm font-medium text-ember hover:underline sm:block">
              Volledige agenda →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {komende.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
          <Link href="/agenda" className="mt-6 block text-sm font-medium text-ember hover:underline sm:hidden">
            Volledige agenda →
          </Link>
        </section>

        {/* Ontdek per provincie + per maand */}
        <section className="border-t border-sand py-14">
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Ontdek per regio</h2>
          <p className="mt-1 text-ink-soft">Bekijk opgietingen in jouw provincie.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {provinces.map((p) => (
              <Link
                key={p.provincie}
                href={`/opgietingen/${slugify(p.provincie)}`}
                className="rounded-full border border-sand bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember"
              >
                {p.provincie} <span className="text-ink-faint">({p.count})</span>
              </Link>
            ))}
          </div>

          {months.length > 0 && (
            <>
              <h3 className="mt-10 font-display text-lg font-semibold text-ink">Per maand</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {months.map(([slug]) => (
                  <Link
                    key={slug}
                    href={`/agenda/${slug}`}
                    className="rounded-full border border-sand bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember"
                  >
                    {monthYearLabel(slug)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Uitgelichte sauna's */}
        <section className="border-t border-sand py-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Sauna's</h2>
              <p className="mt-1 text-ink-soft">De adressen achter de opgietingen.</p>
            </div>
            <Link href="/saunas" className="hidden shrink-0 text-sm font-medium text-ember hover:underline sm:block">
              Alle sauna's →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saunas.map((sauna) => (
              <li key={sauna.slug}>
                <SaunaCard sauna={sauna} />
              </li>
            ))}
          </ul>
        </section>

        {/* B2B-CTA */}
        <section className="mb-16 mt-2 overflow-hidden rounded-[--radius-card] bg-wood-dark warmth-gradient p-8 sm:p-12">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Organiseer je een opgieting?</h2>
            <p className="mt-3 text-cream/85">
              Zet jouw sauna en events op de kaart bij duizenden saunaliefhebbers in Nederland en België.
            </p>
            <Link
              href="/voor-saunas"
              className="mt-6 inline-block rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
            >
              Meer voor sauna's
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
