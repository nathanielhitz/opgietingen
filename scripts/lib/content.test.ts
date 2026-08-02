import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existingSaunaSlugs,
  existingTitelDatumIndex,
  facebookPaginanaam,
  matchBronByContent,
  normalizeProseDashes,
  normalizeRangeDashes,
  titelDatumKey,
  type Bron,
} from "./content";

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
