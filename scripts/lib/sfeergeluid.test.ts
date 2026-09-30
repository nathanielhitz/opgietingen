// scripts/lib/sfeergeluid.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { leesStand, SFEERGELUID_SRC, SFEERGELUID_TIP_VERTRAGING_MS, SFEERGELUID_VOLUME, tipTonen, wissel } from "../../src/lib/sfeergeluid";

test("leesStand: alleen letterlijk 'aan' is aan; ontbrekend of onzin is uit", () => {
  assert.equal(leesStand("aan"), "aan");
  assert.equal(leesStand("uit"), "uit");
  assert.equal(leesStand(null), "uit");
  assert.equal(leesStand(undefined), "uit");
  assert.equal(leesStand("AAN"), "uit");
  assert.equal(leesStand("true"), "uit");
});

test("wissel: aan ↔ uit", () => {
  assert.equal(wissel("aan"), "uit");
  assert.equal(wissel("uit"), "aan");
});

test("volume is achtergrond, niet voorgrond", () => {
  assert.ok(SFEERGELUID_VOLUME > 0 && SFEERGELUID_VOLUME <= 0.5);
});

test("sitebestand bestaat en is byte-gelijk aan de social-track", () => {
  const site = path.join(process.cwd(), "public", SFEERGELUID_SRC);
  const social = path.join(process.cwd(), "assets", "social", "muziek", "background-music.mp3");
  assert.ok(fs.existsSync(site), `${site} ontbreekt`);
  const hash = (p: string) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  assert.equal(hash(site), hash(social), "public/audio/sfeergeluid.mp3 wijkt af van assets/social/muziek/background-music.mp3");
});

test("tipTonen: alleen bij geluid uit én tip nog niet gezien; vertraging na het laden", () => {
  assert.equal(tipTonen({ stand: "uit", tipGezien: false }), true);
  assert.equal(tipTonen({ stand: "uit", tipGezien: true }), false);
  assert.equal(tipTonen({ stand: "aan", tipGezien: false }), false);
  assert.equal(tipTonen({ stand: "aan", tipGezien: true }), false);
  assert.ok(SFEERGELUID_TIP_VERTRAGING_MS >= 1000, "niet tijdens het laden tonen");
});
