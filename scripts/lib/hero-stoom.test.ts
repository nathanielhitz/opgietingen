// De stoomlaag is decoratief: vaste structuur, geen tekst, onzichtbaar voor
// hulptechnologie. Dit bewaakt de markup waar globals.css op leunt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HeroStoom from "../../src/components/HeroStoom";

test("HeroStoom rendert zes wolken en één gloed in een verborgen laag", () => {
  const html = renderToStaticMarkup(createElement(HeroStoom));
  assert.equal((html.match(/class="stoom-wolk"/g) ?? []).length, 6, "zes wolken verwacht");
  assert.equal((html.match(/class="stoom-gloed"/g) ?? []).length, 1, "één gloed verwacht");
  assert.match(html, /aria-hidden="true"/, "laag moet aria-hidden zijn");
  assert.match(html, /class="[^"]*\bhero-stoom\b/, "laag mist de klasse hero-stoom");
  assert.match(html, /pointer-events-none/, "laag mag geen kliks vangen");
  assert.equal(html.replace(/<[^>]+>/g, ""), "", "laag bevat geen tekst");
});

test("elke wolk heeft eigen duur, start en drift", () => {
  const html = renderToStaticMarkup(createElement(HeroStoom));
  const wolken = html.match(/<span class="stoom-wolk" style="[^"]*"><\/span>/g) ?? [];
  assert.equal(wolken.length, 6);
  for (const w of wolken) {
    assert.match(w, /--duur:\d+(\.\d+)?s/);
    assert.match(w, /--start:-?\d+(\.\d+)?s/);
    assert.match(w, /--drift:-\d+(\.\d+)?%/);
  }
  const starts = wolken.map((w) => w.match(/--start:(-?[\d.]+s)/)?.[1]);
  assert.equal(new Set(starts).size, 6, "startoffsets moeten uniek zijn, anders lopen wolken synchroon");
});
