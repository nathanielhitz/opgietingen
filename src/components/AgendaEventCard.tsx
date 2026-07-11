import Link from "next/link";
import type { OpgietEvent } from "@/lib/content";
import { formatDateShort } from "@/lib/dates";
import { CoverImage } from "@/components/CoverImage";
import { TypeBadge } from "@/components/TypeBadge";

export function AgendaEventCard({ event }: { event: OpgietEvent }) {
  const { sauna } = event;

  return (
    <Link
      href={`/event/${event.slug}`}
      className="group grid grid-cols-[5.5rem_minmax(0,1fr)] overflow-hidden rounded-[--radius-card] border border-sand bg-surface shadow-sm transition hover:border-ember/30 hover:shadow-md active:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember sm:grid-cols-[8rem_7rem_minmax(0,1fr)_auto]"
    >
      <CoverImage
        src={event.afbeelding}
        alt=""
        className="row-span-3 h-full min-h-28 sm:row-span-1 sm:min-h-32"
        sizes="(max-width: 639px) 5.5rem, 8rem"
      />

      <div className="min-w-0 px-3 pt-3 text-sm font-semibold text-ember tabular-nums sm:px-4 sm:py-4">
        <p className="break-words">{formatDateShort(event.startDatum)}</p>
        {event.tijden && <p className="mt-1 break-words text-xs font-medium text-ink-soft">{event.tijden}</p>}
      </div>

      <div className="min-w-0 px-3 py-2 sm:px-4 sm:py-4">
        <h2 className="break-words font-display text-base font-semibold leading-snug text-ink transition-colors group-hover:text-ember sm:text-lg">
          {event.titel}
        </h2>
        <p className="mt-1 break-words text-sm font-medium text-ink-soft">{sauna.naam}</p>
        <p className="break-words text-sm text-ink-soft">{sauna.plaats}</p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 pb-3 sm:flex-col sm:items-end sm:justify-center sm:px-4 sm:py-4">
        <TypeBadge type={event.type} />
        {event.prijsIndicatie && (
          <span className="break-words text-right text-xs font-semibold text-ink-soft">{event.prijsIndicatie}</span>
        )}
      </div>
    </Link>
  );
}
