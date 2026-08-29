// scripts/lib/beheer.test.ts
// Local-mode van Keystatic mag nooit op productie draaien (onbeveiligde API).
import { test } from "node:test";
import assert from "node:assert/strict";
import { beheerBeschikbaar } from "../../src/lib/beheer";

test("development: paneel beschikbaar, ook zonder GitHub App", () => {
  assert.equal(beheerBeschikbaar({ NODE_ENV: "development" }), true);
  assert.equal(beheerBeschikbaar({ NODE_ENV: "test" }), true);
});

test("productie zonder GitHub App: paneel bestaat niet", () => {
  assert.equal(beheerBeschikbaar({ NODE_ENV: "production" }), false);
  assert.equal(beheerBeschikbaar({ NODE_ENV: "production", NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: "" }), false);
});

test("productie met GitHub App: paneel beschikbaar", () => {
  assert.equal(
    beheerBeschikbaar({ NODE_ENV: "production", NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: "opgietingen-beheer" }),
    true,
  );
});
