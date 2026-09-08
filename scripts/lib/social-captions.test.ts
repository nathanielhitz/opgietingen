import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwPosts } from "../../src/lib/social";
import { bouwCaption, hashtags, LIMIET } from "../../src/lib/social-captions";
import { maakEvent, sauna } from "./social-fixtures";

const DATUM = "2026-09-11";
const events = [
  maakEvent({ slug: "vr", startDatum: "2026-09-11", titel: "Vuur & Kruiden", type: "thema" }),
  maakEvent({
    slug: "we",
    startDatum: "2026-09-12",
    eindDatum: "2026-09-13",
    titel: "Opgietweekend Herfstgloed",
    type: "opgietweekend",
    sauna: { ...sauna, naam: "Zwaluwhoeve", plaats: "Hierden", instagram: undefined },
  }),
];
const weekend = bouwPosts(events, DATUM).find((p) => p.rubriek === "weekend")!;

test("instagram: opening, eventregels met @handle waar bekend, link-in-bio, hashtags", () => {
  const c = bouwCaption(weekend, "instagram");
  assert.match(c, /^Dit weekend staan er 2 opgietingen|^Zin in een opgieting dit weekend|^Weekendplanning: 2 opgietingen/);
  assert.match(c, /📅 vr 11 sep · Vuur & Kruiden · Thermen Bussloo, Voorst @thermenbussloo/);
  assert.match(c, /📅 za 12 sep t\/m zo 13 sep · Opgietweekend Herfstgloed · Zwaluwhoeve, Hierden\n/);
  assert.ok(!c.includes("Zwaluwhoeve, Hierden @"), "geen @ zonder handle");
  assert.match(c, /Volledige agenda via de link in bio\./);
  assert.ok(!c.includes("http"), "geen links op Instagram");
  assert.match(c, /#opgieting #opgietingen #aufguss #sauna #saunaliefhebbers #wellness #themaopgieting #opgietweekend #voorst #hierden$/);
  assert.ok(!c.includes("—"), "geen em-streepjes");
});

test("facebook: echte URL met UTM, drie hashtags, geen @handles", () => {
  const c = bouwCaption(weekend, "facebook");
  assert.match(c, /Volledige agenda: https:\/\/opgietingen\.nl\/opgietingen\/dit-weekend\?utm_source=facebook&utm_medium=social&utm_campaign=weekend-2026-w37/);
  assert.match(c, /#opgieting #aufguss #sauna$/);
  assert.ok(!c.includes("@thermenbussloo"));
});

test("tiktok: vijf hashtags en link-in-bio", () => {
  const c = bouwCaption(weekend, "tiktok");
  assert.match(c, /#opgieting #opgietingen #aufguss #sauna #saunaliefhebbers$/);
  assert.match(c, /link in bio/);
});

test("uitgelicht: detailregels met tijden en prijs, facebook linkt naar het event", () => {
  const ev = maakEvent({ slug: "u", startDatum: "2026-09-26", type: "opgietweekend", titel: "Herfstweekend", tijden: "10:00–22:00", prijsIndicatie: "Vanaf € 49,50" });
  const post = bouwPosts([ev], DATUM).find((p) => p.rubriek === "uitgelicht")!;
  const ig = bouwCaption(post, "instagram");
  assert.match(ig, /Tijden: 10:00–22:00/);
  assert.match(ig, /Prijs: Vanaf € 49,50/);
  assert.ok(!/Over 1 weken/.test(ig), "enkelvoud: 1 week");
  const fb = bouwCaption(post, "facebook");
  assert.match(fb, /https:\/\/opgietingen\.nl\/event\/u\?utm_source=facebook&utm_medium=social&utm_campaign=uitgelicht-u/);
});

test("limiet: te lange caption laat eventregels weg met een teller, hashtags blijven", () => {
  const veel = Array.from({ length: 60 }, (_, i) =>
    maakEvent({ slug: `e${i}`, startDatum: "2026-09-12", titel: `Een behoorlijk lange eventtitel nummer ${i} met extra woorden erbij` }),
  );
  const post = bouwPosts(veel, DATUM).find((p) => p.rubriek === "weekend")!;
  const c = bouwCaption(post, "instagram");
  assert.ok(c.length <= LIMIET.instagram, `${c.length}`);
  assert.match(c, /…en \d+ meer op opgietingen\.nl/);
  assert.match(c, /#opgieting/);
});

test("hashtags: maximaal 12 op Instagram, plaatsnamen zonder streepjes", () => {
  const post = bouwPosts(
    [maakEvent({ slug: "a", startDatum: "2026-09-12", sauna: { ...sauna, plaats: "Sint-Michielsgestel" } })],
    DATUM,
  ).find((p) => p.rubriek === "weekend")!;
  const tags = hashtags(post, "instagram");
  assert.ok(tags.length <= 12);
  assert.ok(tags.includes("sintmichielsgestel"));
});
