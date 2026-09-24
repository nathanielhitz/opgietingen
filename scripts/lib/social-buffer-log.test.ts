// scripts/lib/social-buffer-log.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eersteRegelVoorPost, leesGrootboek, schrijfGrootboek, voegRegelToe, zoekRegel, type GrootboekRegel } from "../../src/lib/social-buffer-log";

const regel: GrootboekRegel = {
  post: "weekend-2026-W40",
  kanaal: "facebook",
  bufferId: "68d2abc",
  dueAt: "2026-10-02T10:00:00.000Z",
  aangemaakt: "2026-09-28T07:31:12.000Z",
  run: "1234567890",
};

const tmpMappen: string[] = [];

function tmpBestand(): string {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), "social-buffer-log-"));
  tmpMappen.push(map);
  return path.join(map, "social-buffer.json");
}

after(() => {
  for (const map of tmpMappen) {
    fs.rmSync(map, { recursive: true, force: true });
  }
});

test("leesGrootboek: ontbrekend bestand is een leeg grootboek", () => {
  assert.deepEqual(leesGrootboek(tmpBestand()), { posts: [] });
});

test("schrijfGrootboek + leesGrootboek: round-trip, bestand eindigt op een newline", () => {
  const bestand = tmpBestand();
  schrijfGrootboek({ posts: [regel] }, bestand);
  assert.deepEqual(leesGrootboek(bestand), { posts: [regel] });
  assert.ok(fs.readFileSync(bestand, "utf8").endsWith("}\n"));
});

test("leesGrootboek: onleesbaar of ongeldig bestand gooit (nooit stilzwijgend overschrijven)", () => {
  const kapot = tmpBestand();
  fs.writeFileSync(kapot, "{ dit is geen json");
  assert.throws(() => leesGrootboek(kapot));
  const zonderLijst = tmpBestand();
  fs.writeFileSync(zonderLijst, JSON.stringify({ posts: "nee" }));
  assert.throws(() => leesGrootboek(zonderLijst), /geen posts-lijst/);
  const ongeldigeRegel = tmpBestand();
  fs.writeFileSync(ongeldigeRegel, JSON.stringify({ posts: [{ post: "x" }] }));
  assert.throws(() => leesGrootboek(ongeldigeRegel), /regel 0 is ongeldig/);
  const onbekendKanaal = tmpBestand();
  fs.writeFileSync(onbekendKanaal, JSON.stringify({ posts: [{ ...regel, kanaal: "x" }] }));
  assert.throws(() => leesGrootboek(onbekendKanaal), /regel 0 is ongeldig/);
  const nullBestand = tmpBestand();
  fs.writeFileSync(nullBestand, "null");
  assert.throws(() => leesGrootboek(nullBestand), /geen posts-lijst|onleesbare JSON/);
  const legeBufferId = tmpBestand();
  fs.writeFileSync(legeBufferId, JSON.stringify({ posts: [{ ...regel, bufferId: "" }] }));
  assert.throws(() => leesGrootboek(legeBufferId), /regel 0 is ongeldig/);
});

test("zoekRegel: vindt op post-id én kanaal", () => {
  const grootboek = { posts: [regel] };
  assert.equal(zoekRegel(grootboek, "weekend-2026-W40", "facebook")?.bufferId, "68d2abc");
  assert.equal(zoekRegel(grootboek, "weekend-2026-W40", "instagram"), undefined);
  assert.equal(zoekRegel(grootboek, "nieuw-2026-W40", "facebook"), undefined);
});

test("voegRegelToe: geen mutatie, geen dubbele combinatie", () => {
  const leeg = { posts: [] as GrootboekRegel[] };
  const een = voegRegelToe(leeg, regel);
  assert.equal(leeg.posts.length, 0, "origineel ongewijzigd");
  assert.equal(een.posts.length, 1);
  const nogEens = voegRegelToe(een, { ...regel, bufferId: "anders" });
  assert.equal(nogEens.posts.length, 1, "bestaande combinatie wint");
  assert.equal(nogEens.posts[0].bufferId, "68d2abc");
  const anderKanaal = voegRegelToe(een, { ...regel, kanaal: "tiktok" });
  assert.equal(anderKanaal.posts.length, 2);
});

test("eersteRegelVoorPost: eerste regel van een post-id op welk kanaal ook", () => {
  const grootboek = {
    posts: [
      { ...regel, post: "uitgelicht-x", kanaal: "instagram" as const, bufferId: "ig1" },
      { ...regel, post: "uitgelicht-x", kanaal: "facebook" as const, bufferId: "fb1" },
      regel,
    ],
  };
  assert.equal(eersteRegelVoorPost(grootboek, "uitgelicht-x")?.bufferId, "ig1");
  assert.equal(eersteRegelVoorPost(grootboek, "weekend-2026-W40")?.bufferId, "68d2abc");
  assert.equal(eersteRegelVoorPost(grootboek, "uitgelicht-y"), undefined);
  assert.equal(eersteRegelVoorPost({ posts: [] }, "uitgelicht-x"), undefined);
});

test("grootboek: regel met video-URL leest en schrijft rond; zonder video blijft geldig; niet-string video is ongeldig", () => {
  const bestand = tmpBestand();
  const metVideo: GrootboekRegel = { ...regel, kanaal: "tiktok", video: "https://x.public.blob.vercel-storage.com/social/2026-10-02/weekend-2026-W40.mp4" };
  schrijfGrootboek({ posts: [regel, metVideo] }, bestand);
  assert.deepEqual(leesGrootboek(bestand), { posts: [regel, metVideo] });
  fs.writeFileSync(bestand, JSON.stringify({ posts: [{ ...regel, video: 42 }] }));
  assert.throws(() => leesGrootboek(bestand), /regel 0 is ongeldig/);
});
