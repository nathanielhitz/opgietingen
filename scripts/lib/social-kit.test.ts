// scripts/lib/social-kit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestandsnaam, captionsMarkdown, downloadPost, metSubmappen } from "./social-kit";
import type { PlanningPost } from "../../src/lib/social-planning";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const post: PlanningPost = {
  id: "weekend-2026-W37",
  rubriek: "weekend",
  rang: 1,
  titel: "Dit weekend: 1 opgieting",
  plaatsingsdag: "2026-09-11",
  periode: { van: "2026-09-11", tot: "2026-09-13" },
  events: [],
  slides: [
    { rol: "cover", feed: "https://x/social/weekend/2026-W37?formaat=feed", story: "https://x/social/weekend/2026-W37?formaat=story" },
    { rol: "event", eventSlug: "herfstgloed", feed: "https://x/social/event/herfstgloed?formaat=feed", story: "https://x/social/event/herfstgloed?formaat=story" },
    { rol: "afsluiter", feed: "https://x/social/afsluiter?formaat=feed", story: "https://x/social/afsluiter?formaat=story" },
  ],
  captions: { instagram: "IG-tekst", facebook: "FB-tekst", tiktok: "TT-tekst" },
};

test("bestandsnaam: volgnummer, rol en eventslug; formaat alleen als achtervoegsel wanneer gevraagd", () => {
  assert.equal(bestandsnaam(0, post.slides[0]), "01-cover.png");
  assert.equal(bestandsnaam(1, post.slides[1]), "02-event-herfstgloed.png");
  assert.equal(bestandsnaam(2, post.slides[2]), "03-afsluiter.png");
  assert.equal(bestandsnaam(0, post.slides[1], "story"), "01-event-herfstgloed-story.png");
});

test("metSubmappen: alleen bij een carrousel", () => {
  assert.equal(metSubmappen(post), true);
  assert.equal(metSubmappen({ slides: [post.slides[1]] }), false);
});

test("downloadPost: één slide komt zonder submappen in de postmap, met formaat in de naam", async () => {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-"));
  const los: PlanningPost = { ...post, id: "uitgelicht-herfstgloed", slides: [post.slides[1]] };
  const map = path.join(basis, los.id);
  const ok = async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  await downloadPost(los, basis, map, ["feed", "story"], ok);
  assert.ok(fs.existsSync(path.join(map, "01-event-herfstgloed-feed.png")));
  assert.ok(fs.existsSync(path.join(map, "01-event-herfstgloed-story.png")));
  assert.ok(!fs.existsSync(path.join(map, "feed")), "geen submap voor één bestand");
  assert.ok(fs.existsSync(path.join(map, "captions.md")));
  fs.rmSync(basis, { recursive: true, force: true });
});

test("captionsMarkdown: titel, plaatsingsdag, slides en drie kanalen", () => {
  const md = captionsMarkdown(post);
  assert.match(md, /^# Dit weekend: 1 opgieting\n/);
  assert.match(md, /Plaatsingsdag: 2026-09-11/);
  assert.match(md, /- 02 event \(herfstgloed\)/);
  assert.match(md, /## Instagram\n\nIG-tekst/);
  assert.match(md, /## Facebook\n\nFB-tekst/);
  assert.match(md, /## TikTok\n\nTT-tekst/);
});

test("downloadPost: schrijft slides per formaat in een submap en captions; ruimt de map op bij een mislukte download", async () => {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-"));
  const map = path.join(basis, post.id);
  const ok = async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  await downloadPost(post, basis, map, ["feed", "story"], ok);
  assert.ok(fs.existsSync(path.join(map, "feed", "01-cover.png")));
  assert.ok(fs.existsSync(path.join(map, "feed", "03-afsluiter.png")));
  assert.ok(fs.existsSync(path.join(map, "story", "02-event-herfstgloed.png")));
  assert.ok(fs.existsSync(path.join(map, "captions.md")));

  await downloadPost(post, basis, map, ["feed"], ok);
  assert.ok(!fs.existsSync(path.join(map, "story")), "alleen het gevraagde formaat krijgt een submap");

  const kapot = async (url: string) => new Response("", { status: url.includes("herfstgloed") ? 404 : 200 });
  await assert.rejects(() => downloadPost(post, basis, map, ["feed"], kapot), /404/);
  assert.ok(!fs.existsSync(map), "halve kit wordt verwijderd");
  fs.rmSync(basis, { recursive: true, force: true });
});

test("downloadPost: bestaande map zonder captions.md wordt niet gewist", async () => {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-"));
  const map = path.join(basis, post.id);
  fs.mkdirSync(map, { recursive: true });
  fs.writeFileSync(path.join(map, "iets-anders.txt"), "blijf staan");
  const ok = async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  await assert.rejects(() => downloadPost(post, basis, map, ["feed"], ok), /handmatig/);
  assert.ok(fs.existsSync(path.join(map, "iets-anders.txt")), "bestaande inhoud blijft staan");
  fs.rmSync(basis, { recursive: true, force: true });
});

test("downloadPost: map buiten root wordt geweigerd", async () => {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-"));
  const buiten = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-buiten-"));
  const map = path.join(buiten, post.id);
  const ok = async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  await assert.rejects(() => downloadPost(post, basis, map, ["feed"], ok), /buiten de doelmap/);
  fs.rmSync(basis, { recursive: true, force: true });
  fs.rmSync(buiten, { recursive: true, force: true });
});
