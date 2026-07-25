import Link from "next/link";
import type { OpgietEvent } from "@/lib/content";
import type { EventType } from "@/lib/site";
import { EVENT_TYPES } from "@/lib/site";
import { MONTHS_NL, monthYearLabel, parseMonthYearSlug } from "@/lib/dates";

/*
  Kalenderweergave voor /agenda (?weergave=kalender&maand=<maand-jaar>).
  Server-rendered: maandnavigatie en dagchips zijn gewone links, zodat de
  weergave net als de filters deelbaar is via de URL en geen client-state
  nodig heeft. Meerdaagse events verschijnen op elke dag van hun bereik.
*/

const DAGEN_NL = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;

/** Dot-kleur per event-type (sluit aan op TypeBadge). */
const TYPE_DOT: Record<EventType, string> = {
  opgietweekend: "bg-ember",
  thema: "bg-steam",
  kampioenschap: "bg-wood-dark",
  regulier: "bg-ink-faint",
};

export interface KalenderMaand {
  slug: string;
  /** Eerste dag van de maand (ISO), voor sortering/vergelijking. */
  eersteDag: string;
}

/** "augustus-2026" -> ISO van de eerste dag ("2026-08-01"). */
export function maandSlugNaarISO(slug: string): string | null {
  const parsed = parseMonthYearSlug(slug);
  if (!parsed) return null;
  return `${parsed.year}-${String(parsed.monthIndex + 1).padStart(2, "0")}-01`;
}

/** Slug van de maand n maanden na de opgegeven maand. */
export function maandPlus(slug: string, n: number): string | null {
  const parsed = parseMonthYearSlug(slug);
  if (!parsed) return null;
  const idx = parsed.monthIndex + n;
  const year = parsed.year + Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12;
  return `${MONTHS_NL[month]}-${year}`;
}

function dagenInMaand(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function AgendaKalender({
  events,
  maandSlug,
  vandaag,
  vorige,
  volgende,
  maandUrl,
  heeftMaandPagina,
}: {
  /** Gefilterde events (incl. afgelopen; de kalender dimt verleden dagen zelf). */
  events: OpgietEvent[];
  maandSlug: string;
  /** Vandaag (ISO) op request-tijd, voor de vandaag-markering. */
  vandaag: string;
  /** Slug van de vorige/volgende navigeerbare maand, of null aan de rand. */
  vorige: string | null;
  volgende: string | null;
  /** Bouwt de URL voor een maand binnen de kalenderweergave (filters blijven staan). */
  maandUrl: (slug: string) => string;
  /** Heeft deze maand een eigen SEO-pagina (/agenda/[maand-jaar])? */
  heeftMaandPagina: boolean;
}) {
  const parsed = parseMonthYearSlug(maandSlug);
  if (!parsed) return null;
  const { year, monthIndex } = parsed;
  const label = monthYearLabel(maandSlug);
  const aantalDagen = dagenInMaand(year, monthIndex);
  const eersteDag = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  // Maandag als eerste kolom: zondag (0) wordt offset 6.
  const offset = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;

  const dagen = Array.from({ length: aantalDagen }, (_, i) => {
    const iso = `${eersteDag.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
    const dagEvents = events.filter((e) => e.startDatum <= iso && (e.eindDatum ?? e.startDatum) >= iso);
    return { dag: i + 1, iso, events: dagEvents };
  });

  const maandEvents = events.filter((e) => {
    const eind = e.eindDatum ?? e.startDatum;
    return e.startDatum <= dagen[dagen.length - 1].iso && eind >= eersteDag;
  });
  const gebruikteTypes = [...new Set(maandEvents.map((e) => e.type))];

  return (
    <section aria-label={`Kalender ${label}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-ink">{label}</h2>
        <nav aria-label="Maandnavigatie" className="flex gap-2 text-sm font-medium">
          {vorige ? (
            <Link
              href={maandUrl(vorige)}
              aria-label={`Vorige maand: ${monthYearLabel(vorige)}`}
              className="rounded-full border border-sand bg-cream px-3 py-1.5 text-ink-soft transition-colors hover:border-ember hover:text-ember"
            >
              ←
            </Link>
          ) : (
            <span aria-hidden className="rounded-full border border-sand px-3 py-1.5 text-sand">
              ←
            </span>
          )}
          {volgende ? (
            <Link
              href={maandUrl(volgende)}
              aria-label={`Volgende maand: ${monthYearLabel(volgende)}`}
              className="rounded-full border border-sand bg-cream px-3 py-1.5 text-ink-soft transition-colors hover:border-ember hover:text-ember"
            >
              →
            </Link>
          ) : (
            <span aria-hidden className="rounded-full border border-sand px-3 py-1.5 text-sand">
              →
            </span>
          )}
        </nav>
      </div>

      <div className="mt-4 overflow-hidden rounded-[--radius-card] border border-sand bg-surface">
        <div className="grid grid-cols-7 border-b border-sand bg-cream text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {DAGEN_NL.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }, (_, i) => (
            <div key={`leeg-${i}`} aria-hidden className="min-h-16 border-b border-r border-sand/60 bg-cream/40 sm:min-h-24" />
          ))}
          {dagen.map(({ dag, iso, events: dagEvents }) => {
            const isVandaag = iso === vandaag;
            const isVerleden = iso < vandaag;
            return (
              <div
                key={iso}
                className={`min-h-16 border-b border-r border-sand/60 p-1 sm:min-h-24 sm:p-1.5 ${
                  isVerleden ? "bg-cream/40" : ""
                }`}
              >
                <time
                  dateTime={iso}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isVandaag
                      ? "bg-ember font-semibold text-white"
                      : isVerleden
                        ? "text-ink-faint/60"
                        : "font-medium text-ink-soft"
                  }`}
                >
                  {dag}
                </time>
                {dagEvents.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {dagEvents.map((e) => (
                      <li key={e.slug}>
                        <Link
                          href={`/event/${e.slug}`}
                          title={`${e.titel} · ${e.sauna.naam}`}
                          className={`flex items-center gap-1 rounded px-0.5 py-0.5 text-[11px] leading-tight transition-colors hover:bg-ember-tint sm:px-1 ${
                            isVerleden ? "text-ink-faint/70" : "text-ink-soft hover:text-ember"
                          }`}
                        >
                          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[e.type]}`} />
                          <span className="hidden truncate sm:inline">{e.titel}</span>
                          <span className="sr-only sm:hidden">{e.titel}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-faint">
        {gebruikteTypes.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {gebruikteTypes.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-2 w-2 rounded-full ${TYPE_DOT[t]}`} />
                {EVENT_TYPES[t]}
              </li>
            ))}
          </ul>
        ) : (
          <p>Geen events in {label}. Blader naar een andere maand of bekijk de lijst.</p>
        )}
        {heeftMaandPagina && (
          <Link href={`/agenda/${maandSlug}`} className="font-medium text-ember hover:underline">
            Alle opgietingen in {label} →
          </Link>
        )}
      </div>
    </section>
  );
}
