import { test } from "node:test";
import assert from "node:assert/strict";
import { afkap } from "../../src/lib/social-slides";

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
