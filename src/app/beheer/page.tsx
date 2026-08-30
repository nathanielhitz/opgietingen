import { getSaunaBySlug } from "@/lib/content";
import { getLaatsteRun, getScrapeRuns, runTotalen, weekTrend, KANALEN } from "@/lib/scrape-runs";
import { BeheerNav } from "@/components/beheer/BeheerNav";
import { RunKop } from "@/components/beheer/RunKop";
import { Tegels } from "@/components/beheer/Tegels";
import { KanaalKaart } from "@/components/beheer/KanaalKaart";
import { ConceptTabel } from "@/components/beheer/ConceptTabel";
import { FoutenLijst, naarFoutRijen } from "@/components/beheer/FoutenLijst";
import { Trend } from "@/components/beheer/Trend";

/*
  Dashboard van de wekelijkse scrape: wat leverde de laatste run op en wat is
  er te doen. Leest data/scrape-runs.json via de loader; statisch gebouwd —
  elke run commit een nieuw record en Vercel deployt.
*/
export default function BeheerPagina() {
  const runs = getScrapeRuns();
  const run = getLaatsteRun(runs);

  if (!run) {
    return (
      <>
        <BeheerNav actief="dashboard" />
        <p className="mt-8 text-ink-soft">Nog geen runs; de eerste komt maandag na de scrape-workflow.</p>
      </>
    );
  }

  const totalen = runTotalen(run);
  const naamVan = (id: string) => getSaunaBySlug(id)?.naam ?? id;
  const concepts = run.events
    .filter((e) => e.status === "concept")
    .map((e) => ({ ...e, saunaNaam: naamVan(e.bron) }));
  const bronfouten = KANALEN.flatMap((k) =>
    run.kanalen[k].bronnen.filter((b) => b.fout).map((b) => ({ kanaal: k, id: b.id, fout: b.fout as string })),
  );
  const fouten = naarFoutRijen(bronfouten, run.bronnen.statusWijzigingen, naamVan);

  return (
    <>
      <BeheerNav actief="dashboard" />
      <div className="mt-8 flex flex-col gap-8">
        <RunKop run={run} totalen={totalen} />
        <Tegels t={totalen} />
        <div className="grid gap-3 sm:grid-cols-3">
          <KanaalKaart kanaal="website" t={totalen.perKanaal.website} />
          <KanaalKaart kanaal="facebook" t={totalen.perKanaal.facebook} />
          <KanaalKaart
            kanaal="mail"
            t={totalen.perKanaal.mail}
            extra={`${run.kanalen.mail.mails} mails · ${run.kanalen.mail.onbekendeAfzenders} onbekend`}
          />
        </div>
        <ConceptTabel rijen={concepts} />
        <FoutenLijst rijen={fouten} />
        <Trend punten={weekTrend(runs, 12)} />
      </div>
    </>
  );
}
