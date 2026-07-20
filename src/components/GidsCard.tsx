import Link from "next/link";
import type { Gids } from "@/lib/content";
import { CoverImage } from "@/components/CoverImage";

/* Kaart voor een gidsartikel op het /gids-overzicht. */
export function GidsCard({ gids }: { gids: Gids }) {
  return (
    <Link
      href={`/gids/${gids.slug}`}
      className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-sand bg-surface shadow-sm transition-shadow hover:shadow-md"
    >
      <CoverImage
        src={gids.afbeelding}
        alt={gids.titel}
        className="aspect-[16/9]"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
      />
      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-display text-lg font-semibold text-ink group-hover:text-ember">{gids.titel}</h2>
        {gids.samenvatting && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{gids.samenvatting}</p>
        )}
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ember">
          Lees de gids
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
