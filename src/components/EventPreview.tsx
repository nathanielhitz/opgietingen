import type { OpgietEvent } from "@/lib/content";
import { mdxExcerpt } from "@/lib/content";
import { formatDateRange } from "@/lib/dates";
import { TypeBadge } from "@/components/TypeBadge";

/*
  Compacte event-preview voor de hovercard (EventHoverCard): titel, datum,
  sauna en de eerste zinnen van de beschrijving. Server-rendered; de client-
  wrapper regelt alleen tonen/positioneren.
*/
export function EventPreview({ event }: { event: OpgietEvent }) {
  const excerpt = mdxExcerpt(event.body);
  return (
    <div className="w-72 rounded-[--radius-card] border border-sand bg-surface p-4 shadow-lg">
      <TypeBadge type={event.type} />
      <p className="mt-2 font-display text-base font-semibold leading-snug text-ink">{event.titel}</p>
      <p className="mt-1 text-sm font-medium text-ember">
        {formatDateRange(event.startDatum, event.eindDatum)}
        {event.tijden ? ` · ${event.tijden}` : ""}
      </p>
      <p className="text-sm text-ink-soft">
        {event.sauna.naam} · {event.sauna.plaats}
      </p>
      {excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{excerpt}</p>}
      <p className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink-soft">{event.prijsIndicatie ?? ""}</span>
        <span className="shrink-0 font-medium text-ember">Bekijk event →</span>
      </p>
    </div>
  );
}
