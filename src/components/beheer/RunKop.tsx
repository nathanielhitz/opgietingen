import type { RunTotalen, ScrapeRun } from "@/lib/scrape-runs";

function formatRunTijd(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

export function RunKop({ run, totalen }: { run: ScrapeRun; totalen: RunTotalen }) {
  const duur = run.duurSeconden != null ? ` · ${Math.floor(run.duurSeconden / 60)}m ${run.duurSeconden % 60}s` : "";
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Laatste run · {formatRunTijd(run.id)}{duur} · autopublish {run.autopublish ? "aan" : "uit"}
        {run.backfill ? " · gereconstrueerd" : ""}
      </p>
      <h1 className="mt-1 font-display text-2xl font-medium text-ink text-balance">
        {totalen.kandidaten ?? "?"} kandidaten, {totalen.gepubliceerd} gepubliceerd, {totalen.concept} te beoordelen
      </h1>
      {run.fout && (
        <div className="mt-3 rounded-lg bg-bad-tint px-4 py-3 text-sm text-bad">
          Run zonder resultaten ({run.fout}).{" "}
          {run.workflowRun && (
            <a className="underline" href={`https://github.com/nathanielhitz/opgietingen/actions/runs/${run.workflowRun}`}>
              Bekijk de workflow
            </a>
          )}
        </div>
      )}
    </div>
  );
}
