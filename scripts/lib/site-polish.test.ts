import { test } from "node:test";
import assert from "node:assert/strict";
import { todayISOInTimeZone } from "../../src/lib/dates";
import {
  activeFilterCount,
  filterEvents,
  parseFilters,
  validateDateRange,
} from "../../src/lib/filters";
import { eventSchema } from "../../src/lib/schema";
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

test("eventSchema bevat geen organizer of offers", () => {
  const schema = eventSchema(event);
  assert.equal("organizer" in schema, false);
  assert.equal("offers" in schema, false);
});
