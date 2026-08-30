// scripts/backfill-runs.ts
/*
  Eenmalige reconstructie van run-records uit de git-historie, zodat de trend op
  /beheer niet leeg start. Per commit met "chore(scraper)" in het bericht worden
  de TOEGEVOEGDE event-bestanden gelezen (status, sauna, keurNotitie). Tellers
  zijn niet reconstrueerbaar → backfill: true, alleen events[] gevuld.

    npx tsx scripts/backfill-runs.ts            # schrijft data/scrape-runs.json (bestaande ids blijven)
    npx tsx scripts/backfill-runs.ts --dry-run  # toont wat het zou toevoegen
*/
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { leesScrapeRuns, SCRAPE_RUNS_PATH, type Kanaal, type RunEvent, type ScrapeRun } from "../src/lib/scrape-runs";
import { voegRunToe } from "./lib/run-record";

const DRY_RUN = process.argv.includes("--dry-run");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

// Blokken gescheiden door \x01: "<sha>|<iso>|<onderwerp>\n<pad>\n<pad>…"
const log = git("log", "--format=%x01%H|%aI|%s", "--name-only", "--diff-filter=A", "--", "content/events");
const blokken = log.split("\x01").filter((b) => b.trim());

// Beperking van de reconstructie: de wekelijkse workflow commit website-, facebook-
// en mail-events in één commit, dus alles in zo'n commit telt als "website"; alleen
// losse Facebook-/mail-commits zijn herkenbaar. Runs zonder nieuwe events hebben
// geen commit met toegevoegde bestanden en krijgen dus geen record (gat in de
// trend, geen nulkolom). autopublish staat sinds 2026-07-11 aan, vóór de eerste run.
function kanaalUit(commitOnderwerp: string): Kanaal {
  if (/facebook/i.test(commitOnderwerp)) return "facebook";
  if (/mail|nieuwsbrief/i.test(commitOnderwerp)) return "mail";
  return "website";
}

const nieuw: ScrapeRun[] = [];
for (const blok of blokken) {
  const [kop, ...regels] = blok.trim().split("\n");
  const [sha, iso, ...rest] = kop.split("|");
  const onderwerp = rest.join("|");
  if (!/chore\(scraper\)/.test(onderwerp)) continue;
  const bestanden = regels.map((r) => r.trim()).filter((r) => r.endsWith(".mdx"));
  const events: RunEvent[] = [];
  for (const bestand of bestanden) {
    let inhoud: string;
    try {
      inhoud = git("show", `${sha}:${bestand}`);
    } catch {
      continue;
    }
    const { data } = matter(inhoud);
    if (data.bron !== "scraper") continue;
    const status = data.status === "gepubliceerd" ? "gepubliceerd" : "concept";
    events.push({
      slug: path.basename(bestand, ".mdx"),
      kanaal: kanaalUit(onderwerp),
      bron: String(data.saunaSlug ?? "onbekend"),
      status,
      ...(data.keurNotitie ? { reden: String(data.keurNotitie) } : {}),
    });
  }
  nieuw.push({
    id: new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z"),
    workflowRun: null,
    duurSeconden: null,
    autopublish: true,
    backfill: true,
    fout: null,
    bronnen: { gecontroleerd: null, statusWijzigingen: [] },
    kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] }, mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] } },
    events,
  });
}

const bestaand = leesScrapeRuns();
const bestaandeIds = new Set(bestaand.map((r) => r.id));
const toeTeVoegen = nieuw.filter((r) => !bestaandeIds.has(r.id));
let runs = bestaand;
for (const r of toeTeVoegen) runs = voegRunToe(runs, r);

console.log(`${blokken.length} commits met toegevoegde events, ${nieuw.length} scraper-runs, ${toeTeVoegen.length} nieuw.`);
for (const r of toeTeVoegen) {
  console.log(`  ${r.id}  ${r.events.length} events (${r.events.filter((e) => e.status === "gepubliceerd").length} gepubliceerd)`);
}
if (!DRY_RUN) {
  fs.mkdirSync(path.dirname(SCRAPE_RUNS_PATH), { recursive: true });
  fs.writeFileSync(SCRAPE_RUNS_PATH, JSON.stringify({ runs }, null, 2) + "\n");
  console.log(`→ ${SCRAPE_RUNS_PATH} (${runs.length} runs)`);
}
