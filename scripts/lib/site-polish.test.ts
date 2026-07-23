import { test } from "node:test";
import assert from "node:assert/strict";
import { todayISOInTimeZone, weekendRange, addDaysISO } from "../../src/lib/dates";
import { parsePrijs } from "../../src/lib/schema";
import {
  activeFilterCount,
  filterEvents,
  parseFilters,
  validateDateRange,
} from "../../src/lib/filters";
import { eventSchema, eventItemListSchema } from "../../src/lib/schema";
import type { OpgietEvent } from "../../src/lib/content";

const event: OpgietEvent = {
  slug: "midzomernacht-opgieting",
  saunaSlug: "thermen-bussloo",
  titel: "Midzomernacht Löyly",
  type: "thema",
  startDatum: "2026-07-18",
  eindDatum: "2026-07-19",
  tijden: "19:00–23:00",
  prijsIndicatie: "Vanaf € 49,50",
  ticketUrl: "https://example.com/tickets",
  afbeelding: "/images/events/midzomernacht.jpg",
  status: "gepubliceerd",
  body: "Een bijzondere avond met opgietingen en livemuziek.",
  sauna: {
    slug: "thermen-bussloo",
    naam: "Thermen Bussloo",
    land: "NL",
    provincie: "Gelderland",
    plaats: "Voorst",
    adres: "Bloemenksweg 38",
    lat: 52.1908,
    lng: 6.1101,
    faciliteiten: ["Opgietsauna", "Zwembad"],
    website: "https://example.com",
    affiliateUrl: "https://example.com/reserveren",
    sponsored: false,
    afbeelding: "/images/saunas/thermen-bussloo.jpg",
    body: "Wellnessresort aan het Bussloo-meer.",
  },
};

test("Europe/Amsterdam bepaalt vandaag correct rond UTC-middernacht", () => {
  assert.equal(todayISOInTimeZone(new Date("2026-07-11T21:59:59Z")), "2026-07-11");
  assert.equal(todayISOInTimeZone(new Date("2026-07-11T22:00:00Z")), "2026-07-12");
});

test("parseFilters trimt q en negeert ongeldige datum- en typefilters", () => {
  assert.deepEqual(
    parseFilters({
      q: "  bussloo  ",
      van: "2026-02-30",
      tot: "11-07-2026",
      type: "brunch",
    }),
    {
      q: "bussloo",
      land: undefined,
      provincie: undefined,
      type: undefined,
      van: undefined,
      tot: undefined,
      toonAfgelopen: false,
    },
  );
});

test("parseFilters accepteert alleen eigen sleutels als eventtype", () => {
  assert.equal(parseFilters({ type: "toString" }).type, undefined);
  assert.equal(parseFilters({ type: "constructor" }).type, undefined);
});

test("parseFilters negeert ongeldige URL-filters en onbekende provincies", () => {
  const provinces = [
    { slug: "gelderland", land: "NL" as const },
    { slug: "antwerpen", land: "BE" as const },
  ];

  assert.deepEqual(
    parseFilters(
      {
        land: "XX",
        type: "constructor",
        van: "2026-02-30",
        tot: "12-07-2026",
        provincie: "onbekend",
      },
      provinces,
    ),
    {
      q: undefined,
      land: undefined,
      provincie: undefined,
      type: undefined,
      van: undefined,
      tot: undefined,
      toonAfgelopen: false,
    },
  );
  assert.equal(parseFilters({ land: "NL", provincie: "antwerpen" }, provinces).provincie, undefined);
  assert.equal(parseFilters({ land: "NL", provincie: "gelderland" }, provinces).provincie, "gelderland");
});

test("filterEvents zoekt hoofdletterongevoelig op titel, sauna en plaats", () => {
  for (const q of ["MIDZOMERNACHT", "thermen bussloo", "VOORST"]) {
    assert.deepEqual(filterEvents([event], { q, toonAfgelopen: true }), [event]);
  }
  assert.deepEqual(filterEvents([event], { q: "utrecht", toonAfgelopen: true }), []);
});

test("filterEvents zoekt genormaliseerd op provincie", () => {
  assert.deepEqual(filterEvents([event], { q: "GELDERLAND", toonAfgelopen: true }), [event]);
});

test("validateDateRange meldt een omgekeerd datumbereik exact", () => {
  assert.equal(validateDateRange("2026-07-20", "2026-07-19"), "De einddatum ligt vóór de begindatum.");
  assert.equal(validateDateRange("2026-07-19", "2026-07-20"), null);
  assert.deepEqual(filterEvents([event], { van: "2026-07-20", tot: "2026-07-19" }), []);
});

test("activeFilterCount telt de zoekopdracht mee", () => {
  assert.equal(activeFilterCount({ q: "bussloo", land: "NL" }), 2);
});

test("eventSchema koppelt organizer aan de sauna en offers aan de ticketUrl", () => {
  const schema = eventSchema(event) as Record<string, unknown>;
  assert.deepEqual(schema.organizer, {
    "@type": "Organization",
    name: "Thermen Bussloo",
    url: "https://opgietingen.nl/sauna/thermen-bussloo",
  });
  const offers = schema.offers as Record<string, unknown>;
  assert.equal(offers.url, "https://example.com/tickets");
  // "Vanaf € 49,50" bevat precies één bedrag → parsebaar
  assert.equal(offers.price, 49.5);
  assert.equal(offers.priceCurrency, "EUR");
});

test("eventSchema laat eventStatus en offers weg voor afgelopen events (V6)", () => {
  const schema = eventSchema(event, { afgelopen: true }) as Record<string, unknown>;
  assert.equal(schema.eventStatus, undefined);
  assert.equal(schema.offers, undefined);
  // De rest van de markup blijft intact
  assert.equal(schema.name, "Midzomernacht Löyly");
  assert.equal(schema.startDate, "2026-07-18");
});

test("eventItemListSchema geeft komende events een volledig Event-object (V3)", () => {
  const lijst = eventItemListSchema([event], "Test", "2026-07-01") as {
    itemListElement: Record<string, unknown>[];
  };
  const item = lijst.itemListElement[0].item as Record<string, unknown>;
  assert.equal(item["@type"], "Event");
  assert.equal(item.name, "Midzomernacht Löyly");
  assert.ok(item.location, "verwacht location in het volledige Event-object");

  // Afgelopen event (referentie ná de einddatum) → alleen url/naam
  const archief = eventItemListSchema([event], "Test", "2026-08-01") as {
    itemListElement: Record<string, unknown>[];
  };
  assert.equal(archief.itemListElement[0].item, undefined);
  assert.equal(archief.itemListElement[0].name, "Midzomernacht Löyly");

  // Zonder referentie: het oude, kale gedrag
  const kaal = eventItemListSchema([event], "Test") as { itemListElement: Record<string, unknown>[] };
  assert.equal(kaal.itemListElement[0].item, undefined);
});

test("parsePrijs parseert alleen ondubbelzinnige bedragen", () => {
  assert.equal(parsePrijs("Vanaf € 49,50"), 49.5);
  assert.equal(parsePrijs("€ 25"), 25);
  assert.equal(parsePrijs("€ 25 - € 40"), undefined); // twee bedragen: niet gokken
  assert.equal(parsePrijs("Inbegrepen bij entree"), undefined);
  assert.equal(parsePrijs(undefined), undefined);
});

test("weekendRange pakt het eerstvolgende weekend (vr t/m zo)", () => {
  // 2026-07-15 is een woensdag → vr 17 t/m zo 19
  assert.deepEqual(weekendRange("2026-07-15"), { van: "2026-07-17", tot: "2026-07-19" });
  // vrijdag: vandaag t/m zondag
  assert.deepEqual(weekendRange("2026-07-17"), { van: "2026-07-17", tot: "2026-07-19" });
  // zaterdag: vandaag t/m zondag
  assert.deepEqual(weekendRange("2026-07-18"), { van: "2026-07-18", tot: "2026-07-19" });
  // zondag: alleen vandaag nog
  assert.deepEqual(weekendRange("2026-07-19"), { van: "2026-07-19", tot: "2026-07-19" });
});

test("addDaysISO telt over maandgrenzen heen", () => {
  assert.equal(addDaysISO("2026-07-30", 3), "2026-08-02");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
});
