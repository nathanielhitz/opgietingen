import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRobots, isPathAllowed } from "./net";
import { scoreUrl } from "./discovery";

test("parseRobots: wildcard-groep geldt voor ons", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /prive/");
  assert.equal(isPathAllowed(rules, "/prive/agenda"), false);
  assert.equal(isPathAllowed(rules, "/agenda"), true);
});

test("parseRobots: opeenvolgende User-agent-regels vormen één groep", () => {
  // De disallow geldt voor googlebot ÉN *, dus ook voor ons.
  const rules = parseRobots("User-agent: googlebot\nUser-agent: *\nDisallow: /x/");
  assert.equal(isPathAllowed(rules, "/x/pagina"), false);
});

test("parseRobots: groep van een andere bot geldt niet voor ons", () => {
  const rules = parseRobots("User-agent: googlebot\nDisallow: /x/");
  assert.equal(isPathAllowed(rules, "/x/pagina"), true);
});

test("parseRobots: generieke 'bot'-groep sluit ons niet buiten", () => {
  const rules = parseRobots("User-agent: bot\nDisallow: /");
  assert.equal(isPathAllowed(rules, "/agenda"), true);
});

test("parseRobots: prefix van onze naam matcht wel", () => {
  const rules = parseRobots("User-agent: opgietingen\nDisallow: /");
  assert.equal(isPathAllowed(rules, "/agenda"), false);
});

test("isPathAllowed: allow wint bij gelijke specificiteit, wildcards en $ werken", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /a/*.pdf$\nAllow: /a/open.pdf");
  assert.equal(isPathAllowed(rules, "/a/x.pdf"), false);
  assert.equal(isPathAllowed(rules, "/a/x.pdf?dl=1"), true); // $-anker: query erachter matcht niet
  assert.equal(isPathAllowed(rules, "/a/open.pdf"), true);
});

test("scoreUrl: agendapagina scoort, uitgesloten paden niet", () => {
  assert.ok(scoreUrl("https://x.nl/agenda")!.score >= 50);
  assert.equal(scoreUrl("https://x.nl/nieuws/agenda-tips"), null);
  assert.equal(scoreUrl("https://x.nl/spa"), null); // geen keyword → null
});

test("scoreUrl: incumbent-bonus laat de zittende URL winnen van een campagnepagina", () => {
  // De lago-brugge-case: campagnepagina met 'event' + matchToken versloeg de
  // gecureerde wellness-URL. Met incumbent-bonus wint de zittende URL weer.
  const huidig = "https://www.lago.be/nl/brugge/wellness/wellness-nights";
  const campagne = scoreUrl("https://www.lago.be/nl/brugge/events-acties/valentijn-2026", "brugge", huidig)!;
  const zittend = scoreUrl(huidig, "brugge", huidig)!;
  assert.ok(zittend.score > campagne.score, `${zittend.score} moet > ${campagne.score} zijn`);
});

test("scoreUrl: jaartal in het laatste segment krijgt een penalty", () => {
  const met = scoreUrl("https://x.nl/events/actie-2026", "")!;
  const zonder = scoreUrl("https://x.nl/events/acties", "")!;
  assert.ok(met.score < zonder.score);
});
