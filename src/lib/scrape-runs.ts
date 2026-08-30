// src/lib/scrape-runs.ts
import fs from "node:fs";
import path from "node:path";

/*
  Run-metrics van de wekelijkse scrape (data/scrape-runs.json). Dit is de enige
  plek die weet waar die data vandaan komt — later vervangbaar (bv. Supabase)
  zonder dat /beheer verandert. Spec: docs/superpowers/specs/
  2026-08-30-beheer-dashboard-scrape-metrics-design.md
*/

export type Kanaal = "website" | "facebook" | "mail";
export type Methode = "statisch" | "firecrawl" | "claude" | "geen";
export const KANALEN: Kanaal[] = ["website", "facebook", "mail"];
export const KANAAL_LABEL: Record<Kanaal, string> = { website: "Website", facebook: "Facebook", mail: "Mail" };

/** Tellers van één bron in één kanaal. Invariant: kandidaten = dedup + verleden + concept + gepubliceerd. */
export interface BronResultaat {
  id: string;
  kandidaten: number;
  dedup: number;
  verleden: number;
  /** Deelverzameling van concept: de kwaliteitspoort faalde. */
  afgekeurd: number;
  concept: number;
  gepubliceerd: number;
  fout: string | null;
  methode: Methode;
  /** Alleen door de facebook-scraper gevuld: aantal opgehaalde posts. */
  posts?: number;
}

export interface RunEvent {
  slug: string;
  kanaal: Kanaal;
  bron: string;
  status: "concept" | "gepubliceerd";
  reden?: string;
}

export interface BronStatusWijziging {
  id: string;
  van: string;
  naar: string;
  notitie: string;
}

export interface ScrapeRun {
  /** ISO-tijdstip van de start van de workflow; tevens sleutel. */
  id: string;
  workflowRun: string | null;
  duurSeconden: number | null;
  autopublish: boolean;
  /** Gereconstrueerd uit git-historie: alleen events[] is gevuld. */
  backfill: boolean;
  fout: string | null;
  bronnen: { gecontroleerd: number | null; statusWijzigingen: BronStatusWijziging[] };
  kanalen: {
    website: { bronnen: BronResultaat[] };
    facebook: { bronnen: BronResultaat[] };
    mail: { mails: number; onbekendeAfzenders: number; bronnen: BronResultaat[] };
  };
  events: RunEvent[];
}

export interface Totalen {
  kandidaten: number | null;
  dedup: number | null;
  verleden: number | null;
  afgekeurd: number | null;
  concept: number;
  gepubliceerd: number;
}

export interface RunTotalen extends Totalen {
  /** Bronfouten + bronnen-statuswijzigingen. */
  fouten: number;
  /** Aantal bron-regels over alle kanalen. */
  bronnen: number;
  perKanaal: Record<Kanaal, Totalen>;
}

export const SCRAPE_RUNS_PATH = path.join(process.cwd(), "data", "scrape-runs.json");

function leegTotaal(): Totalen {
  return { kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0 };
}

function telKanaal(bronnen: BronResultaat[]): Totalen {
  const t = leegTotaal();
  for (const b of bronnen) {
    t.kandidaten = (t.kandidaten ?? 0) + b.kandidaten;
    t.dedup = (t.dedup ?? 0) + b.dedup;
    t.verleden = (t.verleden ?? 0) + b.verleden;
    t.afgekeurd = (t.afgekeurd ?? 0) + b.afgekeurd;
    t.concept += b.concept;
    t.gepubliceerd += b.gepubliceerd;
  }
  return t;
}

function telEvents(events: RunEvent[], kanaal?: Kanaal): Totalen {
  const sel = kanaal ? events.filter((e) => e.kanaal === kanaal) : events;
  return {
    kandidaten: null, dedup: null, verleden: null, afgekeurd: null,
    concept: sel.filter((e) => e.status === "concept").length,
    gepubliceerd: sel.filter((e) => e.status === "gepubliceerd").length,
  };
}

/** Totalen per run; backfill-records hebben geen tellers en tellen via events[]. */
export function runTotalen(run: ScrapeRun): RunTotalen {
  const perKanaal = {} as Record<Kanaal, Totalen>;
  for (const k of KANALEN) {
    perKanaal[k] = run.backfill ? telEvents(run.events, k) : telKanaal(run.kanalen[k]?.bronnen ?? []);
  }
  const som = (veld: keyof Totalen): number | null =>
    run.backfill && veld !== "concept" && veld !== "gepubliceerd"
      ? null
      : KANALEN.reduce((acc, k) => acc + (perKanaal[k][veld] ?? 0), 0);
  const bronfouten = KANALEN.reduce((acc, k) => acc + (run.kanalen[k]?.bronnen ?? []).filter((b) => b.fout).length, 0);
  return {
    kandidaten: som("kandidaten"),
    dedup: som("dedup"),
    verleden: som("verleden"),
    afgekeurd: som("afgekeurd"),
    concept: som("concept") ?? 0,
    gepubliceerd: som("gepubliceerd") ?? 0,
    fouten: bronfouten + (run.bronnen?.statusWijzigingen?.length ?? 0),
    bronnen: KANALEN.reduce((acc, k) => acc + (run.kanalen[k]?.bronnen ?? []).length, 0),
    perKanaal,
  };
}

export interface TrendPunt {
  id: string;
  kandidaten: number | null;
  concept: number;
  gepubliceerd: number;
  backfill: boolean;
}

/** Laatste n runs, oud → nieuw. */
export function weekTrend(runs: ScrapeRun[], n = 12): TrendPunt[] {
  return [...runs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(-n)
    .map((r) => {
      const t = runTotalen(r);
      return { id: r.id, kandidaten: t.kandidaten, concept: t.concept, gepubliceerd: t.gepubliceerd, backfill: r.backfill };
    });
}

/** Leest het run-bestand; ontbrekend of onleesbaar → [] (de build mag hier nooit op breken). */
export function leesScrapeRuns(bestand: string = SCRAPE_RUNS_PATH): ScrapeRun[] {
  if (!fs.existsSync(bestand)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(bestand, "utf8")) as { runs?: unknown };
    if (!Array.isArray(data.runs)) return [];
    return (data.runs as ScrapeRun[])
      .filter(
        (r) =>
          r &&
          typeof r.id === "string" &&
          Array.isArray(r.events) &&
          r.bronnen &&
          Array.isArray(r.bronnen.statusWijzigingen) &&
          r.kanalen &&
          KANALEN.every((k) => Array.isArray(r.kanalen[k]?.bronnen)),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export function getScrapeRuns(): ScrapeRun[] {
  return leesScrapeRuns();
}

export function getLaatsteRun(runs: ScrapeRun[] = getScrapeRuns()): ScrapeRun | undefined {
  return runs[runs.length - 1];
}
