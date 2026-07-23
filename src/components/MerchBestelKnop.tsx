"use client";

import { track } from "@vercel/analytics";

/*
  Bestelknop voor eigen merch. Linkt via /uit/merch/<slug> zodat de klik
  serverside gelogd wordt (zelfde principe als AffiliateButton), plus een
  Vercel Analytics-event. Geen rel="sponsored": eigen product.
*/
export function MerchBestelKnop({ slug, label }: { slug: string; label: string }) {
  return (
    <a
      href={`/uit/merch/${slug}`}
      onClick={() => track("uit-merch-klik", { slug })}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
    >
      {label}
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
