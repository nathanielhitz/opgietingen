// scripts/lib/social-kit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestandsnaam, captionsMarkdown, downloadPost } from "./social-kit";
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

test("bestandsnaam: volgnummer, rol, eventslug en formaat", () => {
  assert.equal(bestandsnaam(0, post.slides[0], "feed"), "01-cover-feed.png");
  assert.equal(bestandsnaam(1, post.slides[1], "story"), "02-event-herfstgloed-story.png");
  assert.equal(bestandsnaam(2, post.slides[2], "feed"), "03-afsluiter-feed.png");
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

test("downloadPost: schrijft slides en captions; ruimt de map op bij een mislukte download", async () => {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-"));
  const map = path.join(basis, post.id);
  const ok = async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  await downloadPost(post, basis, map, ["feed"], ok);
  assert.ok(fs.existsSync(path.join(map, "01-cover-feed.png")));
  assert.ok(fs.existsSync(path.join(map, "03-afsluiter-feed.png")));
  assert.ok(!fs.existsSync(path.join(map, "01-cover-story.png")), "alleen het gevraagde formaat");
  assert.ok(fs.existsSync(path.join(map, "captions.md")));

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
