import { test } from "node:test";
import assert from "node:assert/strict";
import { maakEvent, sauna } from "./social-fixtures";
import { addDaysISO } from "../../src/lib/dates";
import {
  weekendEvents,
  maandEvents,
  nieuweEvents,
  uitgelichtKandidaten,
  bouwPosts,
  maandBereik,
  MAX_EVENT_SLIDES,
} from "../../src/lib/social";

// Referentie: vrijdag 11 september 2026 (ISO-week 37, weekend 11–13 sep).
const DATUM = "2026-09-11";

test("weekendEvents: overlap met vr–zo, gesorteerd op datum en saunanaam", () => {
  const events = [
    maakEvent({ slug: "za", startDatum: "2026-09-12" }),
    maakEvent({ slug: "meerdaags", startDatum: "2026-09-09", eindDatum: "2026-09-11" }), // eindigt vrijdag: telt
    maakEvent({ slug: "volgende-week", startDatum: "2026-09-18" }),
    maakEvent({ slug: "do", startDatum: "2026-09-10" }), // donderdag: telt niet
    maakEvent({ slug: "vr-b", startDatum: "2026-09-11", sauna: { ...sauna, naam: "Zwaluwhoeve" } }),
    maakEvent({ slug: "vr-a", startDatum: "2026-09-11" }),
  ];
  assert.deepEqual(
    weekendEvents(events, "2026-W37").map((e) => e.slug),
    ["meerdaags", "vr-a", "vr-b", "za"],
  );
  assert.deepEqual(weekendEvents(events, "onzin"), []);
});

test("maandEvents: alleen startdatum in die maand", () => {
  const events = [
    maakEvent({ slug: "okt", startDatum: "2026-10-03" }),
    maakEvent({ slug: "sep", startDatum: "2026-09-30", eindDatum: "2026-10-02" }),
  ];
  assert.deepEqual(maandEvents(events, "oktober-2026").map((e) => e.slug), ["okt"]);
  assert.deepEqual(maandEvents(events, "geen-maand"), []);
});

test("nieuweEvents: gepubliceerdOp in de afgelopen zeven dagen en nog komend", () => {
  const events = [
    maakEvent({ slug: "vers", startDatum: "2026-10-10", gepubliceerdOp: "2026-09-07" }),
    maakEvent({ slug: "grens", startDatum: "2026-10-11", gepubliceerdOp: "2026-09-05" }), // datum-6: telt
    maakEvent({ slug: "oud", startDatum: "2026-10-12", gepubliceerdOp: "2026-09-04" }),
    maakEvent({ slug: "voorbij", startDatum: "2026-09-10", gepubliceerdOp: "2026-09-08" }),
    maakEvent({ slug: "zonder", startDatum: "2026-10-13" }),
  ];
  assert.deepEqual(nieuweEvents(events, DATUM).map((e) => e.slug), ["vers", "grens"]);
});

test("uitgelichtKandidaten: venster 7–28 dagen, prioriteit op type, dan datum, max 3", () => {
  const events = [
    maakEvent({ slug: "te-vroeg", startDatum: "2026-09-17", type: "opgietweekend" }), // dag 6
    maakEvent({ slug: "thema", startDatum: "2026-09-19", type: "thema" }),
    maakEvent({ slug: "weekend-laat", startDatum: "2026-10-08", type: "opgietweekend" }),
    maakEvent({ slug: "weekend-vroeg", startDatum: "2026-09-25", type: "opgietweekend" }),
    maakEvent({ slug: "kamp", startDatum: "2026-10-02", type: "kampioenschap" }),
    maakEvent({ slug: "regulier", startDatum: "2026-09-20", type: "regulier" }),
    maakEvent({ slug: "te-laat", startDatum: "2026-10-10", type: "opgietweekend" }), // dag 29
  ];
  assert.deepEqual(
    uitgelichtKandidaten(events, DATUM).map((e) => e.slug),
    ["weekend-vroeg", "weekend-laat", "kamp"],
  );
});

test("bouwPosts: vier rubrieken met stabiele id's en plaatsingsdagen vanuit vrijdag", () => {
  const events = [
    maakEvent({ slug: "we", startDatum: "2026-09-12" }),
    maakEvent({ slug: "nieuw", startDatum: "2026-10-20", gepubliceerdOp: "2026-09-07" }),
    maakEvent({ slug: "uit", startDatum: "2026-09-26", type: "opgietweekend" }),
  ];
  // Vrijdag 25 september: maandstart 1 oktober valt in het venster.
  const posts = bouwPosts([...events, maakEvent({ slug: "okt", startDatum: "2026-10-03" })], "2026-09-25");
  const ids = posts.map((p) => p.id);
  assert.ok(ids.includes("weekend-2026-W39"), ids.join());
  assert.ok(ids.includes("maand-oktober-2026"), ids.join());
  assert.deepEqual(
    posts.filter((p) => p.rubriek === "uitgelicht").map((p) => [p.id, p.rang]),
    [["uitgelicht-okt", 1], ["uitgelicht-nieuw", 2]],
  );
  const maand = posts.find((p) => p.id === "maand-oktober-2026")!;
  assert.equal(maand.plaatsingsdag, "2026-10-01");
  assert.deepEqual(maand.periode, { van: "2026-10-01", tot: "2026-10-31" });

  const p11 = bouwPosts(events, DATUM);
  const weekend = p11.find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.id, "weekend-2026-W37");
  assert.equal(weekend.plaatsingsdag, "2026-09-11");
  assert.deepEqual(weekend.slides.map((s) => s.rol), ["cover", "event", "afsluiter"]);
  assert.equal(weekend.slides[0].pad, "/social/weekend/2026-W37");
  assert.equal(weekend.slides[1].pad, "/social/event/we");
  const nieuw = p11.find((p) => p.rubriek === "nieuw")!;
  assert.equal(nieuw.id, "nieuw-2026-W37");
  assert.equal(nieuw.plaatsingsdag, "2026-09-14"); // maandag
  const uit = p11.find((p) => p.rubriek === "uitgelicht")!;
  assert.equal(uit.id, "uitgelicht-uit");
  assert.equal(uit.rang, 1);
  assert.equal(uit.plaatsingsdag, "2026-09-16"); // woensdag
  assert.deepEqual(uit.slides.map((s) => s.rol), ["event"]);
  assert.ok(!p11.some((p) => p.rubriek === "maand"), "geen maandstart in het venster");
});

test("bouwPosts: maximaal drie uitgelicht-kandidaten met rang 1, 2, 3", () => {
  const events = ["a", "b", "c", "d"].map((s, i) => maakEvent({ slug: s, startDatum: addDaysISO(DATUM, 8 + i), type: "thema" }));
  const uit = bouwPosts(events, DATUM).filter((p) => p.rubriek === "uitgelicht");
  assert.deepEqual(uit.map((p) => [p.id, p.rang]), [["uitgelicht-a", 1], ["uitgelicht-b", 2], ["uitgelicht-c", 3]]);
});

test("bouwPosts: vanuit maandag komt hetzelfde weekend, plaatsingsdag vrijdag", () => {
  const posts = bouwPosts([maakEvent({ slug: "we", startDatum: "2026-09-12" })], "2026-09-07");
  const weekend = posts.find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.id, "weekend-2026-W37");
  assert.equal(weekend.plaatsingsdag, "2026-09-11");
});

test("bouwPosts: meer dan acht events -> acht slides, alle events in de post", () => {
  const events = Array.from({ length: 11 }, (_, i) => maakEvent({ slug: `e${i}`, startDatum: "2026-09-12" }));
  const weekend = bouwPosts(events, DATUM).find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.slides.length, MAX_EVENT_SLIDES + 2);
  assert.equal(weekend.events.length, 11);
  assert.equal(weekend.titel, "Dit weekend: 11 opgietingen");
});

test("bouwPosts: lege agenda -> geen posts", () => {
  assert.deepEqual(bouwPosts([], DATUM), []);
});

test("maandBereik: eerste en laatste dag van de maand, null bij ongeldige slug", () => {
  assert.deepEqual(maandBereik("december-2026"), { van: "2026-12-01", tot: "2026-12-31" });
  assert.equal(maandBereik("onzin"), null);
});
