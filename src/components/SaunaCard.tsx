import Link from "next/link";
import type { Sauna } from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";
import { CoverImage } from "@/components/CoverImage";

export function SaunaCard({ sauna, eventCount }: { sauna: Sauna; eventCount?: number }) {
  return (
    <Link
      href={`/sauna/${sauna.slug}`}
      className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-sand bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
    >
      <div className="relative">
        <CoverImage
          src={sauna.afbeelding}
          alt={sauna.naam}
          fallbackLogo={sauna.logo}
          fallbackLogoDonker={sauna.logoAchtergrond === "donker"}
          className="aspect-[16/10]"
          sizes="(max-width: 640px) 100vw, 400px"
        />
        {sauna.sponsored && (
          <span className="absolute left-3 top-3 rounded-full bg-cream/90 px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm">
            Uitgelicht
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold text-ink transition-colors group-hover:text-ember">
          {sauna.naam}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {sauna.plaats}, {sauna.provincie} · {COUNTRY_LABELS[sauna.land]}
        </p>
        {sauna.faciliteiten.length > 0 && (
          <p className="mt-3 line-clamp-2 text-xs text-ink-faint">{sauna.faciliteiten.slice(0, 4).join(" · ")}</p>
        )}
        {typeof eventCount === "number" && (
          <p className="mt-auto pt-3 text-sm font-medium text-ember">
            {eventCount > 0
              ? `${eventCount} ${eventCount === 1 ? "komend event" : "komende events"}`
              : "Nog geen geplande events"}
          </p>
        )}
      </div>
    </Link>
  );
}
