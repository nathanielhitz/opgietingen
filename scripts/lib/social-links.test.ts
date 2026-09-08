// scripts/lib/social-links.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { socials } from "../../src/lib/site";
import { utmUrl, kanaalUitParam } from "../../src/lib/utm";

test("socials: drie unieke kanalen met https-URL's", () => {
  assert.deepEqual(socials.map((s) => s.id), ["instagram", "facebook", "tiktok"]);
  for (const s of socials) assert.match(s.url, /^https:\/\//, s.id);
});

test("utmUrl: relatief pad blijft relatief, bestaande query blijft staan", () => {
  assert.equal(
    utmUrl("/agenda?land=NL", { source: "instagram", medium: "bio", campaign: "links" }),
    "/agenda?land=NL&utm_source=instagram&utm_medium=bio&utm_campaign=links",
  );
});

test("utmUrl: absolute URL blijft absoluut en waarden worden opgeschoond", () => {
  assert.equal(
    utmUrl("https://opgietingen.nl/event/x", { source: "Face Book", medium: "social", campaign: "weekend-2026-W37" }),
    "https://opgietingen.nl/event/x?utm_source=face-book&utm_medium=social&utm_campaign=weekend-2026-w37",
  );
});

test("kanaalUitParam: bekend kanaal of 'social'", () => {
  assert.equal(kanaalUitParam("tiktok"), "tiktok");
  assert.equal(kanaalUitParam("x"), "social");
  assert.equal(kanaalUitParam(undefined), "social");
});
