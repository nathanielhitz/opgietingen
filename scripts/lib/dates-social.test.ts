// scripts/lib/dates-social.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoWeek,
  weekendVanIsoWeek,
  volgendeWeekdag,
  eersteVanMaandIn,
  formatDagKort,
  isGeldigeIsoDatum,
  nlTijdNaarUtc,
  maandagVanWeek,
} from "../../src/lib/dates";

test("isoWeek: vrijdag 11 september 2026 valt in 2026-W37", () => {
  assert.equal(isoWeek("2026-09-11"), "2026-W37");
  assert.equal(isoWeek("2026-09-14"), "2026-W38"); // maandag erna
});

test("isoWeek: jaargrens volgt ISO 8601 (2026 heeft 53 weken)", () => {
  assert.equal(isoWeek("2026-01-01"), "2026-W01");
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
  assert.equal(isoWeek("2027-01-04"), "2027-W01");
  assert.equal(isoWeek("2024-12-30"), "2025-W01");
  assert.equal(isoWeek("2023-01-01"), "2022-W52");
});

test("weekendVanIsoWeek: vrijdag t/m zondag van de week", () => {
  assert.deepEqual(weekendVanIsoWeek("2026-W37"), { van: "2026-09-11", tot: "2026-09-13" });
  assert.deepEqual(weekendVanIsoWeek("2026-W53"), { van: "2027-01-01", tot: "2027-01-03" });
});

test("weekendVanIsoWeek: ongeldige of niet-bestaande week geeft null", () => {
  assert.equal(weekendVanIsoWeek("2026-37"), null);
  assert.equal(weekendVanIsoWeek("2026-W54"), null);
  assert.equal(weekendVanIsoWeek("2025-W53"), null); // 2025 heeft 52 weken
});

test("volgendeWeekdag: eerstvolgende, of de dag zelf", () => {
  assert.equal(volgendeWeekdag("2026-09-11", 3), "2026-09-16"); // vr -> wo
  assert.equal(volgendeWeekdag("2026-09-11", 1), "2026-09-14"); // vr -> ma
  assert.equal(volgendeWeekdag("2026-09-14", 1), "2026-09-14"); // ma -> ma
});

test("eersteVanMaandIn: maandstart binnen het venster", () => {
  assert.equal(eersteVanMaandIn("2026-09-25", 6), "2026-10-01");
  assert.equal(eersteVanMaandIn("2026-10-01", 6), "2026-10-01");
  assert.equal(eersteVanMaandIn("2026-09-11", 6), undefined);
});

test("formatDagKort: weekdag, dag en maand zonder jaar of punten", () => {
  assert.equal(formatDagKort("2026-09-11"), "vr 11 sep");
  assert.equal(formatDagKort("2026-11-01"), "zo 1 nov");
});

test("isGeldigeIsoDatum: vorm én kalender", () => {
  assert.equal(isGeldigeIsoDatum("2026-09-11"), true);
  assert.equal(isGeldigeIsoDatum("2026-13-01"), false);
  assert.equal(isGeldigeIsoDatum("2026-02-30"), false);
  assert.equal(isGeldigeIsoDatum("11-09-2026"), false);
  assert.equal(isGeldigeIsoDatum("2028-02-29"), true);
  assert.equal(isGeldigeIsoDatum("2027-02-29"), false);
});

test("nlTijdNaarUtc: zomertijd (CEST, +02:00)", () => {
  assert.equal(nlTijdNaarUtc("2026-10-02", "12:00"), "2026-10-02T10:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2026-09-28", "17:00"), "2026-09-28T15:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2026-10-02", "09:45"), "2026-10-02T07:45:00.000Z");
});

test("nlTijdNaarUtc: wintertijd (CET, +01:00), ook over de jaargrens", () => {
  assert.equal(nlTijdNaarUtc("2026-11-02", "17:00"), "2026-11-02T16:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2026-12-31", "10:00"), "2026-12-31T09:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2027-01-01", "10:00"), "2027-01-01T09:00:00.000Z");
});

test("nlTijdNaarUtc: wisseldagen", () => {
  assert.equal(nlTijdNaarUtc("2026-10-25", "12:00"), "2026-10-25T11:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2027-03-28", "12:00"), "2027-03-28T10:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2026-10-25", "01:30"), "2026-10-24T23:30:00.000Z"); // nog CEST
  assert.equal(nlTijdNaarUtc("2027-03-28", "01:30"), "2027-03-28T00:30:00.000Z"); // nog CET
});

test("nlTijdNaarUtc: ongeldige datum of tijd gooit", () => {
  assert.throws(() => nlTijdNaarUtc("2026-13-01", "12:00"), /Ongeldige datum\/tijd/);
  assert.throws(() => nlTijdNaarUtc("2026-10-02", "12.00"), /Ongeldige datum\/tijd/);
  assert.throws(() => nlTijdNaarUtc("2026-10-02", "25:00"), /Ongeldige datum\/tijd/);
  assert.throws(() => nlTijdNaarUtc("2026-10-02", "24:00"), /Ongeldige datum\/tijd/);
});

test("maandagVanWeek: maandag van de ISO-week, of de dag zelf op maandag", () => {
  assert.equal(maandagVanWeek("2026-09-21"), "2026-09-21"); // ma
  assert.equal(maandagVanWeek("2026-09-23"), "2026-09-21"); // wo
  assert.equal(maandagVanWeek("2026-09-27"), "2026-09-21"); // zo hoort bij de week ervoor
  assert.equal(maandagVanWeek("2027-01-01"), "2026-12-28"); // vr, over de jaargrens (2026-W53)
});
