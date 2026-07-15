import { EventCard } from "@/components/EventCard";
import type { OpgietEvent } from "@/lib/content";

/*
  "Vergelijkbare events" onder een event-detailpagina: interne links naar
  komende events (zelfde sauna → provincie → type, zie getRelatedEvents).
  Houdt bezoekers op de site en verdeelt linkwaarde naar actuele pagina's.
*/
export function RelatedEvents({ events, titel = "Vergelijkbare opgietingen" }: { events: OpgietEvent[]; titel?: string }) {
  if (events.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-ink">{titel}</h2>
      <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <li key={event.slug}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}
