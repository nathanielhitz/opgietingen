import type { Country, EventType } from "@/lib/site";
import { EVENT_TYPES } from "@/lib/site";
import { slugify, type OpgietEvent } from "@/lib/content";
import { isUpcoming } from "@/lib/dates";

/** Filtercriteria voor de agenda. Alles optioneel; leeg = toon komende events. */
export interface EventFilters {
  land?: Country;
  /** Provincie als slug (bv. "noord-holland"). */
  provincie?: string;
  type?: EventType;
  /** Vanaf-datum (ISO). */
  van?: string;
  /** Tot-en-met-datum (ISO). */
  tot?: string;
  /** Toon ook afgelopen events (default false). */
  toonAfgelopen?: boolean;
}

export type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Leest EventFilters uit URL-searchparams (?land=NL&provincie=...&type=...&van=...&tot=...&toon=alles). */
export function parseFilters(sp: SearchParams): EventFilters {
  const land = first(sp.land);
  const type = first(sp.type);
  return {
    land: land === "NL" || land === "BE" ? land : undefined,
    provincie: first(sp.provincie) || undefined,
    type: type && type in EVENT_TYPES ? (type as EventType) : undefined,
    van: first(sp.van) || undefined,
    tot: first(sp.tot) || undefined,
    toonAfgelopen: first(sp.toon) === "alles",
  };
}

/** Past filters toe. Sorteervolgorde (op datum) blijft behouden vanuit de loader. */
export function filterEvents(
  events: OpgietEvent[],
  f: EventFilters,
  ref?: string
): OpgietEvent[] {
  return events.filter((e) => {
    if (!f.toonAfgelopen && !isUpcoming(e, ref)) return false;
    if (f.land && e.sauna.land !== f.land) return false;
    if (f.provincie && slugify(e.sauna.provincie) !== f.provincie) return false;
    if (f.type && e.type !== f.type) return false;

    const eind = e.eindDatum ?? e.startDatum;
    if (f.van && eind < f.van) return false;
    if (f.tot && e.startDatum > f.tot) return false;
    return true;
  });
}

/** Telt hoeveel filters actief zijn (voor UI-badge). */
export function activeFilterCount(f: EventFilters): number {
  return [f.land, f.provincie, f.type, f.van, f.tot].filter(Boolean).length;
}
