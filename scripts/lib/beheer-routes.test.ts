// scripts/lib/beheer-routes.test.ts
// Het beheerpaneel mag nooit gecrawld of in de sitemap terechtkomen.
import { test } from "node:test";
import assert from "node:assert/strict";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";

test("robots.txt sluit /keystatic en /api/keystatic uit", () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
  assert.ok(disallow.includes("/uit/"), "bestaande /uit/-regel moet blijven");
  assert.ok(disallow.includes("/keystatic"), "/keystatic ontbreekt in disallow");
  assert.ok(disallow.includes("/api/keystatic"), "/api/keystatic ontbreekt in disallow");
  assert.ok(disallow.includes("/beheer"), "/beheer ontbreekt in disallow");
});

test("sitemap bevat geen beheer-URL's", () => {
  const urls = sitemap().map((e) => e.url);
  assert.ok(urls.length > 10, "sitemap lijkt leeg");
  assert.deepEqual(
    urls.filter((u) => u.includes("/keystatic") || u.includes("/api/") || u.includes("/beheer")),
    [],
  );
});
