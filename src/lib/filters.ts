import type { Country, EventType } from "@/lib/site";
import { EVENT_TYPES } from "@/lib/site";
import { slugify, type OpgietEvent } from "@/lib/content";
import { isUpcoming } from "@/lib/dates";

/** Filtercriteria voor de agenda. Alles optioneel; leeg = toon komende events. */
export interface EventFilters {
  /** Vrije zoekopdracht. */
  q?: string;
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

export interface ProvinceFilterOption {
  slug: string;
  land: Country;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isRealIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Leest EventFilters uit URL-searchparams (?land=NL&provincie=...&type=...&van=...&tot=...&toon=alles). */
export function parseFilters(
  sp: SearchParams,
  provinceOptions?: readonly ProvinceFilterOption[]
): EventFilters {
  const land = first(sp.land);
  const parsedLand = land === "NL" || land === "BE" ? land : undefined;
  const type = first(sp.type);
  const q = first(sp.q)?.trim() || undefined;
  const provincie = first(sp.provincie) || undefined;
  const van = first(sp.van);
  const tot = first(sp.tot);
  const validProvince = provinceOptions
    ? provinceOptions.some(
        (option) => option.slug === provincie && (!parsedLand || option.land === parsedLand)
      )
      ? provincie
      : undefined
    : provincie;
  return {
    q,
    land: parsedLand,
    provincie: validProvince,
    type: type && Object.hasOwn(EVENT_TYPES, type) ? (type as EventType) : undefined,
    van: isRealIsoDate(van) ? van : undefined,
    tot: isRealIsoDate(tot) ? tot : undefined,
    toonAfgelopen: first(sp.toon) === "alles",
  };
}

/** Geeft een foutmelding wanneer het datumbereik omgekeerd is. */
export function validateDateRange(van?: string, tot?: string): string | null {
  return van && tot && tot < van ? "De einddatum ligt vóór de begindatum." : null;
}

/** Past filters toe. Sorteervolgorde (op datum) blijft behouden vanuit de loader. */
export function filterEvents(
  events: OpgietEvent[],
  f: EventFilters,
  ref?: string
): OpgietEvent[] {
  if (validateDateRange(f.van, f.tot)) return [];

  const query = f.q ? slugify(f.q) : undefined;
  return events.filter((e) => {
    if (!f.toonAfgelopen && !isUpcoming(e, ref)) return false;
    if (f.land && e.sauna.land !== f.land) return false;
    if (f.provincie && slugify(e.sauna.provincie) !== f.provincie) return false;
    if (f.type && e.type !== f.type) return false;
    if (
      query &&
      ![e.titel, e.sauna.naam, e.sauna.plaats, e.sauna.provincie]
        .map(slugify)
        .join(" ")
        .includes(query)
    ) {
      return false;
    }

    const eind = e.eindDatum ?? e.startDatum;
    if (f.van && eind < f.van) return false;
    if (f.tot && e.startDatum > f.tot) return false;
    return true;
  });
}

/** Telt hoeveel filters actief zijn (voor UI-badge). */
export function activeFilterCount(f: EventFilters): number {
  return [f.q, f.land, f.provincie, f.type, f.van, f.tot].filter(Boolean).length;
}
