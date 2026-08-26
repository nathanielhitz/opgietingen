import { test } from "node:test";
import assert from "node:assert/strict";
import {
  periodeVoorKeuze,
  keuzeVoorPeriode,
  waarValue,
  parseWaar,
  labelVoorDatumbereik,
} from "../../src/lib/filter-presets";

// 2026-08-26 is een woensdag.
const wo = "2026-08-26";

test("periodeVoorKeuze: dit weekend vanaf woensdag = komende vr t/m zo", () => {
  assert.deepEqual(periodeVoorKeuze("weekend", wo), { van: "2026-08-28", tot: "2026-08-30" });
});

test("periodeVoorKeuze: dit weekend op zaterdag = vandaag t/m zondag", () => {
  assert.deepEqual(periodeVoorKeuze("weekend", "2026-08-29"), { van: "2026-08-29", tot: "2026-08-30" });
});

test("periodeVoorKeuze: komende 30 dagen", () => {
  assert.deepEqual(periodeVoorKeuze("30dagen", wo), { van: wo, tot: "2026-09-25" });
});

test("periodeVoorKeuze: deze maand loopt t/m maandeinde", () => {
  assert.deepEqual(periodeVoorKeuze("dezeMaand", wo), { van: wo, tot: "2026-08-31" });
  assert.deepEqual(periodeVoorKeuze("dezeMaand", "2028-02-10"), { van: "2028-02-10", tot: "2028-02-29" });
});

test("periodeVoorKeuze: volgende maand, ook over jaargrens", () => {
  assert.deepEqual(periodeVoorKeuze("volgendeMaand", wo), { van: "2026-09-01", tot: "2026-09-30" });
  assert.deepEqual(periodeVoorKeuze("volgendeMaand", "2026-12-15"), { van: "2027-01-01", tot: "2027-01-31" });
});

test("periodeVoorKeuze: alles en custom leveren null", () => {
  assert.equal(periodeVoorKeuze("alles", wo), null);
  assert.equal(periodeVoorKeuze("custom", wo), null);
});

test("keuzeVoorPeriode: round-trip voor elke snelkeuze", () => {
  for (const keuze of ["weekend", "30dagen", "dezeMaand", "volgendeMaand"] as const) {
    const p = periodeVoorKeuze(keuze, wo)!;
    assert.equal(keuzeVoorPeriode(p.van, p.tot, wo), keuze);
  }
});

test("keuzeVoorPeriode: leeg = alles, afwijkend = custom", () => {
  assert.equal(keuzeVoorPeriode("", "", wo), "alles");
  assert.equal(keuzeVoorPeriode("2026-09-01", "", wo), "custom");
  assert.equal(keuzeVoorPeriode("2026-09-01", "2026-09-15", wo), "custom");
});

test("waarValue/parseWaar round-trip", () => {
  assert.equal(waarValue("", ""), "");
  assert.equal(waarValue("NL", ""), "NL");
  assert.equal(waarValue("BE", "antwerpen"), "BE:antwerpen");
  assert.deepEqual(parseWaar(""), { land: "", provincie: "" });
  assert.deepEqual(parseWaar("NL"), { land: "NL", provincie: "" });
  assert.deepEqual(parseWaar("BE:antwerpen"), { land: "BE", provincie: "antwerpen" });
  assert.deepEqual(parseWaar("XX:foo"), { land: "", provincie: "" });
});

test("labelVoorDatumbereik: snelkeuze-naam als het bereik matcht", () => {
  const p = periodeVoorKeuze("weekend", wo)!;
  assert.equal(labelVoorDatumbereik(p.van, p.tot, wo), "Dit weekend");
});

test("labelVoorDatumbereik: vrije bereiken", () => {
  assert.equal(labelVoorDatumbereik("2026-09-01", "2026-09-15", wo), "1 sep – 15 sep");
  assert.equal(labelVoorDatumbereik("2026-09-01", "", wo), "vanaf 1 sep");
  assert.equal(labelVoorDatumbereik("", "2026-09-15", wo), "t/m 15 sep");
  assert.equal(labelVoorDatumbereik("2026-12-20", "2027-01-05", wo), "20 dec 2026 – 5 jan 2027");
});
