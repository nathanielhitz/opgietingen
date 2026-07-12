import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllEvents, getAllSaunas, getProvincesWithEvents, slugify } from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";
import { isUpcoming } from "@/lib/dates";
import { eventItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { SaunaCard } from "@/components/SaunaCard";
import { Breadcrumb } from "@/components/Breadcrumb";

type Params = Promise<{ provincie: string }>;

export function generateStaticParams() {
  return getProvincesWithEvents().map((p) => ({ provincie: slugify(p.provincie) }));
}

function resolveProvince(slug: string) {
  const match = getProvincesWithEvents().find((p) => slugify(p.provincie) === slug);
  return match ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { provincie } = await params;
  const found = resolveProvince(provincie);
  if (!found) return {};
  const title = `Opgietingen in ${found.provincie}`;
  return {
    title,
    description: `Alle opgietingen, opgietweekenden en Aufguss-events in sauna's in ${found.provincie} (${COUNTRY_LABELS[found.land]}). Filter op datum en type.`,
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={eventItemListSchema(events, `Opgietingen in ${found.provincie}`)} />
      <Breadcrumb items={[{ href: "/agenda", label: "Agenda" }, { label: found.provincie }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Opgietingen in {found.provincie}
        </h1>
        <p className="mt-2 text-ink-soft">
          Komende opgietingen en Aufguss-events in sauna’s in {found.provincie} ({COUNTRY_LABELS[found.land]}).
        </p>
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
          <p className="mt-3 text-ink-soft">
            Er staan nu geen opgietingen gepland in {found.provincie}. Bekijk de{" "}
            <Link href="/agenda" className="font-medium text-ember hover:underline">
              volledige agenda
            </Link>
            .
          </p>
        )}
      </section>

      {saunas.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-ink">Sauna’s in {found.provincie}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saunas.map((sauna) => (
              <li key={sauna.slug}>
                <SaunaCard sauna={sauna} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <Link href="/agenda" className="text-sm font-medium text-ember hover:underline">
          ← Volledige agenda
        </Link>
      </div>
    </div>
  );
}
