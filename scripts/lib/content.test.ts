import { test } from "node:test";
import assert from "node:assert/strict";
import {
  afwijsKey,
  existingAfwijsIndex,
  existingSaunaSlugs,
  existingTitelDatumIndex,
  facebookPaginanaam,
  isVertrouwdeAfzender,
  matchBronByContent,
  normalizeProseDashes,
  normalizeRangeDashes,
  titelDatumKey,
  type Bron,
} from "./content";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("existingSaunaSlugs bevat bekende profielen", () => {
  const slugs = existingSaunaSlugs();
  assert.ok(slugs instanceof Set);
  assert.ok(slugs.has("thermen-bussloo"), "verwacht thermen-bussloo als bestaand profiel");
  assert.ok(slugs.size >= 5);
});

test("titelDatumKey negeert hoofdletters en interpunctie in de titel", () => {
  // De keten-sauna's schreven "Aufguss Challenge Finale" en "Aufguss challenge
  // finale" — dezelfde aankondiging, andere spelling.
  assert.equal(
    titelDatumKey("Aufguss Challenge Finale", "2026-10-02"),
    titelDatumKey("Aufguss challenge finale", "2026-10-02"),
  );
});

test("titelDatumKey scheidt een andere titel en een andere datum", () => {
  assert.notEqual(
    titelDatumKey("Aufguss challenge finale", "2026-10-02"),
    titelDatumKey("BeWellness Aufguss Challenge - Finale", "2026-10-02"),
  );
  assert.notEqual(
    titelDatumKey("Aufguss challenge finale", "2026-10-02"),
    titelDatumKey("Aufguss challenge finale", "2026-10-03"),
  );
});

test("existingTitelDatumIndex wijst de finale van 2 oktober aan één sauna toe", () => {
  // Vijf sauna's kondigden dezelfde finale aan; de index houdt per
  // titel+datum één vindplaats vast zodat de kopieën herkenbaar zijn.
  const index = existingTitelDatumIndex();
  const sauna = index.get(titelDatumKey("Aufguss challenge finale", "2026-10-02"));
  assert.equal(typeof sauna, "string");
  assert.ok(sauna && sauna.length > 0);
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

/* ---------- matchBronByContent (doorgestuurde Facebook-posts) ---------- */

// Minimale geldige bron voor matching-tests; overrides vullen de rest in.
function testBron(overrides: Partial<Bron> & Pick<Bron, "id">): Bron {
  return {
    naam: overrides.id,
    land: "NL",
    agendaUrl: "",
    status: "actief",
    ...overrides,
  };
}

test("facebookPaginanaam haalt de paginanaam uit URL-varianten", () => {
  assert.equal(facebookPaginanaam("https://www.facebook.com/ThermenBinnenmaas"), "thermenbinnenmaas");
  assert.equal(facebookPaginanaam("https://m.facebook.com/ThermenBinnenmaas/"), "thermenbinnenmaas");
  assert.equal(facebookPaginanaam("facebook.com/SaunaDrome"), "saunadrome");
  // Generieke segmenten zijn geen paginanaam (oude pages/-URLs, share-links).
  assert.equal(facebookPaginanaam("https://www.facebook.com/pages/Thermen/12345"), undefined);
  assert.equal(facebookPaginanaam(undefined), undefined);
  assert.equal(facebookPaginanaam("https://voorbeeld.nl/geen-facebook"), undefined);
});

test("matchBronByContent matcht een post-URL op het facebook-veld", () => {
  const bronnen = [
    testBron({ id: "thermen-binnenmaas", facebook: "https://www.facebook.com/ThermenBinnenmaas" }),
    testBron({ id: "sauna-drome", facebook: "https://www.facebook.com/SaunaDrome" }),
  ];
  const tekst =
    "Opgietweekend! https://www.facebook.com/ThermenBinnenmaas/posts/pfbid02ZGUKAGG6j6F695uQJtEgrpd1Kp";
  assert.equal(matchBronByContent(bronnen, tekst)?.id, "thermen-binnenmaas");
});

test("matchBronByContent is hoofdletter- en m.facebook-ongevoelig", () => {
  const bronnen = [testBron({ id: "thermen-binnenmaas", facebook: "https://www.facebook.com/ThermenBinnenmaas" })];
  assert.equal(matchBronByContent(bronnen, "zie M.FACEBOOK.COM/thermenbinnenmaas/")?.id, "thermen-binnenmaas");
});

test("matchBronByContent gokt niet bij ambiguïteit", () => {
  const bronnen = [
    testBron({ id: "sauna-a", facebook: "https://www.facebook.com/SaunaA" }),
    testBron({ id: "sauna-b", facebook: "https://www.facebook.com/SaunaB" }),
  ];
  // Twee paginanamen in één mail → geen match.
  const tekst = "facebook.com/SaunaA en facebook.com/SaunaB doen allebei mee!";
  assert.equal(matchBronByContent(bronnen, tekst), undefined);
});

test("matchBronByContent valt terug op het website-domein, alleen bij een unieke hit", () => {
  const bronnen = [
    testBron({ id: "thermen-bussloo", website: "https://www.thermenbussloo.nl" }),
    testBron({ id: "sauna-drome", website: "https://saunadrome-putten.nl" }),
  ];
  assert.equal(
    matchBronByContent(bronnen, "Kijk op www.thermenbussloo.nl/agenda voor tijden.")?.id,
    "thermen-bussloo",
  );
  // Twee domeinen in de tekst → ambigu → geen match.
  assert.equal(
    matchBronByContent(bronnen, "thermenbussloo.nl en saunadrome-putten.nl"),
    undefined,
  );
  // Lege tekst → geen match.
  assert.equal(matchBronByContent(bronnen, "   "), undefined);
});

test("matchBronByContent matcht geen domein dat als substring in een langer domein zit", () => {
  const bronnen = [testBron({ id: "thermen", website: "https://thermen.nl" })];
  assert.equal(matchBronByContent(bronnen, "Zie www.grootthermen.nl voor tijden."), undefined);
  // Een subdomein van de bron zelf blijft wél matchen.
  assert.equal(matchBronByContent(bronnen, "Zie www.thermen.nl voor tijden.")?.id, "thermen");
});

test("facebookPaginanaam en matchBronByContent negeren nep-facebook-hosts", () => {
  assert.equal(facebookPaginanaam("https://myfacebook.com/ThermenBinnenmaas"), undefined);
  const bronnen = [testBron({ id: "thermen-binnenmaas", facebook: "https://www.facebook.com/ThermenBinnenmaas" })];
  assert.equal(matchBronByContent(bronnen, "zie myfacebook.com/ThermenBinnenmaas"), undefined);
});

test("matchBronByContent matcht geen host met een vervolg-domeinlabel erachter", () => {
  const bronnen = [testBron({ id: "thermen-bussloo", website: "https://www.thermenbussloo.nl" })];
  // host.tld.evil.tld mag niet matchen …
  assert.equal(matchBronByContent(bronnen, "zie thermenbussloo.nl.evil-tracker.ru"), undefined);
  // … maar een zin-afsluitende punt en een pad erachter wél.
  assert.equal(matchBronByContent(bronnen, "Kijk op thermenbussloo.nl.")?.id, "thermen-bussloo");
  assert.equal(matchBronByContent(bronnen, "zie thermenbussloo.nl/agenda")?.id, "thermen-bussloo");
});

/* ---------- isVertrouwdeAfzender ---------- */

test("isVertrouwdeAfzender vergelijkt op volledig adres, case-insensitief", () => {
  const lijst = "Nathaniel@Example.com, tweede@example.com";
  assert.equal(isVertrouwdeAfzender("nathaniel@example.com", lijst), true);
  assert.equal(isVertrouwdeAfzender("  TWEEDE@EXAMPLE.COM ", lijst), true);
});

test("isVertrouwdeAfzender is false zonder lijst of bij deel-match", () => {
  assert.equal(isVertrouwdeAfzender("nathaniel@example.com", undefined), false);
  assert.equal(isVertrouwdeAfzender("nathaniel@example.com", ""), false);
  // Deel-matches en domein-matches tellen niet: het volledige adres moet kloppen.
  assert.equal(isVertrouwdeAfzender("evil-nathaniel@example.com", "nathaniel@example.com"), false);
  assert.equal(isVertrouwdeAfzender("iemand@example.com", "nathaniel@example.com"), false);
  assert.equal(isVertrouwdeAfzender("", "nathaniel@example.com"), false);
  // Een kaal domein als lijst-item mag nooit matchen (borgt tegen substring-refactors).
  assert.equal(isVertrouwdeAfzender("iemand@example.com", "example.com"), false);
});

test("existingAfwijsIndex kent alleen events met status afgewezen, per sauna en zonder datum", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afwijs-"));
  const schrijf = (naam: string, fm: string) => fs.writeFileSync(path.join(dir, `${naam}.mdx`), `---\n${fm}\n---\n`);
  schrijf("a", 'saunaSlug: asanti\ntitel: "Nationale Saunaweek Asanti"\nstartDatum: 2026-09-14\nstatus: afgewezen');
  schrijf("b", 'saunaSlug: asanti\ntitel: "Aufguss weekend"\nstartDatum: 2026-10-01\nstatus: concept');
  schrijf("c", 'saunaSlug: elaisa\ntitel: "Ode to Japan"\nstartDatum: 2026-09-05'); // geen status = gepubliceerd
  try {
    const index = existingAfwijsIndex(dir);
    assert.equal(index.size, 1);
    // Zelfde titel, andere editie/datum, andere schrijfwijze → hit.
    assert.equal(index.get(afwijsKey("asanti", "nationale saunaweek asanti!")), "Nationale Saunaweek Asanti");
    // Zelfde titel bij een andere sauna → geen hit (afwijzing is per sauna).
    assert.equal(index.get(afwijsKey("elaisa", "Nationale Saunaweek Asanti")), undefined);
    // Concept en gepubliceerd tellen niet als afwijzing.
    assert.equal(index.get(afwijsKey("asanti", "Aufguss weekend")), undefined);
    assert.equal(index.get(afwijsKey("elaisa", "Ode to Japan")), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
