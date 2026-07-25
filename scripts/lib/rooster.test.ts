import { test } from "node:test";
import assert from "node:assert/strict";
import { dagenSinds, isVerouderd, roosterNaarTekst, vervangRoosterGecheckt } from "./rooster";

test("dagenSinds telt hele dagen en geeft Infinity zonder datum", () => {
  assert.equal(dagenSinds("2026-07-01", "2026-07-25"), 24);
  assert.equal(dagenSinds("2026-07-25", "2026-07-25"), 0);
  assert.equal(dagenSinds(undefined, "2026-07-25"), Infinity);
});

test("isVerouderd vergelijkt strikt met de drempel", () => {
  assert.equal(isVerouderd("2026-05-01", "2026-07-25", 60), true);
  assert.equal(isVerouderd("2026-07-01", "2026-07-25", 60), false);
  assert.equal(isVerouderd("2026-05-26", "2026-07-25", 60), false); // precies 60
  assert.equal(isVerouderd(undefined, "2026-07-25", 60), true);
});

test("roosterNaarTekst maakt leesbare regels", () => {
  assert.equal(
    roosterNaarTekst([
      { dag: "dagelijks", tijden: "11:00 en 15:00" },
      { dag: "zondag", tijden: "14:00" },
    ]),
    "- dagelijks: 11:00 en 15:00\n- zondag: 14:00",
  );
});

test("vervangRoosterGecheckt vervangt een bestaande regel met minimale diff", () => {
  const raw = `---\nslug: test\nroosterGecheckt: 2026-01-01\nnaam: Test\n---\n\nBody blijft staan.\n`;
  const out = vervangRoosterGecheckt(raw, "2026-07-25");
  assert.equal(out, `---\nslug: test\nroosterGecheckt: 2026-07-25\nnaam: Test\n---\n\nBody blijft staan.\n`);
});

test("vervangRoosterGecheckt voegt de regel toe als hij ontbreekt", () => {
  const raw = `---\nslug: test\nnaam: Test\n---\n\nBody.\n`;
  const out = vervangRoosterGecheckt(raw, "2026-07-25");
  assert.equal(out, `---\nslug: test\nnaam: Test\nroosterGecheckt: 2026-07-25\n---\n\nBody.\n`);
});

test("vervangRoosterGecheckt raakt de body niet aan (ook niet met --- in de body)", () => {
  const raw = `---\nslug: test\nroosterGecheckt: 2026-01-01\n---\n\nTekst.\n\n---\n\nMeer tekst met roosterGecheckt: nep.\n`;
  const out = vervangRoosterGecheckt(raw, "2026-07-25")!;
  assert.ok(out.includes("roosterGecheckt: 2026-07-25\n---"));
  assert.ok(out.includes("Meer tekst met roosterGecheckt: nep."));
});

test("vervangRoosterGecheckt geeft null zonder frontmatter", () => {
  assert.equal(vervangRoosterGecheckt("Gewoon tekst zonder frontmatter.", "2026-07-25"), null);
});
