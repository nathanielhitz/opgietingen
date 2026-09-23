// scripts/lib/social-buffer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlanningPost } from "../../src/lib/social-planning";
import {
  besluit,
  bouwInput,
  commitKomtOvereen,
  dueAtVoor,
  formatNlTijd,
  INSTAGRAM_TYPE,
  kiesPosts,
  ontdekKanalen,
  overridesUitEnv,
  PLAATSINGSTIJD,
  resultaatTabel,
  tiktokTitel,
  type Resultaat,
} from "./social-buffer";

/** Minimale planning-post; velden overschrijfbaar per test. */
function maakPost(o: Partial<PlanningPost> & { id: string; rubriek: PlanningPost["rubriek"]; plaatsingsdag: string }): PlanningPost {
  return {
    rang: 1,
    titel: `Post ${o.id}`,
    periode: { van: o.plaatsingsdag, tot: o.plaatsingsdag },
    events: [],
    slides: [
      { rol: "cover", feed: `https://opgietingen.nl/social/weekend/2026-W40?formaat=feed`, story: `https://opgietingen.nl/social/weekend/2026-W40?formaat=story` },
      { rol: "event", eventSlug: "ev", feed: `https://opgietingen.nl/social/event/ev?formaat=feed`, story: `https://opgietingen.nl/social/event/ev?formaat=story` },
      { rol: "afsluiter", feed: `https://opgietingen.nl/social/afsluiter?formaat=feed`, story: `https://opgietingen.nl/social/afsluiter?formaat=story` },
    ],
    captions: { instagram: "IG", facebook: "FB", tiktok: "TT" },
    ...o,
  };
}

// Maandag 28 september 2026, 07:31 UTC: het run-moment van de workflow.
const NU = new Date("2026-09-28T07:31:00.000Z");

test("PLAATSINGSTIJD: vaste NL-tijden per rubriek", () => {
  assert.deepEqual(PLAATSINGSTIJD, { nieuw: "17:00", uitgelicht: "19:00", weekend: "12:00", maand: "10:00" });
});

test("dueAtVoor: plaatsingsdag + rubriektijd in NL-tijd, als UTC", () => {
  assert.equal(dueAtVoor({ rubriek: "weekend", plaatsingsdag: "2026-10-02" }, NU), "2026-10-02T10:00:00.000Z"); // vr 12:00 CEST
  assert.equal(dueAtVoor({ rubriek: "nieuw", plaatsingsdag: "2026-09-28" }, NU), "2026-09-28T15:00:00.000Z"); // ma 17:00 CEST
  assert.equal(dueAtVoor({ rubriek: "maand", plaatsingsdag: "2026-11-01" }, NU), "2026-11-01T09:00:00.000Z"); // zo 10:00 CET
});

test("dueAtVoor: verstreken tijdstip wordt nu + 15 minuten, op de minuut", () => {
  const laat = new Date("2026-09-28T16:00:42.500Z"); // na 17:00 NL
  assert.equal(dueAtVoor({ rubriek: "nieuw", plaatsingsdag: "2026-09-28" }, laat), "2026-09-28T16:15:00.000Z");
  const precies = new Date("2026-09-28T15:00:00.000Z"); // exact op het tijdstip telt als verstreken
  assert.equal(dueAtVoor({ rubriek: "nieuw", plaatsingsdag: "2026-09-28" }, precies), "2026-09-28T15:15:00.000Z");
});

test("kiesPosts: alleen rang 1, verstreken plaatsingsdag valt weg, dueAt erbij", () => {
  const planning = {
    posts: [
      maakPost({ id: "nieuw-2026-W40", rubriek: "nieuw", plaatsingsdag: "2026-09-28" }),
      maakPost({ id: "uitgelicht-a", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30" }),
      maakPost({ id: "uitgelicht-b", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30", rang: 2 }),
      maakPost({ id: "uitgelicht-c", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30", rang: 3 }),
      maakPost({ id: "weekend-2026-W39", rubriek: "weekend", plaatsingsdag: "2026-09-25" }),
    ],
  };
  const { gekozen, overgeslagen } = kiesPosts(planning, "2026-09-28", NU, () => undefined);
  assert.deepEqual(gekozen.map((k) => k.post.id), ["nieuw-2026-W40", "uitgelicht-a"]);
  assert.equal(gekozen[0].dueAt, "2026-09-28T15:00:00.000Z");
  assert.equal(gekozen[1].dueAt, "2026-09-30T17:00:00.000Z");
  assert.deepEqual(
    overgeslagen.map((o) => [o.post.id, o.reden]),
    [
      ["uitgelicht-b", "kandidaat 2"],
      ["uitgelicht-c", "kandidaat 3"],
      ["weekend-2026-W39", "plaatsingsdag verstreken"],
    ],
  );
});

test("kiesPosts: lege planning geeft niets", () => {
  assert.deepEqual(kiesPosts({ posts: [] }, "2026-09-28", NU, () => undefined), { gekozen: [], overgeslagen: [] });
});

/** Drie uitgelicht-kandidaten voor woensdag 30 september, rang 1..3. */
function uitgelichtPlanning() {
  return {
    posts: [
      maakPost({ id: "uitgelicht-a", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30" }),
      maakPost({ id: "uitgelicht-b", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30", rang: 2 }),
      maakPost({ id: "uitgelicht-c", rubriek: "uitgelicht", plaatsingsdag: "2026-09-30", rang: 3 }),
    ],
  };
}

test("kiesPosts: rang 1 vorige week al uitgelicht, dan gaat rang 2", () => {
  const eerder = (id: string) => (id === "uitgelicht-a" ? "2026-09-23T17:00:00.000Z" : undefined);
  const { gekozen, overgeslagen } = kiesPosts(uitgelichtPlanning(), "2026-09-28", NU, eerder);
  assert.deepEqual(gekozen.map((k) => k.post.id), ["uitgelicht-b"]);
  assert.equal(gekozen[0].dueAt, "2026-09-30T17:00:00.000Z");
  assert.deepEqual(
    overgeslagen.map((o) => [o.post.id, o.reden]),
    [
      ["uitgelicht-a", "eerder al uitgelicht"],
      ["uitgelicht-c", "kandidaat 3"],
    ],
  );
});

test("kiesPosts: rang 1 al geplaatst op dezelfde plaatsingsdag is een herstart, rang 1 blijft gekozen", () => {
  // 19:00 NL op woensdag 30 september = 17:00 UTC.
  const eerder = (id: string) => (id === "uitgelicht-a" ? "2026-09-30T17:00:00.000Z" : undefined);
  const { gekozen, overgeslagen } = kiesPosts(uitgelichtPlanning(), "2026-09-28", NU, eerder);
  assert.deepEqual(gekozen.map((k) => k.post.id), ["uitgelicht-a"]);
  assert.deepEqual(
    overgeslagen.map((o) => [o.post.id, o.reden]),
    [
      ["uitgelicht-b", "kandidaat 2"],
      ["uitgelicht-c", "kandidaat 3"],
    ],
  );
});

test("kiesPosts: dezelfde plaatsingsdag telt in NL-tijd, niet in UTC", () => {
  // 23:30 UTC op dinsdag is woensdag 01:30 NL: dezelfde plaatsingsdag.
  const eerder = (id: string) => (id === "uitgelicht-a" ? "2026-09-29T23:30:00.000Z" : undefined);
  const { gekozen } = kiesPosts(uitgelichtPlanning(), "2026-09-28", NU, eerder);
  assert.deepEqual(gekozen.map((k) => k.post.id), ["uitgelicht-a"]);
});

test("kiesPosts: alle drie eerder uitgelicht, dan geen Uitgelicht deze week", () => {
  const { gekozen, overgeslagen } = kiesPosts(uitgelichtPlanning(), "2026-09-28", NU, () => "2026-09-16T17:00:00.000Z");
  assert.deepEqual(gekozen, []);
  assert.deepEqual(
    overgeslagen.map((o) => [o.post.id, o.reden]),
    [
      ["uitgelicht-a", "eerder al uitgelicht"],
      ["uitgelicht-b", "eerder al uitgelicht"],
      ["uitgelicht-c", "eerder al uitgelicht"],
    ],
  );
});

test("kiesPosts: andere rubrieken negeren eerdere plaatsingen (het grootboek beslist per kanaal)", () => {
  const planning = { posts: [maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" })] };
  const { gekozen } = kiesPosts(planning, "2026-09-28", NU, () => "2026-09-25T10:00:00.000Z");
  assert.deepEqual(gekozen.map((k) => k.post.id), ["weekend-2026-W40"]);
});

test("tiktokTitel: korte titel ongewijzigd, lange afgekapt op een woordgrens met …", () => {
  assert.equal(tiktokTitel("Dit weekend: 6 opgietingen"), "Dit weekend: 6 opgietingen");
  const lang = "Uitgelicht: " + "Opgietweekend Herfstgloed met internationale gastmeesters ".repeat(3);
  const kort = tiktokTitel(lang);
  assert.ok(kort.length <= 90, `lengte ${kort.length}`);
  assert.ok(kort.endsWith("…"));
  assert.ok(!kort.endsWith(" …"), "geen spatie vóór het beletselteken");
  assert.ok(lang.startsWith(kort.slice(0, -1)), "afgekapt op een woordgrens binnen de titel");
});

test("tiktokTitel: zonder spaties harde knip op codepoints, lengte binnen de limiet", () => {
  const lang = "x".repeat(120);
  const kort = tiktokTitel(lang);
  assert.ok(kort.length <= 90, `lengte ${kort.length}`);
  assert.ok(kort.endsWith("…"));
});

test("tiktokTitel: spatie precies op de laatste toegestane positie behoudt het woord ervoor", () => {
  const titel = "a".repeat(89) + " " + "b".repeat(40);
  const kort = tiktokTitel(titel);
  assert.equal(kort, "a".repeat(89) + "…");
});

const DUE = "2026-10-02T10:00:00.000Z";

test("bouwInput facebook: feed-slides in volgorde, FB-caption, ingepland, geen metadata", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "facebook", "ch_fb", DUE, { concept: false });
  assert.equal(input.channelId, "ch_fb");
  assert.equal(input.text, "FB");
  assert.deepEqual(
    input.assets.map((a) => a.image.url),
    [
      "https://opgietingen.nl/social/weekend/2026-W40?formaat=feed",
      "https://opgietingen.nl/social/event/ev?formaat=feed",
      "https://opgietingen.nl/social/afsluiter?formaat=feed",
    ],
  );
  assert.equal(input.schedulingType, "automatic");
  assert.equal(input.mode, "customScheduled");
  assert.equal(input.dueAt, DUE);
  assert.equal(input.needsApproval, false);
  assert.equal(input.saveToDraft, undefined);
  assert.equal(input.metadata, undefined);
});

test("bouwInput instagram: feed-slides, IG-caption, instagram-metadata", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "instagram", "ch_ig", DUE, { concept: false });
  assert.equal(input.text, "IG");
  assert.ok(input.assets.every((a) => a.image.url.endsWith("formaat=feed")));
  assert.deepEqual(input.metadata, { instagram: { type: INSTAGRAM_TYPE, shouldShareToFeed: true } });
});

test("bouwInput tiktok: story-slides, TT-caption, titel in metadata", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02", titel: "Dit weekend: 2 opgietingen" });
  const input = bouwInput(post, "tiktok", "ch_tt", DUE, { concept: false });
  assert.equal(input.text, "TT");
  assert.ok(input.assets.every((a) => a.image.url.endsWith("formaat=story")));
  assert.deepEqual(input.metadata, { tiktok: { title: "Dit weekend: 2 opgietingen", type: "post" } });
});

test("bouwInput concept: addToQueue + saveToDraft, zonder dueAt", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "facebook", "ch_fb", DUE, { concept: true });
  assert.equal(input.mode, "addToQueue");
  assert.equal(input.saveToDraft, true);
  assert.equal(input.dueAt, undefined);
});

test("ontdekKanalen: één per service, ontbrekende gemeld, service hoofdletterongevoelig", () => {
  const { ids, ontbrekend } = ontdekKanalen([
    { id: "ch_fb", name: "Opgietingen.nl", service: "Facebook" },
    { id: "ch_tt", name: "opgietingen.nl", service: "tiktok" },
    { id: "ch_x", name: "iets", service: "twitter" },
  ]);
  assert.deepEqual(ids, { facebook: "ch_fb", tiktok: "ch_tt" });
  assert.deepEqual(ontbrekend, ["instagram"]);
});

test("ontdekKanalen: twee van dezelfde service is een fout met de id's, tenzij een override kiest", () => {
  const kanalen = [
    { id: "ch_fb1", name: "Pagina 1", service: "facebook" },
    { id: "ch_fb2", name: "Pagina 2", service: "facebook" },
  ];
  assert.throws(() => ontdekKanalen(kanalen), /Meer dan één facebook-kanaal.*ch_fb1.*ch_fb2.*BUFFER_KANAAL_FACEBOOK/);
  const { ids } = ontdekKanalen(kanalen, { facebook: "ch_fb2" });
  assert.equal(ids.facebook, "ch_fb2");
});

test("ontdekKanalen: override-id die niet voorkomt onder de kanalen is een fout", () => {
  const kanalen = [{ id: "ch_fb1", name: "Pagina 1", service: "facebook" }];
  assert.throws(
    () => ontdekKanalen(kanalen, { facebook: "ch_onbekend" }),
    /BUFFER_KANAAL_FACEBOOK=ch_onbekend komt niet voor onder de Buffer-kanalen/,
  );
});

test("overridesUitEnv: leest BUFFER_KANAAL_<KANAAL>, lege waarden tellen niet", () => {
  assert.deepEqual(overridesUitEnv({ BUFFER_KANAAL_FACEBOOK: "ch_fb", BUFFER_KANAAL_INSTAGRAM: "" }), { facebook: "ch_fb" });
  assert.deepEqual(overridesUitEnv({}), {});
});

test("commitKomtOvereen: overeen, afwijkend of onbekend", () => {
  assert.equal(commitKomtOvereen("abc", "abc"), "overeen");
  assert.equal(commitKomtOvereen("abc", "def"), "afwijkend");
  assert.equal(commitKomtOvereen(null, "abc"), "onbekend");
  assert.equal(commitKomtOvereen("abc", undefined), "onbekend");
});

test("formatNlTijd: dag, datum en tijd in NL-tijd", () => {
  const tekst = formatNlTijd("2026-10-02T10:00:00.000Z");
  assert.match(tekst, /02-10/);
  assert.match(tekst, /12:00/);
  assert.ok(!tekst.includes(","));
});

test("resultaatTabel: markdown-tabel met één rij per resultaat, pipes in detail ontsnapt", () => {
  const regels: Resultaat[] = [
    { post: "weekend-2026-W40", kanaal: "facebook", dueAt: DUE, status: "ingepland", detail: "post_1" },
    { post: "weekend-2026-W40", kanaal: "instagram", dueAt: DUE, status: "kanaal ontbreekt", detail: "" },
    { post: "weekend-2026-W40", kanaal: "tiktok", dueAt: DUE, status: "mislukt", detail: "a | b" },
  ];
  const tabel = resultaatTabel(regels);
  const rijen = tabel.split("\n");
  assert.equal(rijen[0], "| Post | Kanaal | Plaatsing (NL) | Status | Detail |");
  assert.equal(rijen[1], "|---|---|---|---|---|");
  assert.equal(rijen.length, 5);
  assert.match(rijen[2], /^\| weekend-2026-W40 \| facebook \| .*12:00 \| ingepland \| post_1 \|$/);
  assert.match(rijen[4], /a \/ b/);
});

test("resultaatTabel: regeleindes in detail worden een spatie, blijft één rij", () => {
  const regels: Resultaat[] = [
    { post: "weekend-2026-W40", kanaal: "facebook", dueAt: DUE, status: "mislukt", detail: "regel1\nregel2" },
  ];
  const tabel = resultaatTabel(regels);
  const rijen = tabel.split("\n");
  assert.equal(rijen.length, 3);
  assert.match(rijen[2], /regel1 regel2/);
});

test("besluit: geen kanaal-id gaat voor alles", () => {
  for (const modus of ["inplannen", "concept", "dry-run"] as const) {
    for (const inGrootboek of [true, false]) {
      assert.equal(besluit({ kanaalId: undefined, inGrootboek, modus }), "kanaal ontbreekt");
      assert.equal(besluit({ kanaalId: "", inGrootboek, modus }), "kanaal ontbreekt");
    }
  }
});

test("besluit: alle combinaties met een kanaal-id", () => {
  assert.equal(besluit({ kanaalId: "k1", inGrootboek: true, modus: "inplannen" }), "al in Buffer");
  assert.equal(besluit({ kanaalId: "k1", inGrootboek: true, modus: "dry-run" }), "al in Buffer");
  assert.equal(besluit({ kanaalId: "k1", inGrootboek: true, modus: "concept" }), "maak");
  assert.equal(besluit({ kanaalId: "k1", inGrootboek: false, modus: "inplannen" }), "maak");
  assert.equal(besluit({ kanaalId: "k1", inGrootboek: false, modus: "concept" }), "maak");
  assert.equal(besluit({ kanaalId: "k1", inGrootboek: false, modus: "dry-run" }), "dry-run");
});
