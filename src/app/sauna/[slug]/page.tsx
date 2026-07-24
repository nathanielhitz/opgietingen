import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSaunas, getSaunaBySlug, getEventsForSauna, slugify } from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";
import { isUpcoming, formatDate } from "@/lib/dates";
import { plainSummary } from "@/lib/text";
import { saunaSchema, absoluteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { CoverImage } from "@/components/CoverImage";
import { MapEmbed } from "@/components/MapEmbed";
import { Mdx } from "@/components/Mdx";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AffiliateButton } from "@/components/AffiliateButton";

export function generateStaticParams() {
  return getAllSaunas().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sauna = getSaunaBySlug(slug);
  if (!sauna) return {};

  const description = plainSummary(sauna.body);
  const title = `${sauna.naam}: opgietingen & Aufguss in ${sauna.plaats}`;
  return {
    title,
    description,
    alternates: { canonical: `/sauna/${sauna.slug}` },
    // Bewust géén openGraph.images: die zou de dynamische per-sauna OG-image
    // (opengraph-image.tsx, met naam/plaats op merk-achtergrond) overschrijven.
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/sauna/${sauna.slug}`),
    },
  };
}

export default async function SaunaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sauna = getSaunaBySlug(slug);
  if (!sauna) notFound();

  const events = getEventsForSauna(sauna.slug);
  const komende = events.filter((e) => isUpcoming(e));

  return (
    <article className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd data={saunaSchema(sauna)} />

      <Breadcrumb items={[{ href: "/saunas", label: "Sauna's" }, { label: sauna.naam }]} />

      {/* Hero */}
      <div className="relative mt-4 overflow-hidden rounded-[--radius-card]">
        <CoverImage
          src={sauna.afbeelding}
          alt={sauna.naam}
          fallbackLogo={sauna.logo}
          fallbackLogoDonker={sauna.logoAchtergrond === "donker"}
          className="aspect-[16/9] sm:aspect-[5/2]"
          sizes="(max-width: 1024px) 100vw, 1024px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-wood-dark/80 via-wood-dark/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
          {((sauna.logo && sauna.afbeelding) || sauna.sponsored) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {/* Logo-chip alleen naast een echte foto; zonder foto is het logo al het hoofdbeeld. */}
              {sauna.logo && sauna.afbeelding && (
                <span
                  className={`inline-flex h-11 items-center rounded-lg px-3 shadow-sm sm:h-12 ${
                    sauna.logoAchtergrond === "donker" ? "bg-wood-dark/90" : "bg-white/95"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo's hebben per sauna andere verhoudingen; next/image vereist vaste maten */}
                  <img src={sauna.logo} alt="" className="h-6 w-auto max-w-44 object-contain sm:h-7" />
                </span>
              )}
              {sauna.sponsored && (
                <span className="inline-block rounded-full bg-cream/90 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  Uitgelicht
                </span>
              )}
            </div>
          )}
          <h1 className="font-display text-2xl font-semibold text-white drop-shadow-sm sm:text-4xl">{sauna.naam}</h1>
          <p className="mt-1 text-sm text-cream/90 sm:text-base">
            {sauna.plaats}, {sauna.provincie} · {COUNTRY_LABELS[sauna.land]}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Mdx source={sauna.body} />

          {/* Vaste opgiettijden: uniek datapunt voor long-tail zoekverkeer
              ("opgietingen tijden {sauna}"); alleen wat de sauna-site vermeldt. */}
          {sauna.opgietRooster && (
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold text-ink">
                Vaste opgiettijden bij {sauna.naam}
              </h2>
              <dl className="mt-4 overflow-hidden rounded-[--radius-card] border border-sand bg-surface">
                {sauna.opgietRooster.map((regel, i) => (
                  <div
                    key={regel.dag}
                    className={`flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6 ${i > 0 ? "border-t border-sand" : ""}`}
                  >
                    <dt className="w-40 flex-none text-sm font-semibold text-ink">{regel.dag}</dt>
                    <dd className="text-sm text-ink-soft">{regel.tijden}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-ink-faint">
                {sauna.roosterGecheckt
                  ? `Gecontroleerd op ${formatDate(sauna.roosterGecheckt)} via de website van de sauna. `
                  : ""}
                Roosters wijzigen per seizoen; raadpleeg de website van de sauna voor het actuele
                programma.
              </p>
            </section>
          )}

          {sauna.faciliteiten.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold text-ink">Faciliteiten</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {sauna.faciliteiten.map((f) => (
                  <li key={f} className="rounded-full border border-sand bg-surface px-3 py-1.5 text-sm text-ink-soft">
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[--radius-card] border border-sand bg-surface p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-ink">Bezoek deze sauna</h2>
            <p className="mt-1 text-sm text-ink-soft">{sauna.adres}</p>
            <div className="mt-4">
              <AffiliateButton slug={sauna.slug} label="Naar de sauna" />
              <p className="mt-2 text-center text-xs text-ink-faint">Je gaat naar de website van de sauna.</p>
            </div>
          </div>
          <MapEmbed lat={sauna.lat} lng={sauna.lng} label={sauna.naam} />

          {/* Brug naar de saunagids: voorbereiding + affiliate-gidsen (interne links) */}
          <div className="rounded-[--radius-card] border border-sand bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Goed voorbereid</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                <Link href="/gids/wat-neem-je-mee-naar-een-opgieting" className="font-medium text-ember hover:underline">
                  Wat neem je mee naar een opgieting?
                </Link>
              </li>
              <li>
                <Link href="/gids/zo-werkt-een-opgieting-voor-beginners" className="font-medium text-ember hover:underline">
                  Eerste keer? Zo werkt een opgieting
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Komende events */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-ink">Komende opgietingen</h2>
        {komende.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {komende.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink-soft">Er staan nog geen opgietingen gepland bij deze sauna. Kom snel terug!</p>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-4 text-sm font-medium">
        <Link href="/saunas" className="text-ember hover:underline">
          ← Alle sauna’s
        </Link>
        {/* Hub-and-spoke: sauna → eigen provinciepagina (interne linking, SEO-PLAN §8) */}
        <Link href={`/opgietingen/${slugify(sauna.provincie)}`} className="text-ember hover:underline">
          Opgietingen in {sauna.provincie}
        </Link>
        <Link href="/agenda" className="text-ember hover:underline">
          Volledige agenda →
        </Link>
      </div>
    </article>
  );
}
