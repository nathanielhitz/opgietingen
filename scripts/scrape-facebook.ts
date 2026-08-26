/*
  Facebook-postscraper. Leest content/bronnen.json, haalt voor elke bron MET
  een facebook-veld de recente foto-posts op via gallery-dl (src/lib/facebook.ts,
  gratis, geen login), extraheert events uit de samengevoegde captions (Claude,
  via extractEventsFromText — src/lib/scraper.ts), dedupliceert tegen bestaande
  events (saunaSlug + startDatum, plus de cross-sauna titel/datum-check),
  beoordeelt via de kwaliteitspoort en schrijft ze als MDX. Publicatieregel
  IDENTIEK aan scrape-events.ts (niet aan scrape-mail.ts, dat altijd concept
  blijft): de facebook-URL komt uit onze eigen gecureerde bronnen.json, niet
  uit een spoofbare afzender. Status "gepubliceerd" bij poort-pass + opgiet-
  trefwoord in de titel + geen cross-sauna-kopie + geen externe ticket-URL +
  SCRAPE_AUTOPUBLISH=true, anders "concept" (met de blokkades in keurNotitie).

  Gebruik:
    npm run scrape-facebook                 # alle bronnen met een facebook-veld
    npm run scrape-facebook -- --limit 2    # eerste 2 van die bronnen
    npm run scrape-facebook -- --dry-run    # mock-extractie; test poort + dedup + MDX
                                             # zonder gallery-dl/API-keys

  Env: ANTHROPIC_API_KEY (niet nodig bij --dry-run), SCRAPE_AUTOPUBLISH=true.
  Vereist gallery-dl op PATH (python3 -m gallery_dl); ontbreekt dat, dan faalt
  de fetch per bron met een warning (zie src/lib/facebook.ts) — nooit de hele run.
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readBronnen,
  existingEventTitles,
  existingTitelDatumIndex,
  existingSaunaSlugs,
  externeTicketHost,
  dedupKey,
  titelDatumKey,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent, OPGIET_RE } from "./lib/quality-gate";
import { appendScrapeWarnings } from "./lib/warnings";
import { sleep, REQUEST_DELAY_MS } from "./lib/net";
import { todayISOInTimeZone } from "../src/lib/dates";
import { extractEventsFromText, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";
import { fetchFacebookPosts, type FacebookPost } from "../src/lib/facebook";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
// Dry-run schrijft naar een tijdelijke map: mock-events horen nooit in
// content/events/ terecht te komen (en dus ook nooit in een commit).
const DOEL_DIR = DRY_RUN ? fs.mkdtempSync(path.join(os.tmpdir(), "opgietingen-fb-dry-run-")) : undefined;
const TODAY = todayISOInTimeZone();
const AUTO_PUBLISH = process.env.SCRAPE_AUTOPUBLISH === "true";

const CAPTION_SCHEIDING = "\n\n---\n\n";

/**
 * Voegt captions samen tot één tekstblok voor extractEventsFromText: die
 * ondersteunt al meerdere events uit één tekstblok (zoals een volledige
 * agendapagina of een nieuwsbrief-mail met meerdere aankondigingen), dus één
 * aanroep per bron volstaat — geen aparte Claude-call per post nodig.
 */
function samengesteldeTekst(posts: FacebookPost[]): string {
  return posts.map((p) => `Post van ${p.datum}:\n${p.caption}`).join(CAPTION_SCHEIDING);
}

/** Mock-extractie voor --dry-run: dekt zowel het autopublish-pad als een blokkade. */
function mockOutcome(): ScrapeOutcome {
  const events: ScrapedEvent[] = [
    // Geldig — moet slagen (gepubliceerd bij AUTO_PUBLISH).
    {
      titel: "Opgietweekend (mock uit Facebook-post)",
      type: "opgietweekend",
      startDatum: "2027-02-06",
      beschrijving: "Twee dagen vol warme wappers en thema-opgietingen.",
    },
    // Poort ok (beschrijving bevat "opgietingen"), maar het opgiet-trefwoord
    // staat niet in de TITEL → nooit auto-publiceren.
    {
      titel: "Feestweekend (mock)",
      type: "regulier",
      startDatum: "2027-03-01",
      beschrijving: "Een gezellig weekend met opgietingen, maar het woord staat niet in de titel.",
    },
  ];
  // Geslaagde methode: "none" is voorbehouden aan een gefaalde extractie.
  return { events, markdown: "", method: "plain-claude", warnings: ["dry-run: geen echte fetch/extractie"] };
}

async function main() {
  const data = readBronnen();
  const targets = data.bronnen
    .filter((b): b is Bron & { facebook: string } => Boolean(b.facebook))
    .slice(0, LIMIT);

  console.log(
    `Facebook-scraper gestart${DRY_RUN ? " (DRY-RUN)" : ""}. ` +
      `${targets.length} bron(nen) met een facebook-veld.\n`,
  );

  const existing = existingEventTitles();
  const perTitelDatum = existingTitelDatumIndex();
  const saunaSlugs = existingSaunaSlugs();
  const seen = new Set<string>(); // dedup binnen deze run
  const rapportWarnings: { bron: string; melding: string }[] = [];
  let written = 0;
  let skipped = 0;

  for (const bron of targets) {
    console.log(`— ${bron.naam} (${bron.facebook})`);

    let outcome: ScrapeOutcome | null = null;

    if (DRY_RUN) {
      outcome = mockOutcome();
    } else {
      const fetched = await fetchFacebookPosts(bron.facebook, { vandaag: TODAY });
      for (const w of fetched.warnings) console.log(`  · ${w}`);
      if (fetched.warnings.length) {
        rapportWarnings.push({ bron: bron.naam, melding: fetched.warnings.join(" | ") });
      }
      if (fetched.posts.length > 0) {
        try {
          outcome = await extractEventsFromText(samengesteldeTekst(fetched.posts), {
            saunaNaam: bron.naam,
            land: bron.land === "BE" ? "BE" : "NL",
            vandaag: TODAY,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`  ✗ Fout: ${msg}`);
          rapportWarnings.push({ bron: bron.naam, melding: `extractie-fout: ${msg}` });
        }
      } else {
        console.log("  Geen (recente) posts gevonden.");
      }
    }

    if (outcome) {
      for (const w of outcome.warnings) console.log(`  · ${w}`);
      console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);
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

        if (verdict.verleden) {
          console.log(`  · voorbij: ${ev.titel} (${ev.startDatum}) — niet weggeschreven.`);
          skipped++;
          continue;
        }

        // Zelfde titel op dezelfde dag bij een ándere sauna: vrijwel altijd een
        // keten-sauna die het event van een collega aankondigt.
        const tdKey = titelDatumKey(ev.titel, ev.startDatum);
        const eerdereSauna = perTitelDatum.get(tdKey);
        const isKopie = eerdereSauna !== undefined && eerdereSauna !== bron.id;

        const blokkades: string[] = [];
        if (!verdict.passed) blokkades.push(verdict.redenen.join("; "));
        if (isKopie) {
          blokkades.push(
            `zelfde titel en datum staan al bij "${eerdereSauna}" — waarschijnlijk kondigt deze sauna het event van een ander alleen aan; handmatig beoordelen`,
          );
        }
        const externeHost = externeTicketHost(ev.ticketUrl, bron.website || bron.agendaUrl);
        if (externeHost) {
          blokkades.push(
            `ticket-URL wijst naar extern domein ${externeHost} — controleer of dit een echte ticketpagina voor dit event is`,
          );
        }
        if (verdict.passed && !OPGIET_RE.test(ev.titel)) {
          blokkades.push(
            "opgiet-trefwoord staat niet in de titel, hooguit in de beschrijving — handmatig beoordelen en publiceren",
          );
        }

        const status: "concept" | "gepubliceerd" =
          AUTO_PUBLISH && blokkades.length === 0 ? "gepubliceerd" : "concept";
        const keurNotitie = blokkades.length ? blokkades.join("; ") : undefined;

        const newEvent: NewEvent = {
          saunaSlug: bron.id,
          titel: ev.titel,
          type: ev.type,
          startDatum: ev.startDatum,
          eindDatum: ev.eindDatum,
          tijden: ev.tijden,
          prijsIndicatie: ev.prijsIndicatie,
          ticketUrl: ev.ticketUrl ?? (bron.website || bron.agendaUrl),
          beschrijving: ev.beschrijving,
          status,
          ...(keurNotitie ? { keurNotitie } : {}),
        };

        const filePath = writeEventMdx(newEvent, DOEL_DIR);
        if (filePath) {
          seen.add(key);
          if (!perTitelDatum.has(tdKey)) perTitelDatum.set(tdKey, bron.id);
          written++;
          console.log(
            `  + ${status}${keurNotitie ? " (concept: " + keurNotitie + ")" : ""} — ${ev.titel}`,
          );
        } else {
          skipped++;
          console.log(`  = bestand bestaat al voor: ${ev.titel}`);
        }
      }
    }

    console.log("");
    if (!DRY_RUN) await sleep(REQUEST_DELAY_MS);
  }

  if (!DRY_RUN) appendScrapeWarnings(TODAY, rapportWarnings);
  console.log(
    `Klaar. ${written} nieuw event(s), ${skipped} overgeslagen (dedup), ` +
      `${rapportWarnings.length} waarschuwing(en)${DRY_RUN ? "" : " → scrape-warnings.json"}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
