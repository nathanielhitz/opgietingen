// scripts/lib/run-record.ts
import { KANALEN, runTotalen, type BronResultaat, type ScrapeRun } from "../../src/lib/scrape-runs";
import type { MetricsBestand } from "./metrics";

export interface RunContext {
  id: string;
  workflowRun: string | null;
  duurSeconden: number | null;
  autopublish: boolean;
}

/** Vouwt de tijdelijke metrics tot één run-record. `null` metrics = niets gemeld → fout "geen metrics". */
export function bouwRunRecord(metrics: MetricsBestand | null, ctx: RunContext): ScrapeRun {
  const perKanaal = (kanaal: string): BronResultaat[] =>
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

/** Vervangt een bestaand record met dezelfde id (idempotent) en sorteert oud → nieuw. */
export function voegRunToe(runs: ScrapeRun[], record: ScrapeRun): ScrapeRun[] {
  return [...runs.filter((r) => r.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id));
}

/** Eén regel voor het commit-bericht. */
export function samenvatting(run: ScrapeRun): string {
  if (run.fout === "geen metrics") return "geen metrics";
  const t = runTotalen(run);
  const delen = [`${t.kandidaten ?? 0} kandidaten`, `${t.gepubliceerd} gepubliceerd`, `${t.concept} concept`];
  const bronfouten = KANALEN.reduce((acc, k) => acc + run.kanalen[k].bronnen.filter((b) => b.fout).length, 0);
  if (bronfouten) delen.push(`${bronfouten} bronfout${bronfouten === 1 ? "" : "en"}`);
  return delen.join(", ");
}
