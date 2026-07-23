import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";
import { formatEuro, isBestelbaar, type MerchProduct } from "@/lib/merch";

/*
  Uitgelicht blok voor een eigen merch-product bovenaan een gidsartikel.
  Duidelijk gelabeld als eigen product: dit is geen affiliate-aanbeveling en
  valt dus buiten de affiliate-disclosure van de gids.
*/
export function EigenProductCta({ product }: { product: MerchProduct }) {
  const statusLabel = isBestelbaar(product)
    ? null
    : product.productStatus === "uitverkocht"
      ? "Tijdelijk uitverkocht"
      : "Binnenkort beschikbaar";

  return (
    <Link
      href={`/${product.slug}`}
      className="group mt-6 flex flex-col overflow-hidden rounded-[--radius-card] border border-ember/30 bg-ember-tint shadow-sm transition-shadow hover:shadow-md sm:flex-row"
    >
      {product.afbeeldingen[0] && (
        <div className="relative sm:w-56 sm:flex-none">
          <CoverImage
            src={product.afbeeldingen[0]}
            alt={product.naam}
            className="aspect-[4/3] h-full"
            sizes="(max-width: 640px) 100vw, 224px"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ember">Ons eigen product</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ink">{product.naam}</h2>
        {statusLabel && <p className="mt-1 text-sm text-ink-soft">{statusLabel}</p>}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{formatEuro(product.prijs)}</span>
          <span className="inline-flex items-center rounded-full bg-ember px-3.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-ember/90">
            Bekijken
          </span>
        </div>
      </div>
    </Link>
  );
}
