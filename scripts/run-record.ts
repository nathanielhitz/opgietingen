// scripts/run-record.ts
/*
  Vouwt scrape-metrics.json (gemeld door verify-bronnen en de drie scrapers) tot
  één run-record in data/scrape-runs.json en schrijft een samenvattingsregel
  naar $GITHUB_OUTPUT voor het commit-bericht. Idempotent: nogmaals draaien
  vervangt het record van deze run.

    npm run run-record                # in de workflow (RUN_GESTART, GITHUB_RUN_ID gezet)
    npm run run-record -- --dry-run   # toon het record, schrijf niets
*/
import fs from "node:fs";
import path from "node:path";
import { leesScrapeRuns, SCRAPE_RUNS_PATH } from "../src/lib/scrape-runs";
import { leesMetrics, metricsBestandStatus, METRICS_BESTAND } from "./lib/metrics";
import { bouwRunRecord, historieVerdacht, voegRunToe, samenvatting } from "./lib/run-record";

const DRY_RUN = process.argv.includes("--dry-run");

const gestart = process.env.RUN_GESTART ? new Date(process.env.RUN_GESTART) : null;
const gestartGeldig = gestart && !Number.isNaN(gestart.getTime()) ? gestart : null;
const nu = new Date();
const ctx = {
  id: (gestartGeldig ?? nu).toISOString().replace(/\.\d{3}Z$/, "Z"),
  workflowRun: process.env.GITHUB_RUN_ID ?? null,
  duurSeconden: gestartGeldig ? Math.round((nu.getTime() - gestartGeldig.getTime()) / 1000) : null,
  autopublish: process.env.SCRAPE_AUTOPUBLISH === "true",
};

const metrics = leesMetrics();
const record = bouwRunRecord(metrics, ctx);
if (!metrics && metricsBestandStatus() === "onleesbaar") record.fout = "metrics onleesbaar";
const regel = samenvatting(record);

if (DRY_RUN) {
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nSamenvatting: ${regel}`);
} else {
  const bestaand = leesScrapeRuns();
  const rauw = fs.existsSync(SCRAPE_RUNS_PATH) ? fs.readFileSync(SCRAPE_RUNS_PATH, "utf8") : null;
  if (historieVerdacht(rauw, bestaand)) {
    console.error(
      `${SCRAPE_RUNS_PATH} is onleesbaar of bevat geen bruikbaar record — run-record stopt zodat de historie ` +
        `niet wordt overschreven. Herstel met \`git checkout data/scrape-runs.json\` en draai opnieuw ` +
        `(scrape-metrics.json blijft staan).`,
    );
    process.exit(1);
  }
  const runs = voegRunToe(bestaand, record);
  fs.mkdirSync(path.dirname(SCRAPE_RUNS_PATH), { recursive: true });
  fs.writeFileSync(SCRAPE_RUNS_PATH, JSON.stringify({ runs }, null, 2) + "\n");
  if (fs.existsSync(METRICS_BESTAND())) fs.rmSync(METRICS_BESTAND());
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `samenvatting=${regel}\n`);
  console.log(`Run-record ${record.id} weggeschreven (${runs.length} runs). ${regel}`);
}
