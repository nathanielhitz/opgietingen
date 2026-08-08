import type { OpgietRoosterRegel } from "@/lib/content";

/**
 * Vaste opgiettijden van één sauna als definitielijst. Gedeeld door de
 * saunapagina en de provinciepagina zodat beide dezelfde weergave houden;
 * de omliggende kop en bronvermelding blijven bij de aanroeper, omdat die
 * per context verschilt (één sauna vs. een regio-overzicht).
 */
export function OpgietRoosterTabel({ regels }: { regels: OpgietRoosterRegel[] }) {
  return (
    <dl className="overflow-hidden rounded-[--radius-card] border border-sand bg-surface">
      {regels.map((regel, i) => (
        <div
          key={regel.dag}
          className={`flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6 ${i > 0 ? "border-t border-sand" : ""}`}
        >
          <dt className="w-40 flex-none text-sm font-semibold text-ink">{regel.dag}</dt>
          <dd className="text-sm text-ink-soft">{regel.tijden}</dd>
        </div>
      ))}
    </dl>
  );
}
