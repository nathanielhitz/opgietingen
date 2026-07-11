/*
  Event-scraper. Leest content/bronnen.json, scrapet elke ACTIEVE bron via de
  Firecrawl-laag (src/lib/scraper.ts, met Claude-fallback), dedupliceert tegen
  bestaande events (saunaSlug + startDatum), beoordeelt elk event via de
  kwaliteitspoort (scripts/lib/quality-gate.ts) en schrijft het als MDX. Status:
  "gepubliceerd" als het door de poort komt én SCRAPE_AUTOPUBLISH=true staat,
  anders "concept" (met de afkeurreden(en) in keurNotitie).

  Gebruik:
    npm run scrape                 # alle actieve bronnen (vereist API-keys)
    npm run scrape -- --limit 2    # alleen de eerste 2 actieve bronnen
    npm run scrape -- --dry-run    # mock-extractie; test poort + dedup + MDX
                                   # zonder Firecrawl/Claude-keys

  Env: FIRECRAWL_API_KEY, ANTHROPIC_API_KEY (niet nodig bij --dry-run),
       SCRAPE_AUTOPUBLISH=true (zet auto-publiceren aan; standaard uit).
*/
import {
  readBronnen,
  existingEventKeys,
  existingSaunaSlugs,
  dedupKey,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent } from "./lib/quality-gate";
import { isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";
import { scrapeAgenda, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
const REF_YEAR = new Date().getUTCFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const AUTO_PUBLISH = process.env.SCRAPE_AUTOPUBLISH === "true";

/** Mock-extractie voor --dry-run: twee toekomstige events per bron. */
function mockOutcome(bron: Bron): ScrapeOutcome {
  const events: ScrapedEvent[] = [
    // Geldig — moet slagen (gepubliceerd bij AUTO_PUBLISH).
    {
      titel: "Aufguss-avond (mock)",
      type: "thema",
      startDatum: "2027-02-14",
      beschrijving: "Sfeervolle opgieting met muziek.",
    },
    {
      titel: "Opgietweekend (mock)",
      type: "opgietweekend",
      startDatum: "2027-03-07",
      beschrijving: "Doorlopende opgietingen het hele weekend.",
    },
    // Afkeur: datum in verleden.
    {
      titel: "Oude Aufguss (mock)",
      type: "thema",
      startDatum: "2020-01-01",
      beschrijving: "Voorbije opgieting.",
    },
    // Afkeur: niet-opgiet-event.
    {
      titel: "Moederdagbrunch (mock)",
      type: "regulier",
      startDatum: "2027-05-10",
      beschrijving: "Luxe buffet met bubbels.",
    },
    // Afkeur: ongeldig type.
    {
      titel: "Opgieting met fout type (mock)",
      type: "feestje" as ScrapedEvent["type"],
      startDatum: "2027-06-01",
      beschrijving: "Bevat opgiet-trefwoord maar fout type.",
    },
  ];
  return { events, markdown: "", method: "none", warnings: ["dry-run: geen echte fetch"] };
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
  const saunaSlugs = existingSaunaSlugs();
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
        : await scrapeAgenda(bron.agendaUrl, {
            saunaNaam: bron.naam,
            land: bron.land === "BE" ? "BE" : "NL",
            jaar: REF_YEAR,
          });
    } catch (err) {
      console.log(`  ✗ Fout: ${err instanceof Error ? err.message : String(err)}\n`);
      continue;
    }

    for (const w of outcome.warnings) console.log(`  · ${w}`);
    console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);

    for (const ev of outcome.events) {
      const key = dedupKey(bron.id, ev.startDatum);
      if (existing.has(key) || seen.has(key)) {
        console.log(`  = dedup: ${ev.titel} (${ev.startDatum}) bestaat al.`);
        skipped++;
        continue;
      }

      const verdict = evaluateEvent(
        {
          saunaSlug: bron.id,
          titel: ev.titel,
          type: ev.type,
          startDatum: ev.startDatum,
          beschrijving: ev.beschrijving,
        },
        { saunaSlugs, today: TODAY },
      );

      const status: "concept" | "gepubliceerd" =
        verdict.passed && AUTO_PUBLISH ? "gepubliceerd" : "concept";

      const newEvent: NewEvent = {
        saunaSlug: bron.id,
        titel: ev.titel,
        type: ev.type,
        startDatum: ev.startDatum,
        eindDatum: ev.eindDatum,
        tijden: ev.tijden,
        prijsIndicatie: ev.prijsIndicatie,
        ticketUrl: ev.ticketUrl ?? bron.agendaUrl,
        beschrijving: ev.beschrijving,
        status,
        ...(verdict.passed ? {} : { keurNotitie: verdict.redenen.join("; ") }),
      };

      const path = writeEventMdx(newEvent);
      if (path) {
        seen.add(key);
        written++;
        console.log(
          `  + ${status}${verdict.passed ? "" : " (afgekeurd: " + verdict.redenen.join("; ") + ")"} — ${ev.titel}`,
        );
      } else {
        skipped++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
    }

    console.log("");
    if (!DRY_RUN) await sleep(REQUEST_DELAY_MS);
  }

  console.log(`Klaar. ${written} nieuw event(s), ${skipped} overgeslagen (dedup).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
