import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEvent, isRealIsoDate, type GateInput, type GateContext } from "./quality-gate";

const ctx: GateContext = {
  saunaSlugs: new Set(["thermen-bussloo"]),
  today: "2026-07-11",
};

function ev(overrides: Partial<GateInput> = {}): GateInput {
  return {
    saunaSlug: "thermen-bussloo",
    titel: "Aufguss-avond met vuurshow",
    type: "thema",
    startDatum: "2026-09-19",
    beschrijving: "Een sfeervolle opgieting met muziek.",
    ...overrides,
  };
}

test("volledig geldig event komt door de poort", () => {
  const r = evaluateEvent(ev(), ctx);
  assert.equal(r.passed, true);
  assert.deepEqual(r.redenen, []);
});

test("datum in het verleden wordt afgekeurd", () => {
  const r = evaluateEvent(ev({ startDatum: "2026-01-01" }), ctx);
  assert.equal(r.passed, false);
  assert.ok(r.redenen.some((m) => m.includes("verleden")));
});

test("event vandaag telt als toekomst (niet afgekeurd op datum)", () => {
  const r = evaluateEvent(ev({ startDatum: "2026-07-11" }), ctx);
  assert.ok(!r.redenen.some((m) => m.includes("verleden")));
});

test("ongeldig datumformaat wordt afgekeurd", () => {
  const r = evaluateEvent(ev({ startDatum: "19-09-2026" }), ctx);
  assert.equal(r.passed, false);
  assert.ok(r.redenen.some((m) => m.includes("datum")));
});

test("niet-bestaande kalenderdatum wordt afgekeurd", () => {
  const r = evaluateEvent(ev({ startDatum: "2026-13-40" }), ctx);
  assert.equal(r.passed, false);
});

test("onbekende saunaSlug wordt afgekeurd", () => {
  const r = evaluateEvent(ev({ saunaSlug: "bestaat-niet" }), ctx);
  assert.equal(r.passed, false);
  assert.ok(r.redenen.some((m) => m.includes("saunaSlug")));
});

test("lege titel wordt afgekeurd", () => {
  const r = evaluateEvent(ev({ titel: "   " }), ctx);
  assert.equal(r.passed, false);
  assert.ok(r.redenen.some((m) => m.includes("titel")));
});

test("ongeldig type wordt afgekeurd", () => {
  const r = evaluateEvent(ev({ type: "brunch" }), ctx);
  assert.equal(r.passed, false);
  assert.ok(r.redenen.some((m) => m.includes("type")));
});

test("niet-opgiet-event zonder trefwoord wordt afgekeurd", () => {
  const r = evaluateEvent(
    ev({ titel: "Moederdagbrunch", beschrijving: "Geniet van een luxe buffet." }),
    ctx,
  );
  assert.equal(r.passed, false);
  assert.ok(r.redenen.some((m) => m.includes("opgiet")));
});

test("trefwoord in beschrijving volstaat", () => {
  const r = evaluateEvent(
    ev({ titel: "Speciale avond", beschrijving: "Met löyly en saunaritueel." }),
    ctx,
  );
  assert.ok(!r.redenen.some((m) => m.includes("opgiet")));
});

test("meerdere problemen worden allemaal gerapporteerd", () => {
  const r = evaluateEvent(
    ev({ saunaSlug: "bestaat-niet", startDatum: "2020-01-01", titel: "" }),
    ctx,
  );
  assert.equal(r.passed, false);
  assert.ok(r.redenen.length >= 3);
});

test("isRealIsoDate", () => {
  assert.equal(isRealIsoDate("2026-09-19"), true);
  assert.equal(isRealIsoDate("2026-13-01"), false);
  assert.equal(isRealIsoDate("2026-02-30"), false);
  assert.equal(isRealIsoDate("19-09-2026"), false);
});
