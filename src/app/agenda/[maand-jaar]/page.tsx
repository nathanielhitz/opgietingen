import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllEvents } from "@/lib/content";
import { monthYearSlug, monthYearLabel, parseMonthYearSlug } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";

type Params = Promise<{ "maand-jaar": string }>;

// Alleen maanden met events bestaan; elke andere maand-URL is een echte 404.
// Zonder deze grens is /agenda/maart-2031 een indexeerbare lege pagina
// (oneindige crawl-ruimte, SEO-PLAN §9).
export const dynamicParams = false;

/** Maandslugs met events, chronologisch gesorteerd. */
function monthSlugsChronological(): string[] {
  const byMonth = new Map<string, string>(); // "YYYY-MM" -> slug
  for (const e of getAllEvents()) {
    byMonth.set(e.startDatum.slice(0, 7), monthYearSlug(e.startDatum));
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, slug]) => slug);
}

export function generateStaticParams() {
  return monthSlugsChronological().map((slug) => ({ "maand-jaar": slug }));
}

/** Events die (deels) in de opgegeven maand vallen. */
function eventsInMonth(slug: string) {
  const parsed = parseMonthYearSlug(slug);
  if (!parsed) return null;
  const { monthIndex, year } = parsed;
  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
  const events = getAllEvents().filter((e) => {
    const eEnd = e.eindDatum ?? e.startDatum;
    return e.startDatum <= end && eEnd >= start;
  });
  return { events };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const slug = (await params)["maand-jaar"];
  const label = monthYearLabel(slug);
  if (!label) return {};
  const title = `Opgietingen in ${label}`;
  return {
    title,
    description: `Alle opgietingen, opgietweekenden en Aufguss-events in ${label} in sauna's in Nederland en België.`,
    alternates: { canonical: `/agenda/${slug}` },
    openGraph: { title, type: "website" },
  };
}

export default async function MonthPage({ params }: { params: Params }) {
  const slug = (await params)["maand-jaar"];
  const label = monthYearLabel(slug);
  const result = eventsInMonth(slug);
  if (!label || !result) notFound();

  const { events } = result;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={eventItemListSchema(events, `Opgietingen in ${label}`)} />
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Opgietingen in {label}</h1>
        <p className="mt-2 text-ink-soft">
          {events.length > 0
            ? `${events.length} ${events.length === 1 ? "opgieting" : "opgietingen"} en Aufguss-events in ${label} in Nederland en België.`
            : `Er staan nog geen opgietingen gepland in ${label}. Bekijk de volledige agenda voor andere maanden.`}
        </p>
      </header>

      {events.length > 0 && (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.slug}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}

      {/* Maand-navigatie: alleen naar maanden die echt events hebben */}
      <MaandNav huidige={slug} />

      <div className="mt-10">
        <Link href="/agenda" className="text-sm font-medium text-ember hover:underline">
          ← Volledige agenda
        </Link>
      </div>
    </div>
  );
}

function MaandNav({ huidige }: { huidige: string }) {
  const slugs = monthSlugsChronological();
  const i = slugs.indexOf(huidige);
  const vorige = i > 0 ? slugs[i - 1] : null;
  const volgende = i >= 0 && i < slugs.length - 1 ? slugs[i + 1] : null;
  if (!vorige && !volgende) return null;

  return (
    <nav aria-label="Maandnavigatie" className="mt-10 flex justify-between gap-4 text-sm font-medium">
      {vorige ? (
        <Link href={`/agenda/${vorige}`} className="text-ember hover:underline">
          ← Opgietingen in {monthYearLabel(vorige)}
        </Link>
      ) : (
        <span />
      )}
      {volgende && (
        <Link href={`/agenda/${volgende}`} className="text-ember hover:underline">
          Opgietingen in {monthYearLabel(volgende)} →
        </Link>
      )}
    </nav>
  );
}
