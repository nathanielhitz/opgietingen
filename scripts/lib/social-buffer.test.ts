// scripts/lib/social-buffer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlanningPost } from "../../src/lib/social-planning";
import { dueAtVoor, kiesPosts, PLAATSINGSTIJD, tiktokTitel } from "./social-buffer";

/** Minimale planning-post; velden overschrijfbaar per test. */
export function maakPost(o: Partial<PlanningPost> & { id: string; rubriek: PlanningPost["rubriek"]; plaatsingsdag: string }): PlanningPost {
  return {
    rang: 1,
    titel: `Post ${o.id}`,
    periode: { van: o.plaatsingsdag, tot: o.plaatsingsdag },
    events: [],
    slides: [
      { rol: "cover", feed: `https://opgietingen.nl/social/weekend/2026-W40?formaat=feed`, story: `https://opgietingen.nl/social/weekend/2026-W40?formaat=story` },
      { rol: "event", eventSlug: "ev", feed: `https://opgietingen.nl/social/event/ev?formaat=feed`, story: `https://opgietingen.nl/social/event/ev?formaat=story` },
      { rol: "afsluiter", feed: `https://opgietingen.nl/social/afsluiter?formaat=feed`, story: `https://opgietingen.nl/social/afsluiter?formaat=story` },
    ],
    captions: { instagram: "IG", facebook: "FB", tiktok: "TT" },
    ...o,
  };
}

// Maandag 28 september 2026, 07:31 UTC: het run-moment van de workflow.
const NU = new Date("2026-09-28T07:31:00.000Z");

test("PLAATSINGSTIJD: vaste NL-tijden per rubriek", () => {
  assert.deepEqual(PLAATSINGSTIJD, { nieuw: "17:00", uitgelicht: "19:00", weekend: "12:00", maand: "10:00" });
});

test("dueAtVoor: plaatsingsdag + rubriektijd in NL-tijd, als UTC", () => {
  assert.equal(dueAtVoor({ rubriek: "weekend", plaatsingsdag: "2026-10-02" }, NU), "2026-10-02T10:00:00.000Z"); // vr 12:00 CEST
  assert.equal(dueAtVoor({ rubriek: "nieuw", plaatsingsdag: "2026-09-28" }, NU), "2026-09-28T15:00:00.000Z"); // ma 17:00 CEST
  assert.equal(dueAtVoor({ rubriek: "maand", plaatsingsdag: "2026-11-01" }, NU), "2026-11-01T09:00:00.000Z"); // zo 10:00 CET
});

test("dueAtVoor: verstreken tijdstip wordt nu + 15 minuten, op de minuut", () => {
  const laat = new Date("2026-09-28T16:00:42.500Z"); // na 17:00 NL
  assert.equal(dueAtVoor({ rubriek: "nieuw", plaatsingsdag: "2026-09-28" }, laat), "2026-09-28T16:15:00.000Z");
  const precies = new Date("2026-09-28T15:00:00.000Z"); // exact op het tijdstip telt als verstreken
  assert.equal(dueAtVoor({ rubriek: "nieuw", plaatsingsdag: "2026-09-28" }, precies), "2026-09-28T15:15:00.000Z");
});

test("kiesPosts: alleen rang 1, verstreken plaatsingsdag valt weg, dueAt erbij", () => {
  const planning = {
    posts: [
      maakPost({ id: "nieuw-2026-W40", rubriek: "nieuw", plaatsingsdag: "2026-09-28" }),
      maakPost({ id: "uitgelicht-a", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30" }),
      maakPost({ id: "uitgelicht-b", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30", rang: 2 }),
      maakPost({ id: "uitgelicht-c", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30", rang: 3 }),
      maakPost({ id: "weekend-2026-W39", rubriek: "weekend", plaatsingsdag: "2026-09-25" }),
    ],
  };
  const { gekozen, overgeslagen } = kiesPosts(planning, "2026-09-28", NU);
  assert.deepEqual(gekozen.map((k) => k.post.id), ["nieuw-2026-W40", "uitgelicht-a"]);
  assert.equal(gekozen[0].dueAt, "2026-09-28T15:00:00.000Z");
  assert.equal(gekozen[1].dueAt, "2026-09-30T17:00:00.000Z");
  assert.deepEqual(
    overgeslagen.map((o) => [o.post.id, o.reden]),
    [
      ["uitgelicht-b", "kandidaat 2"],
      ["uitgelicht-c", "kandidaat 3"],
      ["weekend-2026-W39", "plaatsingsdag verstreken"],
    ],
  );
});

test("kiesPosts: lege planning geeft niets", () => {
  assert.deepEqual(kiesPosts({ posts: [] }, "2026-09-28", NU), { gekozen: [], overgeslagen: [] });
});

test("tiktokTitel: korte titel ongewijzigd, lange afgekapt op een woordgrens met …", () => {
  assert.equal(tiktokTitel("Dit weekend: 6 opgietingen"), "Dit weekend: 6 opgietingen");
  const lang = "Uitgelicht: " + "Opgietweekend Herfstgloed met internationale gastmeesters ".repeat(3);
  const kort = tiktokTitel(lang);
  assert.ok(kort.length <= 90, `lengte ${kort.length}`);
  assert.ok(kort.endsWith("…"));
  assert.ok(!kort.endsWith(" …"), "geen spatie vóór het beletselteken");
  assert.ok(lang.startsWith(kort.slice(0, -1)), "afgekapt op een woordgrens binnen de titel");
});
