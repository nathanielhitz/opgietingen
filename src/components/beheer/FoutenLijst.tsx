import { KANAAL_LABEL, type BronStatusWijziging, type Kanaal } from "@/lib/scrape-runs";

export interface FoutRij {
  bronId: string;
  bronNaam: string;
  kanaal: Kanaal | "verify";
  melding: string;
  ernst: "bad" | "warn";
}

export function naarFoutRijen(
  bronfouten: { kanaal: Kanaal; id: string; fout: string }[],
  wijzigingen: BronStatusWijziging[],
  naamVan: (id: string) => string,
): FoutRij[] {
  return [
    ...bronfouten.map((b) => ({ bronId: b.id, bronNaam: naamVan(b.id), kanaal: b.kanaal, melding: b.fout, ernst: "bad" as const })),
    ...wijzigingen.map((w) => ({
      bronId: w.id, bronNaam: naamVan(w.id), kanaal: "verify" as const,
      melding: `${w.van} → ${w.naar}: ${w.notitie}`, ernst: w.naar === "kapot" ? ("bad" as const) : ("warn" as const),
    })),
  ];
}

export function FoutenLijst({ rijen }: { rijen: FoutRij[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Aandacht ({rijen.length})</h2>
      {rijen.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Geen bronfouten of statuswijzigingen.</p>
      ) : (
        <ul className="mt-2 divide-y divide-sand text-sm">
          {rijen.map((r, i) => (
            <li key={`${r.bronId}-${i}`} className="flex flex-wrap items-center gap-3 py-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.ernst === "bad" ? "bg-bad-tint text-bad" : "bg-warn-tint text-warn"}`}>
                {r.kanaal === "verify" ? "bron" : KANAAL_LABEL[r.kanaal]}
              </span>
              <span className="font-medium text-ink">{r.bronNaam}</span>
              <span className="text-ink-soft">{r.melding}</span>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Keystatic is een client-side SPA achter één catch-all route; dit pad bestaat niet als Next.js-pagina. */}
              <a className="ml-auto font-medium text-ember underline underline-offset-2" href="/keystatic/singleton/bronnen">
                Bron
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
