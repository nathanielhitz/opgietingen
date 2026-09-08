import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwPlanning, planningAntwoord } from "../../src/lib/social-planning";
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
  assert.ok(!("eventSlug" in weekend.slides[0]), "cover heeft geen eventSlug");
});

test("bouwPlanning: basis zonder trailing slash, lege agenda geeft lege posts", () => {
  const leeg = bouwPlanning([], "2026-09-11", "https://opgietingen.nl/");
  assert.equal(leeg.basis, "https://opgietingen.nl");
  assert.deepEqual(leeg.posts, []);
});

test("planningAntwoord: ongeldige datum geeft 400 met de datum in de foutmelding", () => {
  const antwoord = planningAntwoord({ datumParam: "onzin", origin: "http://localhost:3000", events: [], vandaag: "2026-09-11" });
  assert.equal(antwoord.status, 400);
  assert.ok("fout" in antwoord.body && antwoord.body.fout.includes("onzin"));
  assert.equal(antwoord.headers["X-Robots-Tag"], "noindex");
  assert.equal(antwoord.headers["Cache-Control"], "no-store");
});

test("planningAntwoord: zonder datumParam valt terug op vandaag", () => {
  const antwoord = planningAntwoord({ datumParam: null, origin: "http://localhost:3000", events: [], vandaag: "2026-09-11" });
  assert.equal(antwoord.status, 200);
  assert.ok("datum" in antwoord.body && antwoord.body.datum === "2026-09-11");
});

test("planningAntwoord: productie gebruikt site.url als basis, anders de request-origin", () => {
  const productie = planningAntwoord({
    datumParam: "2026-09-11",
    origin: "https://preview.vercel.app",
    events: [],
    vandaag: "2026-09-11",
    vercelEnv: "production",
  });
  assert.ok("basis" in productie.body && productie.body.basis === "https://opgietingen.nl");

  const zonderVercelEnv = planningAntwoord({
    datumParam: "2026-09-11",
    origin: "https://preview.vercel.app",
    events: [],
    vandaag: "2026-09-11",
  });
  assert.ok("basis" in zonderVercelEnv.body && zonderVercelEnv.body.basis === "https://preview.vercel.app");
});
