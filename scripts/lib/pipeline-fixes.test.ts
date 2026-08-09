import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  AGENDA_SIGNAAL,
  eventsFromMessage,
  plainFetchText,
  sanitizeEvents,
  scrapeAgenda,
} from "../../src/lib/scraper";
import { htmlToText } from "../../src/lib/html";
import {
  escapeMdxText,
  eventSlug,
  externeTicketHost,
  matchBronBySender,
  normalizeProseDashes,
  type Bron,
  type NewEvent,
} from "./content";
import { OPGIET_RE } from "./quality-gate";

/* ---------- sanitizeEvents (extractie-output hardening) ---------- */

function rawEvent(overrides: Record<string, unknown> = {}) {
  return {
    titel: "Aufguss-avond",
    type: "thema",
    startDatum: "2027-02-14",
    beschrijving: "Opgieting met muziek.",
    ...overrides,
  };
}

test("sanitizeEvents dropt een relatieve of niet-http ticketUrl", () => {
  const [rel] = sanitizeEvents({ events: [rawEvent({ ticketUrl: "/tickets/aufguss" })] });
  assert.equal(rel.ticketUrl, undefined);
  const [js] = sanitizeEvents({ events: [rawEvent({ ticketUrl: "javascript:alert(1)" })] });
  assert.equal(js.ticketUrl, undefined);
  const [ok] = sanitizeEvents({ events: [rawEvent({ ticketUrl: "https://sauna.nl/tickets" })] });
  assert.equal(ok.ticketUrl, "https://sauna.nl/tickets");
});

test("sanitizeEvents dropt een einddatum vóór de startdatum", () => {
  const [ev] = sanitizeEvents({ events: [rawEvent({ eindDatum: "2027-02-01" })] });
  assert.equal(ev.eindDatum, undefined);
  const [ok] = sanitizeEvents({ events: [rawEvent({ eindDatum: "2027-02-16" })] });
  assert.equal(ok.eindDatum, "2027-02-16");
});

test("sanitizeEvents overleeft rommel-input", () => {
  assert.deepEqual(sanitizeEvents(null), []);
  assert.deepEqual(sanitizeEvents({ events: "geen array" }), []);
  assert.deepEqual(sanitizeEvents({ events: [rawEvent({ type: "feestje" })] }), []);
  const [ev] = sanitizeEvents({ events: [rawEvent({ beschrijving: "  " })] });
  assert.equal(ev.beschrijving, "Aufguss-avond"); // valt terug op titel
});

/* ---------- MDX-veiligheid van het schrijfpunt ---------- */

test("escapeMdxText neutraliseert MDX-syntax in gescrapete tekst", () => {
  assert.equal(
    escapeMdxText("Toegang voor kinderen <12 jaar; prijs {21*2} euro"),
    "Toegang voor kinderen \\<12 jaar; prijs \\{21*2\\} euro",
  );
  assert.equal(escapeMdxText("pad C:\\sauna"), "pad C:\\\\sauna");
  assert.equal(escapeMdxText("gewone tekst blijft gewoon"), "gewone tekst blijft gewoon");
});

test("normalizeProseDashes verminkt een em-dash-opsomming niet meer", () => {
  assert.equal(
    normalizeProseDashes("Programma:\n— 19:00 welkom\n— 20:00 Aufguss vuur"),
    "Programma:\n- 19:00 welkom\n- 20:00 Aufguss vuur",
  );
});

/* ---------- eventSlug (bestandsnaam-botsingen) ---------- */

function nieuwEvent(saunaSlug: string, titel: string): NewEvent {
  return { saunaSlug, titel, type: "regulier", startDatum: "2027-03-01", beschrijving: "x", status: "concept" };
}

test("eventSlug bevat de saunaSlug zodat twee sauna's niet botsen", () => {
  const a = eventSlug(nieuwEvent("vitae-goes", "Opgietweekend"));
  const b = eventSlug(nieuwEvent("vitae-roosendaal", "Opgietweekend"));
  assert.notEqual(a, b);
  assert.equal(a, "vitae-goes-opgietweekend-2027-03-01");
});

test("eventSlug herhaalt de saunanaam niet en vangt lege titels op", () => {
  assert.equal(
    eventSlug(nieuwEvent("vitae-goes", "Vitae Goes Opgietdag")),
    "vitae-goes-opgietdag-2027-03-01",
  );
  assert.equal(eventSlug(nieuwEvent("spa-x", "🔥🔥🔥")), "spa-x-event-2027-03-01");
});

/* ---------- afzender-matching (nieuwsbrief-kanaal) ---------- */

const BRONNEN: Bron[] = [
  { id: "thermen-bussloo", naam: "Bussloo", land: "NL", website: "https://www.thermenbussloo.nl", agendaUrl: "https://www.thermenbussloo.nl/agenda", status: "actief" },
  { id: "lago-brugge", naam: "LAGO Brugge", land: "BE", website: "https://www.lago.be/nl/brugge", agendaUrl: "https://www.lago.be/x", matchToken: "brugge", status: "actief" },
  { id: "lago", naam: "LAGO Lier", land: "BE", website: "https://www.lago.be/nl/lier", agendaUrl: "https://www.lago.be/y", status: "actief" },
  { id: "thermae-boetfort", naam: "Boetfort", land: "BE", website: "https://www.thermae.com/nl/thermae-boetfort", agendaUrl: "https://www.thermae.com/a", matchToken: "boetfort", status: "actief" },
  { id: "thermae-grimbergen", naam: "Grimbergen", land: "BE", website: "https://www.thermae.com/nl/thermae-grimbergen", agendaUrl: "https://www.thermae.com/b", matchToken: "grimbergen", status: "actief" },
  { id: "fb-groep", naam: "FB", land: "NL/BE", website: "https://www.facebook.com", agendaUrl: "", status: "handmatig" },
];

test("matchBronBySender matcht op het websitedomein", () => {
  assert.equal(matchBronBySender(BRONNEN, "agenda@thermenbussloo.nl")?.id, "thermen-bussloo");
  assert.equal(matchBronBySender(BRONNEN, "nieuws@mail.thermenbussloo.nl")?.id, "thermen-bussloo");
});

test("matchBronBySender laat URL-discovery-tokens geen mail claimen", () => {
  // "brugge" is een matchToken voor URL-discovery, geen maildomein.
  assert.equal(matchBronBySender(BRONNEN, "toerisme@brugge.be"), undefined);
});

test("matchBronBySender weigert ambigue keten-domeinen en platform-hosts", () => {
  assert.equal(matchBronBySender(BRONNEN, "info@thermae.com"), undefined); // 2 vestigingen
  assert.equal(matchBronBySender(BRONNEN, "nieuwsbrief@lago.be"), undefined); // 2 vestigingen
  assert.equal(matchBronBySender(BRONNEN, "notificatie@facebook.com"), undefined);
});

test("matchBronBySender accepteert een expliciete @-token wel", () => {
  const metToken: Bron[] = [
    { id: "x", naam: "X", land: "NL", website: "", agendaUrl: "", matchToken: "@nieuwsbrief-x.nl", status: "actief" },
  ];
  assert.equal(matchBronBySender(metToken, "info@nieuwsbrief-x.nl")?.id, "x");
});

/* ---------- poort-trefwoorden ---------- */

test("OPGIET_RE herkent Vlaamse/Baltische ritueel-termen met woordgrenzen", () => {
  assert.ok(OPGIET_RE.test("Infusion Xperience in de opgiettempel"));
  assert.ok(OPGIET_RE.test("Banja-ritueel met berkentakken"));
  assert.ok(OPGIET_RE.test("Pirts beleving"));
  assert.ok(!OPGIET_RE.test("Confusione bij de brunch")); // geen substring-match
  assert.ok(!OPGIET_RE.test("Moederdagbrunch met bubbels"));
});

/* ---------- mdxExcerpt (hovercard-samenvatting) ---------- */

test("mdxExcerpt stript markdown en kapt af op een woordgrens", async () => {
  const { mdxExcerpt } = await import("../../src/lib/content");
  assert.equal(
    mdxExcerpt("## Kop\n\nEen **stevige** opgieting met [muziek](https://x.nl) en meer."),
    "Een stevige opgieting met muziek en meer.",
  );
  const lang = mdxExcerpt(`Woord ${"heelerglang ".repeat(30)}einde`, 80);
  assert.ok(lang.length <= 81 && lang.endsWith("…"));
  // Ge-escapete MDX-syntax uit de scraper (\< en \{) wordt weer leesbare tekst.
  assert.equal(mdxExcerpt("Toegang \\<12 jaar en \\{gratis\\} entree."), "Toegang <12 jaar en {gratis} entree.");
});

/* ---------- plainFetchText (kale fetch-route: grootte, type, redirects) ---------- */

/** Start een wegwerp-HTTP-server en geeft de basis-URL terug. */
async function startServer(handler: http.RequestListener): Promise<{ base: string; stop: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("plainFetchText houdt multi-byte tekens heel over chunkgrenzen", async () => {
  // Byte voor byte geschreven, zodat elk accent en elke emoji gegarandeerd
  // over een chunkgrens valt — precies waar een verkeerd gebruikte
  // TextDecoder replacement-tekens zou opleveren.
  const zin = "<p>Opgieting — 14 februari — café ☕ bij 90°C</p>";
  const { base, stop } = await startServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    for (const byte of Buffer.from(zin)) res.write(Buffer.from([byte]));
    res.end();
  });
  try {
    const res = await plainFetchText(base);
    assert.ok(res.ok, "verwacht een geslaagde fetch");
    const tekst = res.tekst;
    assert.ok(tekst.includes("—") && tekst.includes("café") && tekst.includes("☕") && tekst.includes("90°C"));
    assert.ok(!tekst.includes("�"), "geen replacement-tekens");
  } finally {
    await stop();
  }
});

test("plainFetchText kapt een enorme respons af in plaats van alles te bufferen", async () => {
  // htmlToText topt de tékst sowieso af, dus dat zegt niets over het bufferen.
  // Wat de leeslimiet wél aantoonbaar verandert: de client stopt met lezen,
  // waardoor de server zijn 40 MB nooit kwijt kan. Zonder limiet zou alles
  // over de lijn komen en pas daarna worden weggegooid.
  let verzonden = 0;
  const { base, stop } = await startServer(async (_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.write("<p>Opgieting 14 februari 2027. ");
    const blok = "x".repeat(100_000);
    for (let i = 0; i < 400; i++) {
      if (res.writableEnded || res.destroyed) break;
      const ruimte = res.write(blok);
      verzonden += blok.length;
      // Wachten op drain: anders buffert Node alles in het geheugen en meten
      // we niets over wat de client daadwerkelijk heeft opgehaald.
      if (!ruimte) await new Promise<void>((r) => res.once("drain", r));
    }
    if (!res.destroyed) res.end("</p>");
  });
  try {
    const res = await plainFetchText(base);
    assert.ok(res.ok, "verwacht een geslaagde fetch");
    assert.ok(res.tekst.startsWith("Opgieting 14 februari"));
    assert.ok(res.tekst.length <= 60_050, `onverwacht lang: ${res.tekst.length}`);
    // Ruim onder de 40 MB die de server wilde sturen: de lezer is gestopt.
    // Gemeten: ~5,6 MB van de 40 MB die de server wilde sturen. Zonder de
    // leeslimiet zou alles binnenkomen en pas daarna worden weggegooid.
    assert.ok(verzonden < 15_000_000, `te veel opgehaald: ${verzonden} bytes`);
  } finally {
    await stop();
  }
});

test("plainFetchText weigert een niet-tekstueel content-type maar tolereert een ontbrekend type", async () => {
  const { base, stop } = await startServer((req, res) => {
    if (req.url === "/pdf") {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.end("%PDF-1.4 " + "x".repeat(2000));
      return;
    }
    // Geen content-type: niet elke server stuurt er een; dat mag geen reden
    // zijn om een werkende bron over te slaan.
    res.writeHead(200);
    res.end("<p>Opgieting op 14 februari 2027 om 20:00 uur.</p>".repeat(30));
  });
  try {
    const pdf = await plainFetchText(`${base}/pdf`);
    assert.equal(pdf.ok, false);
    assert.equal(pdf.ok === false && pdf.reden, "type");
    assert.ok((await plainFetchText(`${base}/kaal`)).ok);
  } finally {
    await stop();
  }
});

test("plainFetchText toetst het doel van een redirect opnieuw aan robots", async () => {
  const { base, stop } = await startServer((req, res) => {
    if (req.url === "/agenda") {
      res.writeHead(302, { location: "/verboden" });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<p>Opgieting op 14 februari 2027 om 20:00 uur.</p>".repeat(30));
  });
  try {
    const geweigerd = async (u: string) => !u.includes("/verboden");
    const geblokt = await plainFetchText(`${base}/agenda`, geweigerd);
    assert.equal(geblokt.ok, false);
    // "robots" en niet "fout": scrapeAgenda mag hierna niet naar Firecrawl
    // doorschakelen, want die zou dezelfde redirect alsnog volgen.
    assert.equal(geblokt.ok === false && geblokt.reden, "robots");
    // Zonder callback (of met een toestaande) komt de inhoud gewoon door.
    assert.ok((await plainFetchText(`${base}/agenda`)).ok);
    assert.ok((await plainFetchText(`${base}/agenda`, async () => true)).ok);
  } finally {
    await stop();
  }
});

test("scrapeAgenda stopt bij een robots-blokkade en gaat niet door naar Firecrawl", async () => {
  // Doorschakelen zou dezelfde URL via Firecrawl ophalen en dus dezelfde
  // redirect volgen — dan is de robots-beslissing genomen door de route die
  // niet draait. De test draait zonder API-keys: als de code tóch doorging,
  // zou hij op de ontbrekende FIRECRAWL_API_KEY stuklopen in plaats van
  // netjes met een robots-warning terug te keren.
  const { base, stop } = await startServer((req, res) => {
    if (req.url === "/agenda") {
      res.writeHead(302, { location: "/verboden" });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<p>Opgieting op 14 februari 2027 om 20:00 uur.</p>".repeat(30));
  });
  try {
    const out = await scrapeAgenda(
      `${base}/agenda`,
      { saunaNaam: "Test", land: "NL", vandaag: "2026-08-09" },
      async (u) => !u.includes("/verboden"),
    );
    assert.equal(out.events.length, 0);
    assert.equal(out.method, "none");
    assert.equal(out.markdown, "");
    assert.ok(
      out.warnings.some((w) => w.includes("robots.txt")),
      `verwacht een robots-warning, kreeg: ${JSON.stringify(out.warnings)}`,
    );
  } finally {
    await stop();
  }
});

/* ---------- AGENDA_SIGNAAL (wanneer vertrouwen we 0 events van de kale route?) ---------- */

test("AGENDA_SIGNAAL herkent Nederlandse én Franse agenda-inhoud", () => {
  assert.ok(AGENDA_SIGNAAL.test("Opgietavond op 14 februari, aanvang 20:00"));
  assert.ok(AGENDA_SIGNAAL.test("Aufguss-programma"));
  assert.ok(AGENDA_SIGNAAL.test("Séance le 14 février à 20h"));
  assert.ok(AGENDA_SIGNAAL.test("Programme du 3 août"));
  assert.ok(AGENDA_SIGNAAL.test("Infusion aux agrumes"));
  assert.ok(AGENDA_SIGNAAL.test("Data: 05-10-2027"));
});

test("AGENDA_SIGNAAL respecteert woordgrenzen bij korte maandnamen", () => {
  // Zonder \b matcht "mai" in "mail" en "mars" in "Marsepein" — dan zou de
  // footer van vrijwel elke sauna-site als agenda-signaal gelden. Deze
  // assertions falen bij een implementatie waaruit de woordgrenzen wegvallen.
  assert.ok(!AGENDA_SIGNAAL.test("Stuur een mail naar info@sauna.nl of bel ons."));
  assert.ok(!AGENDA_SIGNAAL.test("Onze marsepeinen lekkernij bij de thee."));
  assert.ok(!AGENDA_SIGNAAL.test("Bekijk het domein en de meiden van de receptie."));
  // De echte korte maandnamen matchen wel.
  assert.ok(AGENDA_SIGNAAL.test("Opgieting in mei"));
  assert.ok(AGENDA_SIGNAAL.test("Séance en mars"));
  assert.ok(AGENDA_SIGNAAL.test("Séance en juin"));
});

test("AGENDA_SIGNAAL herkent ook accentloos gespelde Franse maanden", () => {
  // Veel sites schrijven zonder accenten; de regex dekt beide vormen.
  assert.ok(AGENDA_SIGNAAL.test("Le 3 fevrier"));
  assert.ok(AGENDA_SIGNAAL.test("Le 5 aout"));
  assert.ok(AGENDA_SIGNAAL.test("Le 1 decembre"));
});

test("AGENDA_SIGNAAL vuurt niet op kale openingstijden in een footer", () => {
  // Dit is precies het geval waarvoor de check bestaat: nav + footer halen de
  // tekendrempel terwijl de agenda zelf JS-gerenderd is. Een tijd alleen mag
  // die boilerplate niet als "echte agenda" laten doorgaan.
  assert.ok(!AGENDA_SIGNAAL.test("Openingstijden: ma t/m zo 10:00 - 23:00. Contact: 010-1234567"));
  assert.ok(!AGENDA_SIGNAAL.test("Welkom bij onze sauna. Wellness, massages en meer."));
});

/* ---------- sanitizeEvents: hardening tegen rommelige extractie-output ---------- */

test("sanitizeEvents slaat null-items over zonder de geldige events te verliezen", () => {
  const events = sanitizeEvents({ events: [null, "kapot", 42, rawEvent()] });
  assert.equal(events.length, 1);
  assert.equal(events[0].titel, "Aufguss-avond");
});

test("sanitizeEvents weigert datums die het formaat halen maar niet bestaan", () => {
  assert.equal(sanitizeEvents({ events: [rawEvent({ startDatum: "2027-11-31" })] }).length, 0);
  assert.equal(sanitizeEvents({ events: [rawEvent({ startDatum: "2027-13-05" })] }).length, 0);
  // Een niet-bestaande einddatum wordt gedropt, het event zelf blijft.
  const [ev] = sanitizeEvents({ events: [rawEvent({ eindDatum: "2027-02-30" })] });
  assert.equal(ev.eindDatum, undefined);
  // Schrikkeljaar blijft gewoon geldig.
  assert.equal(sanitizeEvents({ events: [rawEvent({ startDatum: "2028-02-29" })] }).length, 1);
});

test("sanitizeEvents haalt links uit de beschrijving maar houdt de tekst leesbaar", () => {
  const [md] = sanitizeEvents({
    events: [rawEvent({ beschrijving: "Reserveer via [deze pagina](https://phish.example/x) vooraf." })],
  });
  assert.equal(md.beschrijving, "Reserveer via deze pagina vooraf.");
  // assert.equal en niet "bevat geen http": een implementatie die alléén kale
  // URL's weghaalt laat `![banner]()` staan, wat geldige MDX-afbeeldings-
  // syntax blijft en op de pagina een gebroken <img> oplevert.
  const [img] = sanitizeEvents({
    events: [rawEvent({ beschrijving: "Sfeerbeeld ![banner](https://x.example/b.png) van de sauna." })],
  });
  assert.equal(img.beschrijving, "Sfeerbeeld banner van de sauna.");
  const [kaal] = sanitizeEvents({
    events: [rawEvent({ beschrijving: "Meer info op https://sauna.example/agenda ." })],
  });
  assert.equal(kaal.beschrijving, "Meer info op.");
  // Een URL tussen haakjes laat geen leeg "()" achter.
  const [haakjes] = sanitizeEvents({
    events: [rawEvent({ beschrijving: "Kaarten via de webshop (https://sauna.example/shop) verkrijgbaar." })],
  });
  assert.equal(haakjes.beschrijving, "Kaarten via de webshop verkrijgbaar.");
  // Blijft er geen tekst over, dan valt de beschrijving terug op de titel.
  const [leeg] = sanitizeEvents({ events: [rawEvent({ beschrijving: "https://sauna.example" })] });
  assert.equal(leeg.beschrijving, "Aufguss-avond");
  const [alleenHaakjes] = sanitizeEvents({ events: [rawEvent({ beschrijving: "(https://sauna.example)" })] });
  assert.equal(alleenHaakjes.beschrijving, "Aufguss-avond");
});

/* ---------- externeTicketHost (auto-publicatie van vreemde redirects) ---------- */

test("externeTicketHost laat het eigen domein en subdomeinen door", () => {
  const bron = "https://www.sauna-de-proef.nl/agenda";
  assert.equal(externeTicketHost("https://sauna-de-proef.nl/tickets", bron), undefined);
  assert.equal(externeTicketHost("https://www.sauna-de-proef.nl/tickets", bron), undefined);
  assert.equal(externeTicketHost("https://tickets.sauna-de-proef.nl/aufguss", bron), undefined);
  // Geen eigen ticket-URL: de aanroeper valt terug op de agenda-URL.
  assert.equal(externeTicketHost(undefined, bron), undefined);
  assert.equal(externeTicketHost("/tickets/aufguss", bron), undefined);
});

test("externeTicketHost meldt een vreemd domein, ook bij een lookalike", () => {
  const bron = "https://sauna-de-proef.nl/agenda";
  assert.equal(externeTicketHost("https://www.eventbrite.nl/e/123", bron), "eventbrite.nl");
  // Domeingrens: het achtervoegsel matcht wel, maar de host is een ander domein.
  assert.equal(
    externeTicketHost("https://sauna-de-proef.nl.phish.example/tickets", bron),
    "sauna-de-proef.nl.phish.example",
  );
  assert.equal(externeTicketHost("https://notsauna-de-proef.nl/tickets", bron), "notsauna-de-proef.nl");
});

test("externeTicketHost is conservatief als de bron-host onbekend is", () => {
  // Niet kunnen vergelijken telt als extern: liever een handmatige check te
  // veel dan een verkeerde redirect automatisch live.
  assert.equal(externeTicketHost("https://ticketshop.example/e/1", undefined), "ticketshop.example");
  assert.equal(externeTicketHost("https://ticketshop.example/e/1", "geen-url"), "ticketshop.example");
});

/* ---------- eventsFromMessage (mislukte extractie ≠ lege agenda) ---------- */

function toolMessage(input: unknown, stop_reason = "tool_use") {
  return {
    stop_reason,
    content: [{ type: "tool_use" as const, id: "toolu_1", name: "record_events", input }],
  } as Parameters<typeof eventsFromMessage>[0];
}

test("eventsFromMessage leest de events uit een geslaagde tool-aanroep", () => {
  const events = eventsFromMessage(toolMessage({ events: [rawEvent()] }));
  assert.equal(events.length, 1);
  assert.equal(events[0].titel, "Aufguss-avond");
  // Een lege agenda is een geldig resultaat, geen fout.
  assert.deepEqual(eventsFromMessage(toolMessage({ events: [] })), []);
});

test("eventsFromMessage gooit bij een weigering in plaats van stil 0 events", () => {
  // Bij stop_reason "refusal" ontbreekt het tool_use-blok ondanks de
  // geforceerde tool_choice; stil [] zou niet te onderscheiden zijn van een
  // lege agenda en de bron elke run geruisloos zijn events kosten.
  const geweigerd = { stop_reason: "refusal", content: [] } as Parameters<typeof eventsFromMessage>[0];
  assert.throws(() => eventsFromMessage(geweigerd), /refusal/);
});

test("eventsFromMessage gooit bij een antwoord zonder tool-aanroep", () => {
  const alleenTekst = {
    stop_reason: "end_turn",
    content: [{ type: "text" as const, text: "Ik kan geen events vinden.", citations: null }],
  } as Parameters<typeof eventsFromMessage>[0];
  assert.throws(() => eventsFromMessage(alleenTekst), /geen tool_use-blok/);
});

test("eventsFromMessage gooit bij een afgekapt antwoord", () => {
  assert.throws(
    () => eventsFromMessage(toolMessage({ events: [rawEvent()] }, "max_tokens")),
    /afgekapt/,
  );
});

test("eventsFromMessage vertrouwt geen tool-input bij een onverwachte stopreden", () => {
  // Streaming bouwt tool_use.input incrementeel op, dus een aanwezig blok bij
  // een vroegtijdig einde kan half geparseerd zijn — niet stil doorlaten.
  assert.throws(
    () => eventsFromMessage(toolMessage({ events: [rawEvent()] }, "pause_turn")),
    /onvolledig afgesloten/,
  );
  // Een normaal afgesloten antwoord blijft gewoon werken.
  assert.equal(eventsFromMessage(toolMessage({ events: [rawEvent()] }, "end_turn")).length, 1);
});

/* ---------- htmlToText entity-decodering ---------- */

test("htmlToText decodeert betekenisdragende entities", () => {
  assert.equal(htmlToText("<p>kinderen &lt;12 jaar gratis</p>"), "kinderen <12 jaar gratis");
  assert.equal(htmlToText("<p>Sauna&rsquo;s &#8364;25 bij 90&deg;C</p>"), "Sauna's €25 bij 90°C");
});
