/*
  Event-scraper. Leest content/bronnen.json, scrapet elke ACTIEVE bron via de
  Firecrawl-laag (src/lib/scraper.ts, met Claude-fallback), dedupliceert tegen
  bestaande events (saunaSlug + startDatum) en schrijft nieuwe events als MDX
  met status "concept".

  Gebruik:
    npm run scrape                 # alle actieve bronnen (vereist API-keys)
    npm run scrape -- --limit 2    # alleen de eerste 2 actieve bronnen
    npm run scrape -- --dry-run    # mock-extractie; test dedup + MDX-schrijven
                                   # zonder Firecrawl/Claude-keys

  Env: FIRECRAWL_API_KEY, ANTHROPIC_API_KEY (niet nodig bij --dry-run).
*/
import {
  readBronnen,
  existingEventKeys,
  dedupKey,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
import { isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";
import { scrapeAgenda, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
const REF_YEAR = new Date().getUTCFullYear();

/** Mock-extractie voor --dry-run: twee toekomstige events per bron. */
function mockOutcome(bron: Bron): ScrapeOutcome {
  const events: ScrapedEvent[] = [
    {
      titel: `Proefopgieting ${bron.naam}`,
      type: "regulier",
      startDatum: "2027-02-14",
      tijden: "19:00 – 22:00",
      prijsIndicatie: "Bij dagentree",
      beschrijving: `Mock-event voor ${bron.naam} (dry-run).`,
    },
    {
      titel: `Winter Aufguss ${bron.naam}`,
      type: "thema",
      startDatum: "2027-03-07",
      beschrijving: `Tweede mock-event voor ${bron.naam} (dry-run).`,
    },
  ];
  return { events, markdown: "(dry-run)", method: "none", warnings: ["dry-run: geen echte fetch"] };
}

async function main() {
  const data = readBronnen();
  const actief = data.bronnen.filter((b) => b.status === "actief");
  const targets = actief.slice(0, LIMIT);

  console.log(
    `Scraper gestart${DRY_RUN ? " (DRY-RUN)" : ""}. ` +
      `${targets.length} van ${actief.length} actieve bronnen.\n`
  );

  const existing = existingEventKeys();
  const seen = new Set<string>(); // dedup binnen deze run
  let written = 0;
  let skipped = 0;

  for (const bron of targets) {
    console.log(`— ${bron.naam} (${bron.agendaUrl})`);

    // robots.txt naleven (Firecrawl doet dit ook, maar we checken beleefd vooraf).
    if (!DRY_RUN && !(await isAllowed(bron.agendaUrl))) {
      console.log("  ⚠ robots.txt blokkeert deze URL — overgeslagen.\n");
      continue;
    }

    let outcome: ScrapeOutcome;
    try {
      outcome = DRY_RUN
        ? mockOutcome(bron)
        : await scrapeAgenda(bron.agendaUrl, { saunaNaam: bron.naam, land: bron.land, jaar: REF_YEAR });
    } catch (err) {
      console.log(`  ✗ Fout: ${err instanceof Error ? err.message : String(err)}\n`);
      continue;
    }

    for (const w of outcome.warnings) console.log(`  · ${w}`);
    console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);

    for (const ev of outcome.events) {
      const key = dedupKey(bron.saunaSlug, ev.startDatum);
      if (existing.has(key) || seen.has(key)) {
        console.log(`  = dedup: ${ev.titel} (${ev.startDatum}) bestaat al.`);
        skipped++;
        continue;
      }

      const newEvent: NewEvent = {
        saunaSlug: bron.saunaSlug,
        titel: ev.titel,
        type: ev.type,
        startDatum: ev.startDatum,
        eindDatum: ev.eindDatum,
        tijden: ev.tijden,
        prijsIndicatie: ev.prijsIndicatie,
        ticketUrl: ev.ticketUrl ?? bron.agendaUrl,
        beschrijving: ev.beschrijving,
      };

      const path = writeEventMdx(newEvent);
      if (path) {
        seen.add(key);
        written++;
        console.log(`  + nieuw concept: ${path.replace(process.cwd() + "/", "")}`);
      } else {
        skipped++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
    }

    console.log("");
    if (!DRY_RUN) await sleep(REQUEST_DELAY_MS);
  }

  console.log(`Klaar. ${written} nieuw concept-event(s), ${skipped} overgeslagen (dedup).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
