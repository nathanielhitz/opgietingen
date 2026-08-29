import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllGidsen, getGidsBySlug } from "@/lib/content";
import { formatDate } from "@/lib/dates";
import { plainSummary } from "@/lib/text";
import { articleSchema, absoluteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { CoverImage } from "@/components/CoverImage";
import { Mdx } from "@/components/Mdx";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ProductCard } from "@/components/ProductCard";
import { getMerchProduct } from "@/lib/merch";
import { EigenProductCta } from "@/components/EigenProductCta";

export function generateStaticParams() {
  return getAllGidsen().map((g) => ({ slug: g.slug }));
}

export const dynamicParams = false;
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gids = getGidsBySlug(slug);
  if (!gids) return {};

  const description = gids.samenvatting || plainSummary(gids.body);
  return {
    title: gids.titel,
    description,
    alternates: { canonical: `/gids/${gids.slug}` },
    openGraph: {
      type: "article",
      title: gids.titel,
      description,
      url: absoluteUrl(`/gids/${gids.slug}`),
      ...(gids.afbeelding ? { images: [{ url: absoluteUrl(gids.afbeelding) }] } : {}),
    },
  };
}

export default async function GidsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gids = getGidsBySlug(slug);
  if (!gids) notFound();

  const eigenProduct = gids.eigenProduct ? getMerchProduct(gids.eigenProduct) : undefined;
  const heeftProducten = gids.producten.length > 0;
  // Plaatst de auteur zelf geen producten in de body, dan tonen we ze onderaan.
  const productenInBody = /<Product\b|<ProductGrid\b/.test(gids.body);

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd data={articleSchema(gids)} />

      <Breadcrumb
        items={[
          { href: "/gids", label: "Gids" },
          { label: gids.titel },
        ]}
      />

      <header className="mt-4">
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-4xl">{gids.titel}</h1>
        {gids.samenvatting && <p className="mt-3 text-lg text-ink-soft">{gids.samenvatting}</p>}
        {gids.bijgewerkt && (
          <p className="mt-2 text-xs text-ink-faint">Bijgewerkt op {formatDate(gids.bijgewerkt)}</p>
        )}
      </header>

      {eigenProduct && <EigenProductCta product={eigenProduct} />}

      {gids.afbeelding && (
        <div className="relative mt-5 overflow-hidden rounded-[--radius-card]">
          <CoverImage
            src={gids.afbeelding}
            alt={gids.titel}
            className="aspect-[16/9] sm:aspect-[2/1]"
            sizes="(max-width: 896px) 100vw, 896px"
          />
        </div>
      )}

      <div className="mt-6 min-w-0">
        <Mdx source={gids.body} producten={gids.producten} />
      </div>

      {heeftProducten && !productenInBody && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink">Onze aanraders</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {gids.producten.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {heeftProducten && (
        <div className="mt-10">
          <AffiliateDisclosure />
        </div>
      )}

      <nav aria-label="Meer op Opgietingen.nl" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/gids"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Alle gidsen
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
