// scripts/lib/keystatic-schema.test.ts
// Elk veld dat in de content voorkomt moet in het Keystatic-schema staan:
// een veld dat Keystatic niet kent, schrijft het bij een save niet terug.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createReader } from "@keystatic/core/reader";
import keystaticConfig, { bronVelden } from "../../keystatic.config";

const ROOT = process.cwd();

function frontmatterKeys(dir: string): string[] {
  const keys = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    const { data } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of Object.keys(data)) keys.add(k);
  }
  return [...keys].sort();
}

const collecties = keystaticConfig.collections!;

for (const [naam, dir] of [
  ["events", "content/events"],
  ["saunas", "content/saunas"],
  ["gidsen", "content/gidsen"],
] as const) {
  test(`Keystatic-schema '${naam}' dekt alle frontmatter-velden in ${dir}`, () => {
    const schemaKeys = new Set(Object.keys(collecties[naam].schema));
    const ontbrekend = frontmatterKeys(path.join(ROOT, dir)).filter((k) => !schemaKeys.has(k));
    assert.deepEqual(ontbrekend, [], `velden zonder schema: ${ontbrekend.join(", ")}`);
  });
}

test("Keystatic-singleton 'bronnen' dekt alle velden in content/bronnen.json", () => {
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, "content/bronnen.json"), "utf8")) as {
    bronnen: Record<string, unknown>[];
  } & Record<string, unknown>;

  const topSchema = new Set(Object.keys(keystaticConfig.singletons!.bronnen.schema));
  const topOntbrekend = Object.keys(file).filter((k) => !topSchema.has(k));
  assert.deepEqual(topOntbrekend, [], `top-level velden zonder schema: ${topOntbrekend.join(", ")}`);

  const bronSchema = new Set(Object.keys(bronVelden));
  const itemKeys = new Set<string>();
  for (const b of file.bronnen) for (const k of Object.keys(b)) itemKeys.add(k);
  const itemOntbrekend = [...itemKeys].filter((k) => !bronSchema.has(k));
  assert.deepEqual(itemOntbrekend, [], `bron-velden zonder schema: ${itemOntbrekend.join(", ")}`);
});

test("Keystatic-paden wijzen naar de mappen die de loader leest", () => {
  assert.equal(collecties.events.path, "content/events/*");
  assert.equal(collecties.saunas.path, "content/saunas/*");
  assert.equal(collecties.gidsen.path, "content/gidsen/*");
  assert.equal(keystaticConfig.singletons!.bronnen.path, "content/bronnen");
});

// De dekkingstest bewaakt "schema dekt content"; deze test bewaakt de andere
// richting: elke entry haalt ook de validatie van het schema (verplichte velden,
// bereiken, URL-vorm). Het reader-pad gebruikt dezelfde parse/validate als het
// paneel, dus wat hier faalt kan in het paneel niet opgeslagen worden.
test("alle content valideert tegen het Keystatic-schema (reader-pad)", async () => {
  const reader = createReader(ROOT, keystaticConfig);
  const fouten: string[] = [];
  for (const naam of ["events", "saunas", "gidsen"] as const) {
    for (const slug of await reader.collections[naam].list()) {
      try {
        const entry = await reader.collections[naam].read(slug);
        if (!entry) fouten.push(`${naam}/${slug}: leeg`);
      } catch (e) {
        fouten.push(`${naam}/${slug}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  try {
    const bronnen = await reader.singletons.bronnen.read();
    if (!bronnen) fouten.push("bronnen: leeg");
  } catch (e) {
    fouten.push(`bronnen: ${e instanceof Error ? e.message : String(e)}`);
  }
  assert.deepEqual(fouten, [], fouten.join("\n"));
});
