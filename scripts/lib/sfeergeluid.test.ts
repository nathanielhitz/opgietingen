// scripts/lib/sfeergeluid.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { leesStand, SFEERGELUID_SRC, SFEERGELUID_TIP_VERTRAGING_MS, SFEERGELUID_VOLUME, tipTonen, wissel } from "../../src/lib/sfeergeluid";

/** sha256 van assets-commit 1dc5902:assets/social/muziek/valley-sunset.mp3 (Mixkit Stock Music Free License). */
const VALLEY_SUNSET_SHA256 = "f50d822cb8d6cb3da8bc9d6cfccc020786fb0c25e2c222a75d11ca06091050e7";

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

test("sitebestand is de gelicentieerde Mixkit-track Valley Sunset (niet de social-track, zie LICENTIE.md)", () => {
  const site = path.join(process.cwd(), "public", SFEERGELUID_SRC);
  assert.ok(fs.existsSync(site), `${site} ontbreekt`);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(site)).digest("hex");
  assert.equal(hash, VALLEY_SUNSET_SHA256, "public/audio/sfeergeluid.mp3 is niet Valley Sunset (Mixkit); pas de hash alleen aan bij een bewuste, gelicentieerde wissel");
});
