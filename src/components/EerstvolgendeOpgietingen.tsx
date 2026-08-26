import Link from "next/link";
import type { OpgietEvent, OpgietRoosterRegel, Sauna } from "@/lib/content";
import { slugify } from "@/lib/content";
import { formatDateShort, parseISO } from "@/lib/dates";
import { TypeBadge } from "@/components/TypeBadge";

const MAX_RIJEN = 4;

/** Nederlandse weekdagnaam ("zaterdag") voor de vandaag-markering in het rooster. */
function weekdagNL(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "long", timeZone: "UTC" }).format(parseISO(iso));
}

/** Geldt deze roosterregel vandaag? Vrije tekst, dus alleen ondubbelzinnige matches. */
function geldtVandaag(regel: OpgietRoosterRegel, weekdag: string): boolean {
  const dag = regel.dag.toLowerCase();
  return dag.includes("dagelijks") || dag.includes("elke dag") || dag.includes(weekdag);
}

/**
 * Compacte "wanneer kan ik?"-blok direct onder de hero van een saunapagina.
 * Brand-zoekers ("zwaluwhoeve") landen hier en moeten binnen het eerste
 * scherm de eerstvolgende opgietingen met datum zien, plus één duidelijke
 * weg naar meer. Zonder events valt het blok terug op het vaste rooster en
 * de provincie-agenda, zodat het nooit een dood spoor is.
 */
export function EerstvolgendeOpgietingen({
  sauna,
  komende,
  vandaag,
}: {
  sauna: Sauna;
  komende: OpgietEvent[];
  vandaag: string;
}) {
  const provincieHref = `/opgietingen/${slugify(sauna.provincie)}`;
  const rijen = komende.slice(0, MAX_RIJEN);
  const rest = komende.length - rijen.length;

  return (
    <section
      aria-labelledby="eerstvolgende-kop"
      className="mt-6 rounded-[--radius-card] border border-sand bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="eerstvolgende-kop" className="font-display text-lg font-semibold text-ink sm:text-xl">
          Eerstvolgende opgietingen
        </h2>
        {komende.length > 0 && (
          <span className="text-xs font-medium text-ink-faint">
            {komende.length === 1 ? "1 event gepland" : `${komende.length} events gepland`}
          </span>
        )}
      </div>

      {rijen.length > 0 ? (
        <ol className="mt-3 divide-y divide-sand">
          {rijen.map((event) => (
            <li key={event.slug}>
              <Link
                href={`/event/${event.slug}`}
                className="group flex items-center gap-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
              >
                <time dateTime={event.startDatum} className="w-28 flex-none text-sm font-semibold text-ember">
                  {formatDateShort(event.startDatum)}
                </time>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:text-ember">
                  {event.titel}
                </span>
                <TypeBadge type={event.type} className="hidden flex-none sm:inline-flex" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-soft">
            Er staan nog geen losse events gepland bij {sauna.naam}.
            {sauna.opgietRooster ? " Wel zijn er vaste opgiettijden:" : ""}
          </p>
          {sauna.opgietRooster && (
            <ul className="mt-2 divide-y divide-sand">
              {sauna.opgietRooster.map((regel) => {
                const vandaagMatch = geldtVandaag(regel, weekdagNL(vandaag));
                return (
                  <li key={regel.dag} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
                    <span className="w-28 flex-none text-sm font-semibold text-ink">
                      {regel.dag}
                      {vandaagMatch && (
                        <span className="ml-1.5 rounded-full bg-ember-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ember">
                          vandaag
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-ink-soft">{regel.tijden}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-sand pt-3 text-sm font-medium">
        {komende.length > 0 ? (
          <a href="#komende-opgietingen" className="text-ember hover:underline">
            {rest > 0 ? `Alle ${komende.length} events bij ${sauna.naam}` : "Meer over deze events"} ↓
          </a>
        ) : (
          <Link href={provincieHref} className="text-ember hover:underline">
            Opgietingen in {sauna.provincie} →
          </Link>
        )}
        <Link href="/agenda" className="text-ember hover:underline">
          Volledige agenda →
        </Link>
      </div>
    </section>
  );
}
