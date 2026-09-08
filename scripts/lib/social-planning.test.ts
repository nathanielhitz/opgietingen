import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwPlanning } from "../../src/lib/social-planning";
import { maakEvent } from "./social-fixtures";

test("bouwPlanning: contract voor script en Buffer-adapter", () => {
  const planning = bouwPlanning(
    [maakEvent({ slug: "we", startDatum: "2026-09-12" }), maakEvent({ slug: "uit", startDatum: "2026-09-26", type: "opgietweekend" })],
    "2026-09-11",
    "http://localhost:3000",
  );
  assert.equal(planning.datum, "2026-09-11");
  assert.equal(planning.basis, "http://localhost:3000");
  const weekend = planning.posts.find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.slides[0].feed, "http://localhost:3000/social/weekend/2026-W37?formaat=feed");
  assert.equal(weekend.slides[0].story, "http://localhost:3000/social/weekend/2026-W37?formaat=story");
  assert.equal(weekend.slides[1].eventSlug, "we");
  assert.deepEqual(Object.keys(weekend.captions).sort(), ["facebook", "instagram", "tiktok"]);
  assert.ok(weekend.captions.instagram.length > 20);
  assert.ok(weekend.slides.length <= 10);
  assert.ok(!("pad" in weekend.slides[0]), "interne paden niet in het contract");
});

test("bouwPlanning: basis zonder trailing slash, lege agenda geeft lege posts", () => {
  const leeg = bouwPlanning([], "2026-09-11", "https://opgietingen.nl/");
  assert.equal(leeg.basis, "https://opgietingen.nl");
  assert.deepEqual(leeg.posts, []);
});
