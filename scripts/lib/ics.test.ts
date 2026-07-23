import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendar } from "../../src/lib/ics";
import type { OpgietEvent } from "../../src/lib/content";

const event: OpgietEvent = {
  slug: "midzomernacht-opgieting",
  saunaSlug: "thermen-bussloo",
  titel: "Midzomernacht Löyly; met vuur, komma's",
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
    faciliteiten: ["Opgietsauna"],
    affiliateUrl: "https://example.com",
    sponsored: false,
    body: "",
  },
};

test("buildCalendar maakt een geldige hele-dag-VEVENT met exclusieve DTEND", () => {
  const ics = buildCalendar([event], "Testagenda");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.ok(ics.includes("UID:midzomernacht-opgieting@opgietingen.nl"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260718"));
  // eindDatum 19 juli → DTEND (exclusief) 20 juli
  assert.ok(ics.includes("DTEND;VALUE=DATE:20260720"));
  assert.ok(ics.includes("URL:https://opgietingen.nl/event/midzomernacht-opgieting"));
});

test("buildCalendar escapet puntkomma's en komma's in tekstvelden", () => {
  const ics = buildCalendar([event], "Testagenda");
  assert.ok(ics.includes("Midzomernacht Löyly\\; met vuur\\, komma's"));
  // LOCATION bevat sauna, adres en plaats met ge-escapete komma's
  assert.ok(ics.includes("LOCATION:Thermen Bussloo\\, Bloemenksweg 38\\, Voorst"));
});

test("buildCalendar vouwt lange regels binnen de 75-octetgrens", () => {
  const lang: OpgietEvent = {
    ...event,
    body: "Een heel lange beschrijving. ".repeat(20),
  };
  const ics = buildCalendar([lang], "Testagenda");
  for (const regel of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(regel, "utf-8") <= 76, `regel te lang: ${regel.length} tekens`);
  }
});

test("buildCalendar zonder eindDatum eindigt de dag na de startdatum", () => {
  const eendaags = { ...event, eindDatum: undefined };
  const ics = buildCalendar([eendaags], "Testagenda");
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260718"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20260719"));
});
