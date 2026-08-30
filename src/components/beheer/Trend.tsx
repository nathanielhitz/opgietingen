import type { TrendPunt } from "@/lib/scrape-runs";

/** Events per run als CSS-staafjes (gepubliceerd donker, concept licht); backfill gedempt. Context, geen hoofdvraag — daarom klein. */
export function Trend({ punten }: { punten: TrendPunt[] }) {
  const max = Math.max(1, ...punten.map((p) => p.gepubliceerd + p.concept));
  const datum = (iso: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Per run · laatste {punten.length} (gepubliceerd donker, concept licht)
      </h2>
      <div className="mt-2 flex h-14 items-end gap-1" role="img" aria-label="Aantal events per run">
        {punten.map((p) => (
          <div
            key={p.id}
            className={`flex h-full flex-1 flex-col justify-end ${p.backfill ? "opacity-50" : ""}`}
            title={`${datum(p.id)}: ${p.gepubliceerd} gepubliceerd, ${p.concept} concept${p.backfill ? " (gereconstrueerd)" : ""}`}
          >
            <div className="rounded-t bg-warn-tint" style={{ height: `${(p.concept / max) * 100}%` }} />
            <div className="bg-ok" style={{ height: `${(p.gepubliceerd / max) * 100}%` }} />
          </div>
        ))}
      </div>
      {punten.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
          <span>{datum(punten[0].id)}</span>
          <span>{datum(punten[punten.length - 1].id)}</span>
        </div>
      )}
    </section>
  );
}
