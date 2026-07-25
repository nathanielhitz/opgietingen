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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readBronnen,
  existingEventTitles,
  existingSaunaSlugs,
  dedupKey,
  slugify,
  writeEventMdx,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent, OPGIET_RE } from "./lib/quality-gate";
import { isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";
import { todayISOInTimeZone } from "../src/lib/dates";
import { scrapeAgenda, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
// Dry-run schrijft naar een tijdelijke map: mock-events horen nooit in
// content/events/ terecht te komen (en dus ook nooit in een commit).
const DOEL_DIR = process.argv.includes("--dry-run")
  ? fs.mkdtempSync(path.join(os.tmpdir(), "opgietingen-dry-run-"))
  : undefined;
const TODAY = todayISOInTimeZone();
const AUTO_PUBLISH = process.env.SCRAPE_AUTOPUBLISH === "true";
/** Waarschuwingen per run; scrape-report neemt ze mee in het wekelijkse issue. */
const WARNINGS_PATH = "scrape-warnings.json";

/** Mock-extractie voor --dry-run: twee toekomstige events per bron. */
function mockOutcome(): ScrapeOutcome {
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

  const existing = existingEventTitles();
  const saunaSlugs = existingSaunaSlugs();
  const seen = new Set<string>(); // dedup binnen deze run
  const rapportWarnings: { bron: string; melding: string }[] = [];
  let written = 0;
  let skipped = 0;

  for (const bron of targets) {
    console.log(`— ${bron.naam} (${bron.agendaUrl})`);

    // robots.txt naleven (Firecrawl doet dit ook, maar we checken beleefd vooraf).
    if (!DRY_RUN && !(await isAllowed(bron.agendaUrl))) {
      console.log("  ⚠ robots.txt blokkeert deze URL — overgeslagen.\n");
      rapportWarnings.push({ bron: bron.naam, melding: "robots.txt blokkeert de agenda-URL" });
      continue;
    }

    let outcome: ScrapeOutcome;
    try {
      outcome = DRY_RUN
        ? mockOutcome()
        : await scrapeAgenda(bron.agendaUrl, {
            saunaNaam: bron.naam,
            land: bron.land === "BE" ? "BE" : "NL",
            vandaag: TODAY,
          });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Fout: ${msg}\n`);
      rapportWarnings.push({ bron: bron.naam, melding: `scrape-fout: ${msg}` });
      continue;
    }

    for (const w of outcome.warnings) console.log(`  · ${w}`);
    console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);
    // "none" = de extractie faalde echt (0 events via een geslaagde route is
    // gewoon een lege agenda) → dat hoort in het weekissue, niet alleen stdout.
    if (!DRY_RUN && outcome.method === "none") {
      rapportWarnings.push({
        bron: bron.naam,
        melding: `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`,
      });
    }

    for (const ev of outcome.events) {
      const key = dedupKey(bron.id, ev.startDatum);
      if (existing.has(key) || seen.has(key)) {
        console.log(`  = dedup: ${ev.titel} (${ev.startDatum}) bestaat al.`);
        // De grove dedup-sleutel (sauna+dag) laat één event per dag toe; wijkt
        // de titel duidelijk af, dan is er mogelijk een tweede echt event →
        // mens laten kijken via het weekissue.
        const bestaande = existing.get(key);
        if (bestaande && slugify(bestaande) !== slugify(ev.titel)) {
          rapportWarnings.push({
            bron: bron.naam,
            melding: `mogelijk tweede event op ${ev.startDatum}: "${ev.titel}" naast bestaand "${bestaande}" (dedup liet het vallen)`,
          });
        }
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

      // Auto-publiceren vereist het opgiet-trefwoord in de TITEL: een
      // modelgegenereerde beschrijving kan het woord "opgieting" terloops
      // bevatten terwijl het event zelf een brunch is. Trefwoord alleen in de
      // beschrijving → concept, met notitie voor de handmatige check.
      const titelHeeftTrefwoord = OPGIET_RE.test(ev.titel);
      const status: "concept" | "gepubliceerd" =
        verdict.passed && AUTO_PUBLISH && titelHeeftTrefwoord ? "gepubliceerd" : "concept";
      const keurNotitie = !verdict.passed
        ? verdict.redenen.join("; ")
        : titelHeeftTrefwoord
          ? undefined
          : "poort ok, maar opgiet-trefwoord staat alleen in de beschrijving, niet in de titel — handmatig beoordelen en publiceren";

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
        ...(keurNotitie ? { keurNotitie } : {}),
      };

      const path = writeEventMdx(newEvent, DOEL_DIR);
      if (path) {
        seen.add(key);
        written++;
        console.log(
          `  + ${status}${keurNotitie ? " (concept: " + keurNotitie + ")" : ""} — ${ev.titel}`,
        );
      } else {
        skipped++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
    }

    console.log("");
    if (!DRY_RUN) await sleep(REQUEST_DELAY_MS);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(
      WARNINGS_PATH,
      JSON.stringify({ run: TODAY, warnings: rapportWarnings }, null, 2) + "\n",
    );
  }
  console.log(
    `Klaar. ${written} nieuw event(s), ${skipped} overgeslagen (dedup), ` +
      `${rapportWarnings.length} waarschuwing(en)${DRY_RUN ? "" : ` → ${WARNINGS_PATH}`}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
