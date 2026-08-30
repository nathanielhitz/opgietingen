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
  existingTitelDatumIndex,
  existingSaunaSlugs,
  externeTicketHost,
  dedupKey,
  titelDatumKey,
  slugify,
  writeEventMdx,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent, OPGIET_RE } from "./lib/quality-gate";
import { appendScrapeWarnings } from "./lib/warnings";
import { maakMetrics, legeTeller, naarMethode } from "./lib/metrics";
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

// Run-metrics voor /beheer (scripts/lib/metrics.ts); in dry-run niets schrijven.
const metrics = maakMetrics({ actief: !DRY_RUN });

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
    // Poort ok, maar ticket-URL wijst naar een vreemd domein → nooit auto-publiceren.
    {
      titel: "Aufguss met externe ticketlink (mock)",
      type: "thema",
      startDatum: "2027-07-03",
      ticketUrl: "https://tickets.voorbeeld-extern.example/aufguss",
      beschrijving: "Opgieting waarvan de tickets elders verkocht lijken te worden.",
    },
  ];
  // Geslaagde methode: "none" is voorbehouden aan een gefaalde extractie en
  // zou de dry-run een valse "extractie faalde"-waarschuwing opleveren.
  return { events, markdown: "", method: "plain-claude", warnings: ["dry-run: geen echte fetch"] };
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
  // Groeit tijdens de run mee met wat we wegschrijven, zodat twee sauna's die
  // in dezelfde run hetzelfde event aankondigen elkaar ook opvangen.
  const perTitelDatum = existingTitelDatumIndex();
  const saunaSlugs = existingSaunaSlugs();
  const seen = new Set<string>(); // dedup binnen deze run
  const rapportWarnings: { bron: string; melding: string }[] = [];
  let written = 0;
  let skipped = 0;

  for (const bron of targets) {
    console.log(`— ${bron.naam} (${bron.agendaUrl})`);
    const teller = legeTeller(bron.id);

    // robots.txt naleven (Firecrawl doet dit ook, maar we checken beleefd vooraf).
    if (!DRY_RUN && !(await isAllowed(bron.agendaUrl))) {
      console.log("  ⚠ robots.txt blokkeert deze URL — overgeslagen.\n");
      rapportWarnings.push({ bron: bron.naam, melding: "robots.txt blokkeert de agenda-URL" });
      metrics.bron("website", { ...teller, fout: "robots.txt blokkeert de agenda-URL" });
      continue;
    }

    let outcome: ScrapeOutcome;
    try {
      outcome = DRY_RUN
        ? mockOutcome()
        : await scrapeAgenda(
            bron.agendaUrl,
            {
              saunaNaam: bron.naam,
              land: bron.land === "BE" ? "BE" : "NL",
              vandaag: TODAY,
            },
            // De check hierboven geldt de opgegeven URL; deze dekt het doel van
            // een eventuele redirect, zodat robots ook daar wordt nageleefd.
            isAllowed,
          );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Fout: ${msg}\n`);
      rapportWarnings.push({ bron: bron.naam, melding: `scrape-fout: ${msg}` });
      metrics.bron("website", { ...teller, fout: `scrape-fout: ${msg}` });
      continue;
    }

    for (const w of outcome.warnings) console.log(`  · ${w}`);
    console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);
    teller.methode = naarMethode(outcome.method);
    teller.kandidaten = outcome.events.length;
    if (outcome.method === "none") teller.fout = `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`;
    // "none" = de extractie faalde echt (0 events via een geslaagde route is
    // gewoon een lege agenda) → dat hoort in het weekissue, niet alleen stdout.
    if (!DRY_RUN && outcome.method === "none") {
      rapportWarnings.push({
        bron: bron.naam,
        melding: `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`,
      });
    } else if (!DRY_RUN && outcome.method === "claude-fallback" && outcome.events.length === 0) {
      // Deze route wordt alleen bereikt nadat de kale fetch niets bruikbaars
      // gaf én Firecrawl ook 0 events vond. Dat is geen extractiefout — een
      // lege agenda kan echt — maar het is wel het profiel van een bron
      // waarvan de agendapagina van vorm veranderd is. Zonder deze melding
      // zou zo'n bron sinds de "none"-herdefinitie geruisloos leeg blijven.
      rapportWarnings.push({
        bron: bron.naam,
        melding: `0 events, ook na de Firecrawl-route (${outcome.warnings.join(" | ") || "geen details"})`,
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
        teller.dedup++;
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

      // Een afgelopen datum wordt elke run opnieuw afgekeurd, dus een concept
      // als dedup-anker levert niets op — alleen een bestand dat voorgoed in
      // het weekrapport blijft staan. Niet wegschrijven.
      if (verdict.verleden) {
        console.log(`  · voorbij: ${ev.titel} (${ev.startDatum}) — niet weggeschreven.`);
        skipped++;
        teller.verleden++;
        continue;
      }

      // Zelfde titel op dezelfde dag bij een ándere sauna: vrijwel altijd een
      // keten-sauna die het event van een collega aankondigt. Nooit
      // automatisch publiceren — anders staat één finale vijf keer op de site.
      const tdKey = titelDatumKey(ev.titel, ev.startDatum);
      const eerdereSauna = perTitelDatum.get(tdKey);
      const isKopie = eerdereSauna !== undefined && eerdereSauna !== bron.id;

      // Alles wat automatisch publiceren in de weg staat, in één lijst: de
      // status volgt eruit en de redenen belanden samen in keurNotitie, zodat
      // een event dat op meerdere punten twijfelachtig is dat ook allemaal
      // vermeldt in plaats van alleen de eerste reden.
      const blokkades: string[] = [];

      if (!verdict.passed) blokkades.push(verdict.redenen.join("; "));

      if (isKopie) {
        blokkades.push(
          `zelfde titel en datum staan al bij "${eerdereSauna}" — waarschijnlijk kondigt deze sauna het event van een ander alleen aan; handmatig beoordelen`,
        );
      }

      // Een ticket-URL naar een vreemd domein wordt via /uit/[slug] een 302
      // onder onze eigen naam. Externe ticketshops zijn legitiem, dus we
      // blokkeren de URL niet — maar publiceren hem nooit automatisch.
      // || en niet ??: een leeg website-veld moet doorvallen naar de agenda-URL,
      // anders is de bron-host onbepaald en telt élke ticket-URL als extern.
      const externeHost = externeTicketHost(ev.ticketUrl, bron.website || bron.agendaUrl);
      if (externeHost) {
        blokkades.push(
          `ticket-URL wijst naar extern domein ${externeHost} — controleer of dit een echte ticketpagina voor dit event is`,
        );
      }

      // Auto-publiceren vereist het opgiet-trefwoord in de TITEL: een
      // modelgegenereerde beschrijving kan het woord "opgieting" terloops
      // bevatten terwijl het event zelf een brunch is.
      // Elke reden moet op zichzelf kloppen: ze staan naast elkaar in dezelfde
      // notitie, dus geen aannames over de andere blokkades in de tekst. Bij
      // een gefaalde poort blijft deze reden weg — "beoordeel en publiceer"
      // naast een afkeuring wegens niet-opgiet leest als tegenstrijdig advies,
      // en de status verandert er niet door (de poortreden blokkeert al).
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
        ticketUrl: ev.ticketUrl ?? bron.agendaUrl,
        beschrijving: ev.beschrijving,
        status,
        ...(keurNotitie ? { keurNotitie } : {}),
      };

      const mdxPad = writeEventMdx(newEvent, DOEL_DIR);
      if (mdxPad) {
        seen.add(key);
        if (!perTitelDatum.has(tdKey)) perTitelDatum.set(tdKey, bron.id);
        written++;
        if (status === "gepubliceerd") teller.gepubliceerd++;
        else teller.concept++;
        if (!verdict.passed) teller.afgekeurd++;
        metrics.event({
          slug: path.basename(mdxPad, ".mdx"),
          kanaal: "website",
          bron: bron.id,
          status,
          ...(keurNotitie ? { reden: keurNotitie } : {}),
        });
        console.log(
          `  + ${status}${keurNotitie ? " (concept: " + keurNotitie + ")" : ""} — ${ev.titel}`,
        );
      } else {
        skipped++;
        teller.dedup++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
    }

    metrics.bron("website", teller);
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
