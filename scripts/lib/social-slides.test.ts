import { test } from "node:test";
import assert from "node:assert/strict";
import { afkap, MAX_REGELS, programmaRegels } from "../../src/lib/social-slides";
import { formatDagCompact } from "../../src/lib/dates";

/*
  afkap kapt eventtitels af voor de slides: op een woordgrens als die ver
  genoeg (>60% van max) in de tekst ligt, anders hard op max. Altijd met
  beletselteken, zodat zichtbaar is dat er tekst is weggevallen.
*/

test("afkap: tekst korter dan max blijft ongewijzigd", () => {
  assert.equal(afkap("Kort", 10), "Kort");
});

test("afkap: tekst exact op max blijft ongewijzigd, zonder beletselteken", () => {
  assert.equal(afkap("1234567890", 10), "1234567890");
});

test("afkap: kapt op de laatste woordgrens voorbij 60% van max", () => {
  // stuk = "opgieting in de mooi", laatste spatie op 15 (> 12) -> knip daar.
  assert.equal(afkap("opgieting in de mooie sauna", 20), "opgieting in de…");
});

test("afkap: tekst zonder spaties wordt hard op max afgekapt", () => {
  assert.equal(afkap("abcdefghijklmno", 10), "abcdefghij…");
});

test("afkap: spatie voor 60% van max levert een harde afkap op max", () => {
  // Laatste spatie op 3 (< 12): een knip daar zou bijna de hele titel weggooien.
  assert.equal(afkap("abc defghijklmnopqrstuvwxyz", 20), "abc defghijklmnopqrs…");
});

/* ---------- programma op de cover ---------- */

const sauna = (naam: string, plaats: string) => ({ naam, plaats }) as never;
const ev = (startDatum: string, eindDatum: string | undefined, naam: string, plaats: string) => ({ startDatum, eindDatum, sauna: sauna(naam, plaats) });

test("formatDagCompact: één dag als 'vr 11', meerdaags als 'za 12–13'", () => {
  assert.equal(formatDagCompact("2026-09-11"), "vr 11");
  assert.equal(formatDagCompact("2026-09-12", "2026-09-12"), "za 12");
  assert.equal(formatDagCompact("2026-09-12", "2026-09-13"), "za 12–13");
});

test("programmaRegels: dag, sauna en plaats per event, in selectievolgorde, rest 0", () => {
  const p = programmaRegels([ev("2026-09-11", undefined, "Centre du Lac", "Pijnacker"), ev("2026-09-12", "2026-09-13", "De Veluwse Bron", "Emst")], "feed");
  assert.deepEqual(p, {
    regels: [
      { dag: "vr 11", sauna: "Centre du Lac", plaats: "Pijnacker" },
      { dag: "za 12–13", sauna: "De Veluwse Bron", plaats: "Emst" },
    ],
    rest: 0,
  });
});

test("programmaRegels: kapt af op MAX_REGELS per formaat en telt de rest", () => {
  const veel = Array.from({ length: 9 }, (_, i) => ev(`2026-10-${String(i + 1).padStart(2, "0")}`, undefined, `Sauna ${i}`, "Plaats"));
  const feed = programmaRegels(veel, "feed");
  assert.equal(feed.regels.length, MAX_REGELS.feed);
  assert.equal(feed.rest, 9 - MAX_REGELS.feed);
  const story = programmaRegels(veel, "story");
  assert.equal(story.regels.length, MAX_REGELS.story);
  assert.equal(story.rest, 9 - MAX_REGELS.story);
  assert.ok(MAX_REGELS.story > MAX_REGELS.feed, "de story is hoger en toont meer regels");
});

test("programmaRegels: zonder events lege regels en rest 0", () => {
  assert.deepEqual(programmaRegels([], "feed"), { regels: [], rest: 0 });
});
