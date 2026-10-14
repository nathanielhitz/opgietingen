import { test } from "node:test";
import assert from "node:assert/strict";
import type { Gids } from "../../src/lib/content";
import { bouwPosts } from "../../src/lib/social";
import { bouwCaption, doelPad, hashtags } from "../../src/lib/social-captions";
import { eersteZinnen, gidsPunten, kiesGids, MAX_PUNTEN, schoneTekst } from "../../src/lib/social-gids";
import { bouwPlanning } from "../../src/lib/social-planning";
import { maakEvent } from "./social-fixtures";

/*
  Rubriek Saunagids: punten uit de MDX-body, weekrotatie over de gidsen en
  de post/caption/planning die daaruit volgt.
*/

function maakGids(o: Partial<Gids> & { slug: string }): Gids {
  return { titel: `Gids ${o.slug}`, samenvatting: `Samenvatting van ${o.slug}.`, producten: [], body: "", ...o };
}

const ETIQUETTE = `
Een opgieting is een gedeeld ritueel. Daarom kent de opgietsauna een eigen etiquette.

## Voor de opgieting

**1. Kom op tijd.** Bij vrijwel elke sauna gaat de deur dicht zodra de opgieting begint. Kom enkele minuten van tevoren.

**2. Douche vooraf.** Fris de sauna in is de basisregel van elke saunagang, maar bij een volle [opgietsauna](/gids/x) telt hij **dubbel**.

## Tijdens de opgieting

**3. Praat niet.** De opgieting is het moment van de saunameester en van de stilte.

## Verschillen per sauna

Niet elke sauna is even streng. Vraag het bij twijfel na.
`;

test("gidsPunten: vette aanzetten worden punten, kop zonder nummer en leesteken, tekst zonder markdown", () => {
  const punten = gidsPunten(ETIQUETTE);
  assert.deepEqual(
    punten.map((p) => p.kop),
    ["Kom op tijd", "Douche vooraf", "Praat niet", "Verschillen per sauna"],
  );
  assert.equal(punten[0].tekst, "Bij vrijwel elke sauna gaat de deur dicht zodra de opgieting begint. Kom enkele minuten van tevoren.");
  assert.equal(punten[1].tekst, "Fris de sauna in is de basisregel van elke saunagang, maar bij een volle opgietsauna telt hij dubbel.");
  // Sectie zonder aanzetten: de kop met de eerste alinea.
  assert.equal(punten[3].tekst, "Niet elke sauna is even streng. Vraag het bij twijfel na.");
});

test("gidsPunten: inleiding zonder aanzet telt niet mee; sectie met alleen een JSX-tag valt weg", () => {
  const body = `Inleiding zonder vet.\n\n## Alles op een rij\n\n<ProductGrid />\n\n## Onze keuze\n\nBegin met eucalyptus. Fris en verkwikkend.\n`;
  assert.deepEqual(gidsPunten(body), [{ kop: "Onze keuze", tekst: "Begin met eucalyptus. Fris en verkwikkend." }]);
});

test("gidsPunten: aanzet met dubbele punt krijgt een hoofdletter, aanzet midden in de zin loopt door", () => {
  const body = `## Waar let je op?\n\n- **Materiaal:** wolvilt isoleert het best.\n- **Badstof** is dik en zacht.\n- **Epilepsie of operaties** .\n`;
  assert.deepEqual(gidsPunten(body), [
    { kop: "Materiaal", tekst: "Wolvilt isoleert het best." },
    { kop: "Badstof", tekst: "Badstof is dik en zacht." },
  ]);
});

test("gidsPunten: lijstitems met ingesprongen vervolgregels zijn één punt; maximaal MAX_PUNTEN", () => {
  const items = Array.from({ length: 9 }, (_, i) => `${i + 1}. **Stap ${i + 1}.** Eerste regel van stap ${i + 1}\n   loopt door op de volgende regel.`).join("\n");
  const punten = gidsPunten(`## Stappen\n\n${items}\n`);
  assert.equal(punten.length, MAX_PUNTEN);
  assert.equal(punten[0].tekst, "Eerste regel van stap 1 loopt door op de volgende regel.");
});

test("eersteZinnen: zoveel hele zinnen als passen, anders de eerste zin afgekapt; geen em-streepjes", () => {
  assert.equal(eersteZinnen("Een. Twee twee. Drie drie drie.", 12), "Een.");
  assert.equal(eersteZinnen("Een. Twee twee. Drie drie drie.", 16), "Een. Twee twee.");
  assert.match(eersteZinnen("Een zin die veel te lang is om in twintig tekens te passen.", 20), /…$/);
  assert.equal(schoneTekst("Sterk **vet** en een [link](/x) — met streepje"), "Sterk vet en een link, met streepje");
});

test("kiesGids: rotatie op weeknummer over de gidsen op slug, stabiel bij een andere invoervolgorde", () => {
  const gidsen = [maakGids({ slug: "c" }), maakGids({ slug: "a" }), maakGids({ slug: "b" })];
  assert.equal(kiesGids(gidsen, 42)?.slug, "a"); // 42 % 3 = 0
  assert.equal(kiesGids(gidsen, 43)?.slug, "b");
  assert.equal(kiesGids([...gidsen].reverse(), 44)?.slug, "c");
  assert.equal(kiesGids([], 42), undefined);
});

const gids = maakGids({
  slug: "aufguss-etiquette",
  titel: "Aufguss-etiquette: de ongeschreven regels",
  samenvatting: "Op tijd komen, blijven zitten,\n  niet kletsen: de etiquette in tien regels.",
  afbeelding: "/images/gidsen/etiquette.jpg",
  body: ETIQUETTE,
});

test("bouwPosts: gidspost op zondag van dezelfde ISO-week, zonder events, met cover, punten en afsluiter", () => {
  const vanafVrijdag = bouwPosts([], "2026-10-16", [gids]).find((p) => p.rubriek === "gids")!;
  assert.equal(vanafVrijdag.id, "gids-2026-W42");
  assert.equal(vanafVrijdag.plaatsingsdag, "2026-10-18");
  assert.equal(vanafVrijdag.titel, "Saunagids: Aufguss-etiquette: de ongeschreven regels");
  assert.deepEqual(vanafVrijdag.events, []);
  assert.equal(vanafVrijdag.gids?.samenvatting, "Op tijd komen, blijven zitten, niet kletsen: de etiquette in tien regels.");
  assert.deepEqual(
    vanafVrijdag.slides.map((s) => `${s.rol}:${s.pad}`),
    [
      "cover:/social/gids/aufguss-etiquette",
      "punt:/social/gids/aufguss-etiquette/1",
      "punt:/social/gids/aufguss-etiquette/2",
      "punt:/social/gids/aufguss-etiquette/3",
      "punt:/social/gids/aufguss-etiquette/4",
      "afsluiter:/social/afsluiter",
    ],
  );
  const vanafMaandag = bouwPosts([], "2026-10-12", [gids]).find((p) => p.rubriek === "gids")!;
  assert.equal(vanafMaandag.plaatsingsdag, "2026-10-18");
  assert.equal(vanafMaandag.id, vanafVrijdag.id);
  assert.equal(bouwPosts([], "2026-10-16").find((p) => p.rubriek === "gids"), undefined, "zonder gidsen geen gidspost");
});

test("captions gids: opening, genummerde punten, oproep naar de gids, gidstags; facebook linkt naar /gids/<slug>", () => {
  const post = bouwPosts([], "2026-10-16", [gids]).find((p) => p.rubriek === "gids")!;
  const ig = bouwCaption(post, "instagram");
  assert.match(ig, /^(Saunagids: Aufguss-etiquette: de ongeschreven regels\.|Op tijd komen, blijven zitten, niet kletsen: de etiquette in tien regels\.|Goed om te weten voor je volgende opgieting: )/);
  assert.match(ig, /\n1\. Kom op tijd\n2\. Douche vooraf\n3\. Praat niet\n4\. Verschillen per sauna\n/);
  assert.match(ig, /De hele gids via de link in bio\./);
  assert.ok(!ig.includes("📅"), "geen kalender-emoji zonder events");
  assert.deepEqual(hashtags(post, "instagram"), ["opgieting", "opgietingen", "aufguss", "sauna", "saunaliefhebbers", "wellness", "saunatips", "saunagids"]);
  assert.deepEqual(hashtags(post, "tiktok"), hashtags(post, "instagram"));
  assert.equal(doelPad(post), "/gids/aufguss-etiquette");
  const fb = bouwCaption(post, "facebook");
  assert.match(fb, /De hele gids: https:\/\/opgietingen\.nl\/gids\/aufguss-etiquette\?utm_source=facebook&utm_medium=social&utm_campaign=gids-2026-w42/);
  assert.match(fb, /#opgieting #aufguss #sauna$/);
});

test("captions gids: titel die op een vraagteken eindigt krijgt geen extra punt", () => {
  const vraag = maakGids({ slug: "hoed", titel: "Beste saunahoed 2026: welke kies je?", body: ETIQUETTE });
  const post = bouwPosts([], "2026-10-16", [vraag]).find((p) => p.rubriek === "gids")!;
  const openingen = ["2026-10-18", "2026-10-25", "2026-11-01"].map((plaatsingsdag) => bouwCaption({ ...post, plaatsingsdag }, "instagram").split("\n")[0]);
  for (const o of openingen) assert.ok(!o.includes("?."), o);
});

test("bouwPlanning: gidspost draagt het gids-veld, eventposts niet", () => {
  const planning = bouwPlanning([maakEvent({ slug: "we", startDatum: "2026-10-17" })], "2026-10-16", "https://opgietingen.nl", null, [gids]);
  const gidsPost = planning.posts.find((p) => p.rubriek === "gids")!;
  assert.equal(gidsPost.gids?.slug, "aufguss-etiquette");
  assert.equal(gidsPost.gids?.punten.length, 4);
  assert.equal(gidsPost.slides[1].story, "https://opgietingen.nl/social/gids/aufguss-etiquette/1?formaat=story");
  assert.ok(!("gids" in planning.posts.find((p) => p.rubriek === "weekend")!));
});
