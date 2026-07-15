import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllEvents, getEventBySlug } from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";
import { formatDateRange } from "@/lib/dates";
import { plainSummary } from "@/lib/text";
import { eventSchema, absoluteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { TypeBadge } from "@/components/TypeBadge";
import { CoverImage } from "@/components/CoverImage";
import { Mdx } from "@/components/Mdx";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AffiliateButton } from "@/components/AffiliateButton";
import { InfoRow } from "@/components/InfoRow";

export function generateStaticParams() {
  return getAllEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return {};

  const description = plainSummary(event.body);
  const title = `${event.titel} bij ${event.sauna.naam}`;
  return {
    title,
    description,
    alternates: { canonical: `/event/${event.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(`/event/${event.slug}`),
      ...(event.afbeelding ? { images: [{ url: absoluteUrl(event.afbeelding) }] } : {}),
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

  const { sauna } = event;

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd data={eventSchema(event)} />

      <Breadcrumb
        items={[
          { href: "/agenda", label: "Agenda" },
          { label: event.titel },
        ]}
      />

      {/* Hero */}
      <div className="relative mt-4 overflow-hidden rounded-[--radius-card]">
        <CoverImage src={event.afbeelding} alt={event.titel} className="aspect-[16/9] sm:aspect-[2/1]" sizes="(max-width: 896px) 100vw, 896px" />
        <div className="absolute inset-0 bg-gradient-to-t from-wood-dark/80 via-wood-dark/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={event.type} className="shadow-sm" />
            {sauna.sponsored && (
              <span className="rounded-full bg-cream/90 px-2.5 py-1 text-xs font-semibold text-ink-soft">Uitgelicht</span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold text-white drop-shadow-sm sm:text-4xl">
            {event.titel}
          </h1>
          <p className="mt-1 text-sm text-cream/90 sm:text-base">
            {formatDateRange(event.startDatum, event.eindDatum)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Beschrijving / programma */}
        <div className="min-w-0">
          <Mdx source={event.body} />
        </div>

        {/* Zijbalk: praktisch + CTA */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[--radius-card] border border-sand bg-surface p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-ink">Praktisch</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <InfoRow label="Datum">{formatDateRange(event.startDatum, event.eindDatum)}</InfoRow>
              {event.tijden && <InfoRow label="Tijden">{event.tijden}</InfoRow>}
              {event.prijsIndicatie && <InfoRow label="Prijs">{event.prijsIndicatie}</InfoRow>}
              <InfoRow label="Locatie">
                <Link href={`/sauna/${sauna.slug}`} className="font-medium text-ember hover:underline">
                  {sauna.naam}
                </Link>
                <br />
                {sauna.plaats}, {sauna.provincie} ({COUNTRY_LABELS[sauna.land]})
              </InfoRow>
            </dl>

            <div className="mt-5">
              <AffiliateButton slug={event.slug} label={`Bekijk bij ${sauna.naam}`} />
              <p className="mt-2 text-center text-xs text-ink-faint">Je gaat naar de website van de sauna.</p>
              <p className="mt-2 text-center text-xs text-ink-faint">
                Programma en tijden kunnen wijzigen. Controleer de actuele informatie op de website van de sauna.
              </p>
            </div>
          </div>

          <Link
            href={`/sauna/${sauna.slug}`}
            className="mt-4 flex items-center gap-3 rounded-[--radius-card] border border-sand bg-surface p-4 transition-shadow hover:shadow-md"
          >
            <CoverImage src={sauna.afbeelding} alt={sauna.naam} className="h-14 w-14 flex-none rounded-lg" />
            <span className="min-w-0">
              <span className="block text-xs text-ink-faint">Over de sauna</span>
              <span className="block truncate font-medium text-ink">{sauna.naam}</span>
            </span>
          </Link>
        </aside>
      </div>

      <div className="mt-10">
        <Link href="/agenda" className="text-sm font-medium text-ember hover:underline">
          ← Terug naar de agenda
        </Link>
      </div>
    </article>
  );
}
