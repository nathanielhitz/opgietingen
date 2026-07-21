"use client";

import { track } from "@vercel/analytics";
import type { GidsProduct } from "@/lib/content";
import { CoverImage } from "@/components/CoverImage";

/*
  Affiliate-productkaart voor gidsartikelen. Linkt via de redirect
  (/uit/product/<id>) zodat kliks meetbaar zijn; rel="sponsored nofollow
  noopener" markeert de affiliate-relatie voor zoekmachines (bol.com-compliance).

  Naast de serverside redirect-log sturen we een Vercel Analytics-event
  ("uit-product-klik") voor kliks per product in het dashboard. track() is
  fire-and-forget en mag de navigatie nooit blokkeren.
*/
export function ProductCard({ product }: { product: GidsProduct }) {
  return (
    <a
      href={`/uit/product/${product.id}`}
      rel="sponsored nofollow noopener"
      target="_blank"
      onClick={() => track("uit-product-klik", { product: product.id })}
      className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-sand bg-surface shadow-sm transition-shadow hover:shadow-md"
    >
      <CoverImage
        src={product.afbeelding}
        alt={product.naam}
        className="aspect-[4/3]"
        sizes="(max-width: 640px) 100vw, 320px"
      />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold text-ink">{product.naam}</h3>
        {product.beschrijving && (
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-soft">{product.beschrijving}</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2 pt-1">
          {product.prijsIndicatie ? (
            <span className="text-sm font-medium text-ink">{product.prijsIndicatie}</span>
          ) : (
            <span className="text-xs text-ink-faint">Bekijk op bol.com</span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ember px-3.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-ember/90">
            Bekijken
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}
