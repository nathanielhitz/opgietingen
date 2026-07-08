import Link from "next/link";
import type { OpgietEvent } from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";
import { formatDateRange } from "@/lib/dates";
import { TypeBadge } from "@/components/TypeBadge";
import { CoverImage } from "@/components/CoverImage";

export function EventCard({ event }: { event: OpgietEvent }) {
  const { sauna } = event;

  return (
    <Link
      href={`/event/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-sand bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
    >
      <div className="relative">
        <CoverImage src={event.afbeelding} alt={event.titel} className="aspect-[16/10]" sizes="(max-width: 640px) 100vw, 400px" />
        <div className="absolute left-3 top-3 flex gap-2">
          <TypeBadge type={event.type} className="shadow-sm" />
          {sauna.sponsored && (
            <span className="inline-flex items-center rounded-full bg-cream/90 px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm">
              Uitgelicht
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm font-medium text-ember">{formatDateRange(event.startDatum, event.eindDatum)}</p>
        <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-ink transition-colors group-hover:text-ember">
          {event.titel}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {sauna.naam} · {sauna.plaats}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-faint">
          <span>
            {sauna.provincie}, {COUNTRY_LABELS[sauna.land]}
          </span>
          {event.prijsIndicatie && <span className="font-medium text-ink-soft">{event.prijsIndicatie}</span>}
        </div>
      </div>
    </Link>
  );
}
