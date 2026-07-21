import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllEvents,
  getAllSaunas,
  getProvincesWithSaunas,
  getProvincieIntro,
  slugify,
} from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";
import { isUpcoming } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { SaunaCard } from "@/components/SaunaCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Mdx } from "@/components/Mdx";

type Params = Promise<{ provincie: string }>;

/*
  Provinciepagina's bestaan zolang er een sauna in de provincie staat — niet
  alleen zolang er events zijn. Zo blijft de URL (en de opgebouwde ranking)
  bestaan wanneer het laatste event verloopt (SEO-PLAN §9). Provincies zonder
  sauna's krijgen bewust géén pagina (doorway-risico).
*/

// Alleen provincies met sauna's bestaan; andere provincie-URL's zijn 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getProvincesWithSaunas().map((p) => ({ provincie: slugify(p.provincie) }));
}

function resolveProvince(slug: string) {
  const match = getProvincesWithSaunas().find((p) => slugify(p.provincie) === slug);
  return match ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { provincie } = await params;
  const found = resolveProvince(provincie);
  if (!found) return {};
  const title = `Opgietingen in ${found.provincie}`;
  return {
    title,
    description: `Alle opgietingen, opgietweekenden en Aufguss-events in sauna's in ${found.provincie} (${COUNTRY_LABELS[found.land]}). Bekijk de agenda en de sauna's in de regio.`,
    alternates: { canonical: `/opgietingen/${provincie}` },
    openGraph: { title, type: "website" },
  };
}

export default async function ProvincePage({ params }: { params: Params }) {
  const { provincie } = await params;
  const found = resolveProvince(provincie);
  if (!found) notFound();

  const events = getAllEvents().filter((e) => slugify(e.sauna.provincie) === provincie && isUpcoming(e));
  const saunas = getAllSaunas().filter((s) => slugify(s.provincie) === provincie);
  const intro = getProvincieIntro(provincie);

  // Lege staat: geef de bezoeker (en de crawler) alsnog inhoud — de
  // eerstvolgende opgietingen buiten de provincie.
  const eldersEvents =
    events.length === 0
      ? getAllEvents()
          .filter((e) => slugify(e.sauna.provincie) !== provincie && isUpcoming(e))
          .slice(0, 3)
      : [];

  // Buurprovincies (zelfde land) voor interne links.
  const overigeProvincies = getProvincesWithSaunas().filter(
    (p) => slugify(p.provincie) !== provincie && p.land === found.land,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {events.length > 0 && <JsonLd data={eventItemListSchema(events, `Opgietingen in ${found.provincie}`)} />}
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label: found.provincie }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Opgietingen in {found.provincie}
        </h1>
        {intro ? (
          <div className="mt-2 text-ink-soft">
            <Mdx source={intro} />
          </div>
        ) : (
          <p className="mt-2 text-ink-soft">
            Komende opgietingen en Aufguss-events in sauna&rsquo;s in {found.provincie} (
            {COUNTRY_LABELS[found.land]}). Nieuw met opgieten?{" "}
            <Link href="/wat-is-een-opgieting" className="font-medium text-ember hover:underline">
              Lees wat een opgieting is
            </Link>
            .
          </p>
        )}
      </header>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold text-ink">Komende opgietingen</h2>
        {events.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-3 max-w-2xl text-ink-soft">
              Er staan op dit moment geen opgietingen gepland in {found.provincie}. Nieuwe events worden
              wekelijks toegevoegd, kom binnenkort terug, of bekijk de{" "}
              <Link href="/agenda" className="font-medium text-ember hover:underline">
                volledige agenda
              </Link>
              .
            </p>
            {eldersEvents.length > 0 && (
              <div className="mt-6">
                <h3 className="font-display text-lg font-semibold text-ink">Eerstvolgende opgietingen elders</h3>
                <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {eldersEvents.map((event) => (
                    <li key={event.slug}>
                      <EventCard event={event} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {saunas.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-ink">Sauna&rsquo;s in {found.provincie}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saunas.map((sauna) => (
              <li key={sauna.slug}>
                <SaunaCard sauna={sauna} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {overigeProvincies.length > 0 && (
        <nav aria-label="Andere provincies" className="mt-12">
          <h2 className="font-display text-lg font-semibold text-ink">
            Opgietingen in andere provincies ({COUNTRY_LABELS[found.land]})
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {overigeProvincies.map((p) => (
              <Link
                key={p.provincie}
                href={`/opgietingen/${slugify(p.provincie)}`}
                className="rounded-full border border-sand bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember"
              >
                Opgietingen in {p.provincie}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Brug naar de saunagids: voorbereiding + affiliate-gidsen (interne links) */}
      <nav aria-label="Saunagids" className="mt-12 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/gids/zo-werkt-een-opgieting-voor-beginners"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Eerste keer? Zo werkt een opgieting
        </Link>
        <Link
          href="/gids/wat-neem-je-mee-naar-een-opgieting"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Wat neem je mee?
        </Link>
      </nav>

      <div className="mt-10">
        <Link href="/agenda" className="text-sm font-medium text-ember hover:underline">
          ← Volledige agenda
        </Link>
      </div>
    </div>
  );
}
