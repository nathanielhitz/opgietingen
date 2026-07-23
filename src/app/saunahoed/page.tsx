import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMerchProduct, isBestelbaar, formatEuro } from "@/lib/merch";
import { formatDate } from "@/lib/dates";
import { plainSummary } from "@/lib/text";
import { merchProductSchema, absoluteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { CoverImage } from "@/components/CoverImage";
import { Mdx } from "@/components/Mdx";
import { Breadcrumb } from "@/components/Breadcrumb";
import { MerchBestelKnop } from "@/components/MerchBestelKnop";

export const revalidate = 3600;

const SLUG = "saunahoed";

export function generateMetadata(): Metadata {
  const product = getMerchProduct(SLUG);
  if (!product) return {};
  const description = plainSummary(product.body);
  return {
    title: `${product.naam} kopen`,
    description,
    alternates: { canonical: `/${SLUG}` },
    openGraph: {
      type: "website",
      title: product.naam,
      description,
      url: absoluteUrl(`/${SLUG}`),
      ...(product.afbeeldingen[0]
        ? { images: [{ url: absoluteUrl(product.afbeeldingen[0]) }] }
        : {}),
    },
  };
}

export default function SaunahoedPage() {
  const product = getMerchProduct(SLUG);
  if (!product) notFound();

  const bestelbaar = isBestelbaar(product);

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd data={merchProductSchema(product)} />

      <Breadcrumb items={[{ label: product.naam }]} />

      <header className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ember">Eigen product</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-4xl">
          {product.naam}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          <span className="font-semibold text-ink">{formatEuro(product.prijs)}</span>
          {product.verzendkosten === 0
            ? " incl. verzending (NL & BE)"
            : ` + ${formatEuro(product.verzendkosten)} verzendkosten`}
        </p>
        {product.bijgewerkt && (
          <p className="mt-2 text-xs text-ink-faint">Bijgewerkt op {formatDate(product.bijgewerkt)}</p>
        )}
      </header>

      {product.afbeeldingen[0] && (
        <div className="relative mt-5 overflow-hidden rounded-[--radius-card]">
          <CoverImage
            src={product.afbeeldingen[0]}
            alt={product.naam}
            className="aspect-[16/9] sm:aspect-[2/1]"
            sizes="(max-width: 896px) 100vw, 896px"
          />
        </div>
      )}

      <div className="mt-6">
        {bestelbaar ? (
          <MerchBestelKnop slug={product.slug} label={`Bestel voor ${formatEuro(product.prijs)}`} />
        ) : product.productStatus === "uitverkocht" ? (
          <div className="rounded-[--radius-card] border border-sand bg-surface p-5">
            <p className="font-semibold text-ink">Tijdelijk uitverkocht</p>
            <p className="mt-1 text-sm text-ink-soft">
              We laten een nieuwe oplage maken. Wil je bericht zodra de hoed er weer is?{" "}
              <a
                href="mailto:info@opgietingen.nl?subject=Saunahoed weer leverbaar"
                className="font-medium text-ember hover:underline"
              >
                Stuur ons een mailtje
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-[--radius-card] border border-sand bg-surface p-5">
            <p className="font-semibold text-ink">Binnenkort beschikbaar</p>
            <p className="mt-1 text-sm text-ink-soft">
              De eerste oplage wordt nu gemaakt. Wil je bericht bij de lancering?{" "}
              <a
                href="mailto:info@opgietingen.nl?subject=Houd mij op de hoogte van de saunahoed"
                className="font-medium text-ember hover:underline"
              >
                Stuur ons een mailtje
              </a>
              .
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 min-w-0">
        <Mdx source={product.body} />
      </div>

      {product.afbeeldingen.length > 1 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {product.afbeeldingen.slice(1).map((src) => (
            <div key={src} className="relative overflow-hidden rounded-[--radius-card]">
              <CoverImage
                src={src}
                alt={product.naam}
                className="aspect-[4/3]"
                sizes="(max-width: 640px) 100vw, 440px"
              />
            </div>
          ))}
        </div>
      )}

      <nav aria-label="Meer op Opgietingen.nl" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/gids/beste-saunahoed-2026"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Saunahoeden vergelijken
        </Link>
        <Link
          href="/agenda"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Bekijk de agenda
        </Link>
      </nav>
    </article>
  );
}
