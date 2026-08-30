import { KANAAL_LABEL, type Kanaal, type Totalen } from "@/lib/scrape-runs";

const STIP: Record<Kanaal, string> = {
  website: "bg-kanaal-website",
  facebook: "bg-kanaal-facebook",
  mail: "bg-kanaal-mail",
};

/** Gestapeld staafje gepubliceerd–concept–dedup met de cijfers als tekst (kleur is nooit de enige drager). */
export function KanaalKaart({ kanaal, t, extra }: { kanaal: Kanaal; t: Totalen; extra?: string }) {
  const dedup = t.dedup ?? 0;
  const totaal = t.gepubliceerd + t.concept + dedup;
  const pct = (n: number) => (totaal ? `${(n / totaal) * 100}%` : "0%");
  return (
    <div className="rounded-xl border border-sand px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STIP[kanaal]}`} aria-hidden />
        {KANAAL_LABEL[kanaal]}
      </div>
      <div className="my-2 flex h-2 gap-0.5 overflow-hidden rounded bg-sand" aria-hidden>
        <span className="bg-ok" style={{ width: pct(t.gepubliceerd) }} />
        <span className="bg-warn" style={{ width: pct(t.concept) }} />
        <span className="bg-sand" style={{ width: pct(dedup) }} />
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-ink-soft tabular-nums">
        <span>{t.gepubliceerd} gepubliceerd</span>
        <span>{t.concept} concept</span>
        <span>{dedup} dedup</span>
        {extra && <span>{extra}</span>}
      </div>
    </div>
  );
}
