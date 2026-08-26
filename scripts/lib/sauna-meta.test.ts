import { test } from "node:test";
import assert from "node:assert/strict";
import { saunaMetaDescription, MAX_DESCRIPTION } from "../../src/lib/sauna-meta";

const basis = { naam: "Sauna Zwaluwhoeve", plaats: "Hierden", provincie: "Gelderland" };

test("met events: aantal + eerstvolgende datum", () => {
  const d = saunaMetaDescription({ ...basis, komende: [{ startDatum: "2026-09-12" }, { startDatum: "2026-10-03" }], heeftRooster: false });
  assert.ok(d.startsWith("Sauna Zwaluwhoeve in Hierden: 2 komende opgietingen, eerstvolgende op 12 september 2026."), d);
  assert.ok(/tickets/.test(d), d);
  assert.ok(d.length <= MAX_DESCRIPTION, `${d.length}: ${d}`);
});

test("één event: enkelvoud", () => {
  const d = saunaMetaDescription({ ...basis, komende: [{ startDatum: "2026-09-12" }], heeftRooster: true });
  assert.ok(d.includes("1 komende opgieting,"), d);
  assert.ok(d.includes("Vaste opgiettijden"), d);
});

test("zonder events maar met rooster: rooster als hook, provincie als vangnet", () => {
  const d = saunaMetaDescription({ ...basis, komende: [], heeftRooster: true });
  assert.ok(/vaste opgiettijden/i.test(d), d);
  assert.ok(d.includes("Gelderland"), d);
  assert.ok(!/komende opgietingen,/.test(d), d);
  assert.ok(d.length <= MAX_DESCRIPTION, `${d.length}: ${d}`);
});

test("zonder events en zonder rooster: geen valse belofte", () => {
  const d = saunaMetaDescription({ ...basis, komende: [], heeftRooster: false });
  assert.ok(/Nog geen events gepland/.test(d), d);
  assert.ok(!/tickets/.test(d), d);
});

test("plaats niet herhaald als die in de naam zit", () => {
  const d = saunaMetaDescription({ naam: "Thermen Bussloo", plaats: "Bussloo", provincie: "Gelderland", komende: [], heeftRooster: true });
  assert.ok(d.startsWith("Thermen Bussloo:"), d);
});
