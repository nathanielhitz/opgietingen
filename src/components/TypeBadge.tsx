import { EVENT_TYPES, type EventType } from "@/lib/site";

const styles: Record<EventType, string> = {
  opgietweekend: "bg-ember-tint text-ember",
  thema: "bg-steam-tint text-steam",
  kampioenschap: "bg-wood-dark text-ember-soft",
  regulier: "bg-sand text-ink-soft",
};

export function TypeBadge({ type, className = "" }: { type: EventType; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[type]} ${className}`}
    >
      {EVENT_TYPES[type]}
    </span>
  );
}
