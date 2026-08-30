/*
  Nieuwsbrief-scraper. Leest ONGELEZEN mails uit de gedeelde inbox
  (events@opgietingen.nl) via de IMAP-laag (src/lib/mail.ts), koppelt elke mail op
  afzender aan een sauna-bron (→ saunaSlug),
  mails van vertrouwde doorstuurders (MAIL_VERTROUWDE_AFZENDERS, voor
  doorgestuurde Facebook-posts) worden bij een gemiste afzender-match op
  INHOUD gekoppeld (facebook-veld/website-domein via matchBronByContent),
  extraheert events uit de mailinhoud (src/lib/scraper.ts → Claude), dedupliceert
  (saunaSlug + startDatum), beoordeelt
  via de kwaliteitspoort en schrijft ze als MDX. Identieke verwerking als de
  website-scraper: status "gepubliceerd" bij poort-pass én SCRAPE_AUTOPUBLISH=true,
  anders "concept" (met keurNotitie).

  Gebruik:
    npm run scrape-mail                 # verwerk ongelezen mail (vereist IMAP + API-keys)
    npm run scrape-mail -- --limit 5    # max. 5 mails
    npm run scrape-mail -- --dry-run    # mock-inbox + mock-extractie; geen keys nodig

  Env: MAIL_IMAP_HOST/USER/PASS (+ optioneel PORT/TLS/MAILBOX), ANTHROPIC_API_KEY,
       MAIL_VERTROUWDE_AFZENDERS (doorstuur-route), SCRAPE_AUTOPUBLISH=true.
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readBronnen,
  existingEventKeys,
  existingSaunaSlugs,
  isVertrouwdeAfzender,
  matchBronByContent,
  matchBronBySender,
  dedupKey,
  slugify,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent } from "./lib/quality-gate";
import { maakMetrics, legeTeller, naarMethode } from "./lib/metrics";
import { extractEventsFromText, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";
import { fetchUnseenMail, markMailSeen, readMailConfig, type MailConfig, type MailMessage } from "./lib/mail";
import { todayISOInTimeZone } from "../src/lib/dates";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
// Run-metrics voor /beheer (scripts/lib/metrics.ts); in dry-run niets schrijven.
const metrics = maakMetrics({ actief: !DRY_RUN });
// Dry-run schrijft naar een tijdelijke map (zelfde reden als scrape-events:
// mock-events mogen nooit in content/events/ belanden).
const DOEL_DIR = process.argv.includes("--dry-run")
  ? fs.mkdtempSync(path.join(os.tmpdir(), "opgietingen-mail-dry-run-"))
  : undefined;
const rawLimit = Number(argValue("--limit"));
const LIMIT = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : Infinity;
const TODAY = todayISOInTimeZone();
// Doorstuur-route: in dry-run een vast mock-adres zodat de route zonder env
// testbaar is; in productie uitsluitend wat de operator expliciet instelt.
const VERTROUWDE_AFZENDERS = DRY_RUN
  ? "doorstuur@voorbeeld.example"
  : process.env.MAIL_VERTROUWDE_AFZENDERS;

/**
 * Alleen een ticket-URL uit de mail accepteren wanneer die naar het domein van
 * de gematchte bron wijst: een From-header is spoofbaar, en een vreemde URL
 * zou via /uit/[slug] een open redirect onder onze naam worden.
 */
function veiligeTicketUrl(ticketUrl: string | undefined, website: string | undefined): string | undefined {
  if (!ticketUrl || !website) return website;
  try {
    const ticketHost = new URL(ticketUrl).hostname.replace(/^www\./, "");
    const bronHost = new URL(website).hostname.replace(/^www\./, "");
    return ticketHost === bronHost || ticketHost.endsWith(`.${bronHost}`) ? ticketUrl : website;
  } catch {
    return website;
  }
}

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
    {
      uid: 3,
      from: "doorstuur@voorbeeld.example", // vertrouwde doorstuurder → match op inhoud
      subject: "Fwd: opgietweekend bij Thermen Binnenmaas",
      markdown:
        "Opgietweekend op 11 en 12 april 2027 met gast-Aufgussmeisters!\n" +
        "https://www.facebook.com/ThermenBinnenmaas/posts/pfbid0voorbeeld",
    },
  ];
}

/** Mock-extractie voor --dry-run: één geldig toekomstig event uit de mail. */
function mockOutcome(mail: MailMessage): ScrapeOutcome {
  const startDatums: Record<number, string> = { 1: "2027-02-14", 2: "2027-03-07", 3: "2027-04-11" };
  const events: ScrapedEvent[] = [
    {
      titel: `Aufguss uit nieuwsbrief (${mail.subject})`,
      type: "thema",
      startDatum: startDatums[mail.uid] ?? "2027-05-01",
      beschrijving: "Opgieting aangekondigd via de nieuwsbrief.",
    },
  ];
  // Geslaagde methode: "none" betekent nu "extractie faalde" en zou de
  // dry-run-mails onterecht als onverwerkt laten gelden.
  return {
    events,
    markdown: mail.markdown,
    method: "claude-fallback",
    warnings: ["dry-run: geen echte extractie"],
  };
}

async function main() {
  const data = readBronnen();
  const existing = existingEventKeys();
  const saunaSlugs = existingSaunaSlugs();
  const seen = new Set<string>(); // dedup binnen deze run
  let written = 0;
  let skipped = 0;

  let mails: MailMessage[];
  let mailConfig: MailConfig | null = null;
  if (DRY_RUN) {
    mails = mockMail().slice(0, LIMIT === Infinity ? undefined : LIMIT);
  } else if (!process.env.MAIL_IMAP_HOST) {
    // Geen IMAP geconfigureerd → netjes overslaan (bv. cron vóór secrets gezet zijn).
    console.log("IMAP niet geconfigureerd (MAIL_IMAP_HOST ontbreekt) — mail-scrape overgeslagen.");
    return;
  } else {
    try {
      // \Seen pas ná succesvolle verwerking zetten: markeren bij het ophalen
      // betekent definitief mailverlies wanneer de extractie daarna crasht.
      mailConfig = readMailConfig();
      mails = await fetchUnseenMail(mailConfig, { limit: LIMIT, markSeen: false });
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

  const verwerkteUids: number[] = [];
  for (const mail of mails) {
    let bron: Bron | undefined = matchBronBySender(data.bronnen, mail.from);
    let matchRoute = bron ? `sauna: ${bron.id}` : "GEEN match (concept)";
    let viaInhoud = false;
    // Doorgestuurde post (bv. Facebook) van een vertrouwde doorstuurder: de
    // afzender zegt dan niets over de sauna, dus match op de mailinhoud.
    const vertrouwd = isVertrouwdeAfzender(mail.from, VERTROUWDE_AFZENDERS);
    if (!bron && vertrouwd) {
      // Onderwerp én body samen als matchtekst: een link staat soms alleen in
      // het onderwerp (bv. een doorgestuurde Facebook-post zonder eigen tekst).
      bron = matchBronByContent(data.bronnen, `${mail.subject}\n${mail.markdown}`);
      if (bron) {
        matchRoute = `sauna: ${bron.id} (op inhoud, doorgestuurd)`;
        viaInhoud = true;
      }
    }
    // Geen match → afzender-slug als saunaSlug; de poort keurt dit af (onbekende
    // saunaSlug) zodat het als concept blijft staan voor handmatige toewijzing.
    const saunaSlug = bron?.id ?? slugify(mail.from);
    const land: "NL" | "BE" = bron?.land === "BE" ? "BE" : "NL";

    console.log(`— ${mail.from} · "${mail.subject}" → ${matchRoute}`);
    const teller = legeTeller(bron?.id ?? "onbekend");

    let outcome: ScrapeOutcome;
    try {
      outcome = DRY_RUN
        ? mockOutcome(mail)
        : await extractEventsFromText(mail.markdown, { saunaNaam: bron?.naam ?? mail.from, land, vandaag: TODAY });
    } catch (err) {
      console.log(`  ✗ Fout: ${err instanceof Error ? err.message : String(err)}\n`);
      metrics.bron("mail", { ...teller, fout: `extractie-fout: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }

    for (const w of outcome.warnings) console.log(`  · ${w}`);
    console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);
    teller.methode = naarMethode(outcome.method);
    teller.kandidaten = outcome.events.length;
    if (outcome.method === "none") teller.fout = `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`;

    for (const ev of outcome.events) {
      const key = dedupKey(saunaSlug, ev.startDatum);
      if (existing.has(key) || seen.has(key)) {
        console.log(`  = dedup: ${ev.titel} (${ev.startDatum}) bestaat al.`);
        skipped++;
        teller.dedup++;
        continue;
      }

      const verdict = evaluateEvent(
        { saunaSlug, titel: ev.titel, type: ev.type, startDatum: ev.startDatum, beschrijving: ev.beschrijving },
        { saunaSlugs, today: TODAY },
      );

      // Mail-events publiceren NOOIT automatisch: een From-header is spoofbaar
      // (geen DKIM/DMARC-verificatie in deze laag), dus iedereen zou anders
      // onder de naam van een echte sauna events live kunnen zetten.
      const status: "concept" | "gepubliceerd" = "concept";

      // Zonder bron-match de afzender in de keurnotitie zetten voor handmatige review.
      const redenen = [...verdict.redenen];
      if (verdict.passed) {
        redenen.push("nieuwsbrief-event: afzender is niet technisch verifieerbaar (spoofing-risico) — handmatig beoordelen en publiceren");
      }
      if (viaInhoud) {
        redenen.push("sauna-toewijzing via inhoud van doorgestuurd bericht (facebook-veld/domein) — controleer of dit de juiste sauna is");
      }
      // Alleen het domein noteren, geen volledig e-mailadres in de repo.
      if (!bron) {
        redenen.unshift(
          vertrouwd
            ? "doorgestuurd bericht van vertrouwde afzender, maar geen eenduidige sauna in de inhoud gevonden — wijs handmatig toe"
            : `nieuwsbrief van onbekende afzender (@${mail.from.split("@")[1] ?? "?"}) — wijs handmatig een sauna toe`,
        );
      }

      const newEvent: NewEvent = {
        saunaSlug,
        titel: ev.titel,
        type: ev.type,
        startDatum: ev.startDatum,
        eindDatum: ev.eindDatum,
        tijden: ev.tijden,
        prijsIndicatie: ev.prijsIndicatie,
        ticketUrl: veiligeTicketUrl(ev.ticketUrl, bron?.website),
        beschrijving: ev.beschrijving,
        status,
        ...(redenen.length ? { keurNotitie: redenen.join("; ") } : {}),
      };

      const mdxPad = writeEventMdx(newEvent, DOEL_DIR);
      if (mdxPad) {
        seen.add(key);
        written++;
        // Mail kent geen verleden-tak: een verleden kandidaat wordt hier als concept + afgekeurd weggeschreven.
        teller.concept++; // mail publiceert nooit automatisch
        if (!verdict.passed) teller.afgekeurd++;
        metrics.event({
          slug: path.basename(mdxPad, ".mdx"),
          kanaal: "mail",
          bron: bron?.id ?? "onbekend",
          status,
          ...(redenen.length ? { reden: redenen.join("; ") } : {}),
        });
        console.log(
          `  + ${status}${redenen.length ? " (afgekeurd: " + redenen.join("; ") + ")" : ""} — ${ev.titel}`,
        );
      } else {
        skipped++;
        teller.dedup++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
    }
    metrics.bron("mail", teller);
    // Alleen na een geslaagde extractie als gelezen markeren. 0 events telt
    // daarbij als verwerkt (een mail zonder events is gewoon klaar), maar bij
    // method "none" faalde de extractie — extractEventsFromText vangt zo'n
    // fout af en gooit niet, dus zonder deze check zou een API-fout de mail
    // voorgoed onzichtbaar maken en de events definitief verloren laten gaan.
    if (outcome.method === "none") {
      console.log("  ⚠ extractie mislukt — mail blijft ongelezen voor de volgende run.");
    } else {
      verwerkteUids.push(mail.uid);
    }
    console.log("");
  }

  metrics.mail({
    mails: mails.length,
    onbekendeAfzenders: mails.filter((m) => !matchBronBySender(data.bronnen, m.from)).length,
  });

  if (!DRY_RUN && mailConfig && verwerkteUids.length) {
    try {
      await markMailSeen(mailConfig, verwerkteUids);
      console.log(`${verwerkteUids.length} mail(s) als gelezen gemarkeerd.`);
    } catch (err) {
      // Niet fataal: ongemarkeerde mails worden volgende run opnieuw verwerkt
      // en de dedup (saunaSlug + startDatum) vangt dubbelen op.
      console.warn(`Kon mails niet als gelezen markeren: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`Klaar. ${written} nieuw event(s), ${skipped} overgeslagen.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
