import { test } from "node:test";
import assert from "node:assert/strict";
import { eventsFromMessage, sanitizeEvents } from "../../src/lib/scraper";
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
