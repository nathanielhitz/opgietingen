/*
  Nieuwsbrief-scraper. Leest ONGELEZEN mails uit de gedeelde inbox
  (events@opgietingen.nl) via de IMAP-laag (src/lib/mail.ts), koppelt elke mail op
  afzender aan een sauna-bron (→ saunaSlug), extraheert events uit de mailinhoud
  (src/lib/scraper.ts → Claude), dedupliceert (saunaSlug + startDatum), beoordeelt
  via de kwaliteitspoort en schrijft ze als MDX. Identieke verwerking als de
  website-scraper: status "gepubliceerd" bij poort-pass én SCRAPE_AUTOPUBLISH=true,
  anders "concept" (met keurNotitie).

  Gebruik:
    npm run scrape-mail                 # verwerk ongelezen mail (vereist IMAP + API-keys)
    npm run scrape-mail -- --limit 5    # max. 5 mails
    npm run scrape-mail -- --dry-run    # mock-inbox + mock-extractie; geen keys nodig

  Env: MAIL_IMAP_HOST/USER/PASS (+ optioneel PORT/TLS/MAILBOX), ANTHROPIC_API_KEY,
       SCRAPE_AUTOPUBLISH=true (auto-publiceren; standaard uit).
*/
import {
  readBronnen,
  existingEventKeys,
  existingSaunaSlugs,
  matchBronBySender,
  dedupKey,
  slugify,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent } from "./lib/quality-gate";
import { extractEventsFromText, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";
import { fetchUnseenMail, readMailConfig, type MailMessage } from "./lib/mail";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
const REF_YEAR = new Date().getUTCFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const AUTO_PUBLISH = process.env.SCRAPE_AUTOPUBLISH === "true";

/** Mock-inbox voor --dry-run: één herkende afzender, één onbekende. */
function mockMail(): MailMessage[] {
  return [
    {
      uid: 1,
      from: "agenda@thermenbussloo.nl", // matcht thermen-bussloo op website-domein
      subject: "Opgietagenda deze maand",
      markdown: "Aufguss-avond op 14 februari 2027, 19:00-23:00. Sfeervolle opgieting met muziek.",
    },
    {
      uid: 2,
      from: "nieuws@onbekende-sauna.example", // geen bron → concept, handmatig toewijzen
      subject: "Onze opgietingen",
      markdown: "Opgietweekend op 7 maart 2027.",
    },
  ];
}

/** Mock-extractie voor --dry-run: één geldig toekomstig event uit de mail. */
function mockOutcome(mail: MailMessage): ScrapeOutcome {
  const events: ScrapedEvent[] = [
    {
      titel: `Aufguss uit nieuwsbrief (${mail.subject})`,
      type: "thema",
      startDatum: mail.uid === 1 ? "2027-02-14" : "2027-03-07",
      beschrijving: "Opgieting aangekondigd via de nieuwsbrief.",
    },
  ];
  return { events, markdown: mail.markdown, method: "none", warnings: ["dry-run: geen echte extractie"] };
}

async function main() {
  const data = readBronnen();
  const existing = existingEventKeys();
  const saunaSlugs = existingSaunaSlugs();
  const seen = new Set<string>(); // dedup binnen deze run
  let written = 0;
  let skipped = 0;

  let mails: MailMessage[];
  if (DRY_RUN) {
    mails = mockMail().slice(0, LIMIT === Infinity ? undefined : LIMIT);
  } else if (!process.env.MAIL_IMAP_HOST) {
    // Geen IMAP geconfigureerd → netjes overslaan (bv. cron vóór secrets gezet zijn).
    console.log("IMAP niet geconfigureerd (MAIL_IMAP_HOST ontbreekt) — mail-scrape overgeslagen.");
    return;
  } else {
    try {
      mails = await fetchUnseenMail(readMailConfig(), { limit: LIMIT });
    } catch (err) {
      // Verbindings-/inboxfout (timeout, firewall, verkeerde poort, auth) mag de
      // wekelijkse workflow niet blokkeren: de website-scrape-resultaten moeten nog
      // gecommit worden. Log duidelijk en sla de mail-stap netjes over (exit 0).
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Mail-scrape overgeslagen — kon de inbox niet bereiken: ${msg}`);
      return;
    }
  }

  console.log(
    `Mail-scraper gestart${DRY_RUN ? " (DRY-RUN)" : ""}. ${mails.length} ongelezen bericht(en).\n`,
  );

  for (const mail of mails) {
    const bron: Bron | undefined = matchBronBySender(data.bronnen, mail.from);
    // Geen match → afzender-slug als saunaSlug; de poort keurt dit af (onbekende
    // saunaSlug) zodat het als concept blijft staan voor handmatige toewijzing.
    const saunaSlug = bron?.id ?? slugify(mail.from);
    const land: "NL" | "BE" = bron?.land === "BE" ? "BE" : "NL";

    console.log(
      `— ${mail.from} · "${mail.subject}" → ${bron ? `sauna: ${bron.id}` : "GEEN match (concept)"}`,
    );

    let outcome: ScrapeOutcome;
    try {
      outcome = DRY_RUN
        ? mockOutcome(mail)
        : await extractEventsFromText(mail.markdown, { saunaNaam: bron?.naam ?? mail.from, land, jaar: REF_YEAR });
    } catch (err) {
      console.log(`  ✗ Fout: ${err instanceof Error ? err.message : String(err)}\n`);
      continue;
    }

    for (const w of outcome.warnings) console.log(`  · ${w}`);
    console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);

    for (const ev of outcome.events) {
      const key = dedupKey(saunaSlug, ev.startDatum);
      if (existing.has(key) || seen.has(key)) {
        console.log(`  = dedup: ${ev.titel} (${ev.startDatum}) bestaat al.`);
        skipped++;
        continue;
      }

      const verdict = evaluateEvent(
        { saunaSlug, titel: ev.titel, type: ev.type, startDatum: ev.startDatum, beschrijving: ev.beschrijving },
        { saunaSlugs, today: TODAY },
      );

      const status: "concept" | "gepubliceerd" =
        verdict.passed && AUTO_PUBLISH ? "gepubliceerd" : "concept";

      // Zonder bron-match de afzender in de keurnotitie zetten voor handmatige review.
      const redenen = [...verdict.redenen];
      if (!bron) redenen.unshift(`nieuwsbrief van onbekende afzender: ${mail.from} — wijs handmatig een sauna toe`);

      const newEvent: NewEvent = {
        saunaSlug,
        titel: ev.titel,
        type: ev.type,
        startDatum: ev.startDatum,
        eindDatum: ev.eindDatum,
        tijden: ev.tijden,
        prijsIndicatie: ev.prijsIndicatie,
        ticketUrl: ev.ticketUrl ?? bron?.website,
        beschrijving: ev.beschrijving,
        status,
        ...(redenen.length ? { keurNotitie: redenen.join("; ") } : {}),
      };

      const path = writeEventMdx(newEvent);
      if (path) {
        seen.add(key);
        written++;
        console.log(
          `  + ${status}${redenen.length ? " (afgekeurd: " + redenen.join("; ") + ")" : ""} — ${ev.titel}`,
        );
      } else {
        skipped++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
    }
    console.log("");
  }

  console.log(`Klaar. ${written} nieuw event(s), ${skipped} overgeslagen.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
