import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventMetaTitle,
  eventMetaDescription,
  formatDateCompact,
  MAX_TITLE,
  MAX_DESCRIPTION,
  MIN_DESCRIPTION,
} from "../../src/lib/event-meta";

const natupop = {
  titel: "Natupop Festival en Saunameesters in concert",
  startDatum: "2026-07-24",
  eindDatum: "2026-07-26",
  sauna: { naam: "Sauna Flevo Natuur", plaats: "Zeewolde" },
};

const kort = {
  titel: "Natupop Festival 2026",
  startDatum: "2026-07-24",
  sauna: { naam: "Flevo Natuur", plaats: "Zeewolde" },
};

test("formatDateCompact", () => {
  assert.equal(formatDateCompact("2026-07-24"), "24 juli 2026");
  assert.equal(formatDateCompact("2026-07-24", "2026-07-26"), "24–26 juli 2026");
  assert.equal(formatDateCompact("2026-07-24", "2026-07-26", false), "24–26 juli");
  assert.equal(formatDateCompact("2026-10-31", "2026-11-02"), "31 oktober – 2 november 2026");
});

test("titel bevat event, datum en locatie en blijft kort waar mogelijk", () => {
  const t = eventMetaTitle({ ...kort, afgelopen: false });
  assert.equal(t, "Natupop Festival 2026 · 24 juli 2026 · Flevo Natuur Zeewolde");
  assert.ok(t.length <= MAX_TITLE, t);
});

test("titel kort in stappen in bij een lange eventnaam", () => {
  const t = eventMetaTitle({ ...natupop, afgelopen: false });
  assert.ok(t.startsWith(natupop.titel), t);
  assert.ok(t.includes("juli"), t);
  // Lange eventnaam: locatie valt weg, maar datum mét jaar blijft (zoekterm "natupop 2026").
  assert.equal(t, "Natupop Festival en Saunameesters in concert · 24–26 juli 2026");
});

test("plaats wordt niet herhaald als die al in de saunanaam zit", () => {
  const t = eventMetaTitle({
    titel: "Opgietweekend",
    startDatum: "2026-11-14",
    eindDatum: "2026-11-15",
    sauna: { naam: "Thermen Bussloo", plaats: "Bussloo" },
    afgelopen: false,
  });
  assert.equal(t, "Opgietweekend · 14–15 november 2026 · Thermen Bussloo");
});

test("description komend event: datum, locatie, hook met tickets, binnen lengte", () => {
  const d = eventMetaDescription({ ...natupop, afgelopen: false });
  assert.ok(d.includes("24 t/m 26 juli 2026"), d);
  assert.ok(d.includes("Sauna Flevo Natuur"), d);
  assert.ok(/tickets/.test(d), d);
  assert.ok(d.length >= MIN_DESCRIPTION && d.length <= MAX_DESCRIPTION, `${d.length}: ${d}`);
});

test("description afgelopen event: 'geweest', geen tickets", () => {
  const d = eventMetaDescription({ ...natupop, afgelopen: true });
  assert.ok(/was op 24 t\/m 26 juli 2026/.test(d), d);
  assert.ok(/was op|geweest/i.test(d), d);
  assert.ok(/komende opgietingen/.test(d), d);
  assert.ok(!/ticket/i.test(d), d);
  assert.ok(d.length >= MIN_DESCRIPTION && d.length <= MAX_DESCRIPTION, `${d.length}: ${d}`);
});

test("description blijft binnen de grens bij een absurd lange titel", () => {
  const d = eventMetaDescription({
    ...natupop,
    titel: "Een ongelooflijk lange eventtitel die maar door blijft gaan en nog veel langer is dan een normale eventnaam ooit zou moeten zijn in de agenda van een sauna",
    afgelopen: false,
  });
  assert.ok(d.length <= MAX_DESCRIPTION, `${d.length}: ${d}`);
});
