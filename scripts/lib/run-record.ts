// scripts/lib/run-record.ts
import { KANALEN, runTotalen, type BronResultaat, type Kanaal, type ScrapeRun } from "../../src/lib/scrape-runs";
import type { MetricsBestand } from "./metrics";

export interface RunContext {
  id: string;
  workflowRun: string | null;
  duurSeconden: number | null;
  autopublish: boolean;
}

/** Vouwt de tijdelijke metrics tot één run-record. `null` metrics = niets gemeld → fout "geen metrics". */
export function bouwRunRecord(metrics: MetricsBestand | null, ctx: RunContext): ScrapeRun {
  const perKanaal = (kanaal: Kanaal): BronResultaat[] =>
    (metrics?.bronResultaten ?? [])
      .filter((b) => b.kanaal === kanaal)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- alleen het kanaal-veld eruit slopen
      .map(({ kanaal, ...rest }) => rest);
  return {
    id: ctx.id,
    workflowRun: ctx.workflowRun,
    duurSeconden: ctx.duurSeconden,
    autopublish: ctx.autopublish,
    backfill: false,
    fout: metrics ? null : "geen metrics",
    bronnen: {
      gecontroleerd: metrics?.verify?.gecontroleerd ?? null,
      statusWijzigingen: metrics?.bronStatusWijzigingen ?? [],
    },
    kanalen: {
      website: { bronnen: perKanaal("website") },
      facebook: { bronnen: perKanaal("facebook") },
      mail: {
        mails: metrics?.mail?.mails ?? 0,
        onbekendeAfzenders: metrics?.mail?.onbekendeAfzenders ?? 0,
        bronnen: perKanaal("mail"),
      },
    },
    events: metrics?.events ?? [],
  };
}

/**
 * `leesScrapeRuns` slikt een corrupt bestand en geeft []. Zonder deze check zou
 * run-record de historie stil overschrijven met alleen de nieuwe run. Alleen een
 * écht leeg `{ "runs": [] }` (of geen bestand) mag leeg blijken.
 */
export function historieVerdacht(rauw: string | null, gelezen: ScrapeRun[]): boolean {
  if (rauw === null) return false; // geen bestand → eerste run
  try {
    const data = JSON.parse(rauw) as { runs?: unknown };
    if (!Array.isArray(data.runs)) return true;
    // Meer records in het bestand dan de loader accepteert = er zou stil iets verdwijnen.
    return data.runs.length > gelezen.length;
  } catch {
    return true;
  }
}

/** Vervangt een bestaand record met dezelfde id (idempotent) en sorteert oud → nieuw. */
export function voegRunToe(runs: ScrapeRun[], record: ScrapeRun): ScrapeRun[] {
  return [...runs.filter((r) => r.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id));
}

/** Eén regel voor het commit-bericht. */
export function samenvatting(run: ScrapeRun): string {
  // fout wordt alleen gezet als er geen metrics zijn (record is dan leeg), dus hier gaan geen tellers verloren.
  if (run.fout) return run.fout;
  const t = runTotalen(run);
  const delen = [`${t.kandidaten ?? 0} kandidaten`, `${t.gepubliceerd} gepubliceerd`, `${t.concept} concept`];
  const bronfouten = KANALEN.reduce((acc, k) => acc + run.kanalen[k].bronnen.filter((b) => b.fout).length, 0);
  if (bronfouten) delen.push(`${bronfouten} bronfout${bronfouten === 1 ? "" : "en"}`);
  return delen.join(", ");
}
