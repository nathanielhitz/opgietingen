import { test } from "node:test";
import assert from "node:assert/strict";
import { existingSaunaSlugs, normalizeProseDashes, normalizeRangeDashes } from "./content";

test("existingSaunaSlugs bevat bekende profielen", () => {
  const slugs = existingSaunaSlugs();
  assert.ok(slugs instanceof Set);
  assert.ok(slugs.has("thermen-bussloo"), "verwacht thermen-bussloo als bestaand profiel");
  assert.ok(slugs.size >= 5);
});

test("normalizeProseDashes maakt van een ingesloten em-streepje een komma", () => {
  assert.equal(
    normalizeProseDashes("Speciale dag met gastopgieters — dubbel zoveel als normaal."),
    "Speciale dag met gastopgieters, dubbel zoveel als normaal.",
  );
});

test("normalizeProseDashes ruimt dubbele komma's en spaties op", () => {
  // Een bestaande komma vlak na het streepje mag geen ", ," opleveren.
  assert.equal(normalizeProseDashes("geuren — , technieken"), "geuren, technieken");
});

test("normalizeProseDashes maakt van een streepje zonder spaties een koppelteken", () => {
  assert.equal(normalizeProseDashes("thema—avond"), "thema-avond");
});

test("normalizeProseDashes laat en-streepjes met rust", () => {
  assert.equal(normalizeProseDashes("openingstijd 11:00–18:00"), "openingstijd 11:00–18:00");
});

test("normalizeRangeDashes zet een em-streepje om naar een half streepje zonder spaties", () => {
  assert.equal(normalizeRangeDashes("11:00 — 18:00"), "11:00–18:00");
  assert.equal(normalizeRangeDashes("€ 25 — € 40"), "€ 25–€ 40");
});
