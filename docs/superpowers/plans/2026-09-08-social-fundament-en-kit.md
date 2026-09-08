# Social-fundament en wekelijkse social-kit — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De site verwijst naar de nieuwe sociale kanalen (footer, schema, link-in-bio, deelknoppen) en genereert elke week huisstijl-slides plus captions uit de agenda, op te halen met `npm run social-kit` en later door een Buffer-adapter.

**Architecture:** Pure selectie- en captionlogica in `src/lib/social*.ts` (testbaar met node:test) wordt door dunne route-handlers onder `src/app/social/…` gerenderd met `ImageResponse` uit `next/og`, en door `/social/planning` als JSON geserveerd. Het lokale script haalt planning en beelden van de productiesite en schrijft ze naar `data/social/`. Fundament: één `socials`-config in `src/lib/site.ts` voedt footer, over-pagina, schema en `/links`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, `next/og` (satori), node:test via tsx, Keystatic-schema's, Tailwind v4-tokens.

**Spec:** `docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md`. Drie bewuste afwijkingen van de spec staan in §"Afwijkingen" onderaan en zijn ook in de spec verwerkt.

**Werkwijze:** implementeer in een aparte git-worktree (conventie bij parallelle sessies), commit per taak, run `npm run test` na elke taak en `npm run build && npm run lint` aan het eind. Alle UI-teksten, commits en comments in het Nederlands.

---

## Bestandsoverzicht

**Nieuw**
- `src/lib/utm.ts` — `utmUrl`, `kanaalUitParam`
- `src/lib/links-in-bio.ts` — knoppenlijst voor `/links`
- `src/lib/social.ts` — types, selectieregels, `bouwPosts`
- `src/lib/social-captions.ts` — `bouwCaption`, `hashtags`
- `src/lib/social-planning.ts` — `bouwPlanning` (JSON-contract)
- `src/lib/social-stijl.ts` — kleuren/formaten voor satori
- `src/lib/social-fonts.ts` — Fraunces/Inter laden voor satori
- `src/lib/social-render.tsx` — `slideResponse`, `parseFormaat`, `beeldUrlAlsAanwezig`
- `src/lib/social-slides.tsx` — slide-componenten
- `src/components/SocialLinks.tsx`, `src/components/EventDeelKnoppen.tsx`
- `src/app/(site)/links/page.tsx`
- `src/app/social/{weekend/[week],maand/[maand],nieuw/[datum],event/[slug],afsluiter,profiel,omslag}/route.tsx`, `src/app/social/planning/route.ts`
- `scripts/social-kit.ts`, `scripts/lib/social-kit.ts`, `scripts/vind-instagram.ts`
- Tests: `scripts/lib/social.test.ts`, `scripts/lib/social-captions.test.ts`, `scripts/lib/social-planning.test.ts`, `scripts/lib/social-links.test.ts`, `scripts/lib/social-kit.test.ts`, `scripts/lib/dates-social.test.ts`

**Gewijzigd**
- `src/lib/site.ts` (socials, twitter weg), `src/app/layout.tsx`, `src/lib/dates.ts`, `src/lib/text.ts`, `src/lib/content.ts`, `src/lib/schema.ts`
- `src/components/SiteFooter.tsx`, `src/app/(site)/over/page.tsx`, `src/app/(site)/voor-saunas/page.tsx`, `src/app/(site)/event/[slug]/page.tsx`
- `keystatic.config.ts`, `scripts/lib/content.ts`, `scripts/lib/content.test.ts`, `scripts/lib/beheer-routes.test.ts`
- `package.json`, `.gitignore`, `CLAUDE.md`, `docs/image-prompts.md`

---

### Task 1: Datumhelpers voor weken, weekdagen en maandstart

**Files:**
- Modify: `src/lib/dates.ts` (onderaan toevoegen)
- Test: `scripts/lib/dates-social.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
// scripts/lib/dates-social.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoWeek,
  weekendVanIsoWeek,
  volgendeWeekdag,
  eersteVanMaandIn,
  formatDagKort,
  isGeldigeIsoDatum,
} from "../../src/lib/dates";

test("isoWeek: vrijdag 11 september 2026 valt in 2026-W37", () => {
  assert.equal(isoWeek("2026-09-11"), "2026-W37");
  assert.equal(isoWeek("2026-09-14"), "2026-W38"); // maandag erna
});

test("isoWeek: jaargrens volgt ISO 8601 (2026 heeft 53 weken)", () => {
  assert.equal(isoWeek("2026-01-01"), "2026-W01");
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
  assert.equal(isoWeek("2027-01-04"), "2027-W01");
});

test("weekendVanIsoWeek: vrijdag t/m zondag van de week", () => {
  assert.deepEqual(weekendVanIsoWeek("2026-W37"), { van: "2026-09-11", tot: "2026-09-13" });
  assert.deepEqual(weekendVanIsoWeek("2026-W53"), { van: "2027-01-01", tot: "2027-01-03" });
});

test("weekendVanIsoWeek: ongeldige of niet-bestaande week geeft null", () => {
  assert.equal(weekendVanIsoWeek("2026-37"), null);
  assert.equal(weekendVanIsoWeek("2026-W54"), null);
  assert.equal(weekendVanIsoWeek("2025-W53"), null); // 2025 heeft 52 weken
});

test("volgendeWeekdag: eerstvolgende, of de dag zelf", () => {
  assert.equal(volgendeWeekdag("2026-09-11", 3), "2026-09-16"); // vr -> wo
  assert.equal(volgendeWeekdag("2026-09-11", 1), "2026-09-14"); // vr -> ma
  assert.equal(volgendeWeekdag("2026-09-14", 1), "2026-09-14"); // ma -> ma
});

test("eersteVanMaandIn: maandstart binnen het venster", () => {
  assert.equal(eersteVanMaandIn("2026-09-25", 6), "2026-10-01");
  assert.equal(eersteVanMaandIn("2026-10-01", 6), "2026-10-01");
  assert.equal(eersteVanMaandIn("2026-09-11", 6), undefined);
});

test("formatDagKort: weekdag, dag en maand zonder jaar of punten", () => {
  assert.equal(formatDagKort("2026-09-11"), "vr 11 sep");
  assert.equal(formatDagKort("2026-11-01"), "zo 1 nov");
});

test("isGeldigeIsoDatum: vorm én kalender", () => {
  assert.equal(isGeldigeIsoDatum("2026-09-11"), true);
  assert.equal(isGeldigeIsoDatum("2026-13-01"), false);
  assert.equal(isGeldigeIsoDatum("2026-02-30"), false);
  assert.equal(isGeldigeIsoDatum("11-09-2026"), false);
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `node --import tsx --test scripts/lib/dates-social.test.ts`
Expected: FAIL met `isoWeek is not a function` (of "has no exported member").

- [ ] **Step 3: Voeg de helpers toe onderaan `src/lib/dates.ts`**

```ts
/* ---------- Weken en weekdagen (social-kit) ---------- */

/** ISO 8601-weeknummer: "2026-09-11" -> "2026-W37" (maandag als weekstart, jaargrens conform ISO). */
export function isoWeek(iso: string): string {
  const d = parseISO(iso);
  const dag = d.getUTCDay() || 7; // ma = 1 … zo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dag); // de donderdag van deze week bepaalt het ISO-jaar
  const jaarStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jaarStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Vrijdag t/m zondag van een ISO-week ("2026-W37" -> 2026-09-11 … 2026-09-13); null bij een ongeldige week. */
export function weekendVanIsoWeek(week: string): { van: string; tot: string } | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const jaar = Number(m[1]);
  const nr = Number(m[2]);
  if (nr < 1 || nr > 53) return null;
  // 4 januari ligt altijd in ISO-week 1.
  const vierJan = new Date(Date.UTC(jaar, 0, 4));
  const maandagW1 = new Date(vierJan);
  maandagW1.setUTCDate(vierJan.getUTCDate() - ((vierJan.getUTCDay() || 7) - 1));
  const vrijdag = new Date(maandagW1);
  vrijdag.setUTCDate(maandagW1.getUTCDate() + (nr - 1) * 7 + 4);
  const van = vrijdag.toISOString().slice(0, 10);
  if (isoWeek(van) !== week) return null; // week 53 bestaat niet elk jaar
  return { van, tot: addDaysISO(van, 2) };
}

/** Eerstvolgende datum met weekdag `dag` (0 = zo … 6 = za); `iso` zelf als die al die weekdag heeft. */
export function volgendeWeekdag(iso: string, dag: number): string {
  const huidige = parseISO(iso).getUTCDay();
  return addDaysISO(iso, (dag - huidige + 7) % 7);
}

/** De eerste dag van een maand binnen [iso, iso + dagen], of undefined. */
export function eersteVanMaandIn(iso: string, dagen: number): string | undefined {
  for (let i = 0; i <= dagen; i++) {
    const d = addDaysISO(iso, i);
    if (d.endsWith("-01")) return d;
  }
  return undefined;
}

/** Korte dagweergave zonder jaar, voor captions: "vr 11 sep". */
export function formatDagKort(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(parseISO(iso))
    .replace(/\./g, "");
}

/** Geldige kalenderdatum in de vorm YYYY-MM-DD (geen 2026-02-30). */
export function isGeldigeIsoDatum(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && addDaysISO(s, 0) === s;
}
```

- [ ] **Step 4: Draai de test en zie hem slagen**

Run: `node --import tsx --test scripts/lib/dates-social.test.ts`
Expected: alle 8 tests PASS. Faalt `formatDagKort` op een spatievariant (bv. "vr 11 sep" met een smalle spatie), normaliseer dan in de helper met `.replace(/ | /g, " ")` en draai opnieuw.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts scripts/lib/dates-social.test.ts
git commit -m "feat(dates): ISO-week, weekend-per-week, weekdag- en maandstart-helpers voor de social-kit"
```

---

### Task 2: Streepjes-normalisatie verhuizen naar `src/lib/text.ts`

De captions (src) en de scrapers (scripts) gebruiken dezelfde normalisatie. `src` mag niet uit `scripts` importeren, dus de functies verhuizen naar `src/lib/text.ts` met een re-export op de oude plek. Bestaande tests in `scripts/lib/content.test.ts` en `pipeline-fixes.test.ts` blijven ongewijzigd en bewaken de verhuizing.

**Files:**
- Modify: `src/lib/text.ts`
- Modify: `scripts/lib/content.ts:405-438`

- [ ] **Step 1: Voeg de functies toe aan `src/lib/text.ts`** (onderaan, letterlijk verplaatst)

```ts
/* ---------- Streepjes-normalisatie (gedeeld door scrapers en social-captions) ---------- */

/**
 * Verwijdert em-streepjes (—) uit vrije proza-tekst (titel, beschrijving).
 * Die lezen als 'AI-achtig'; we vervangen ze context-neutraal maar
 * grammaticaal veilig:
 *   - een ingesloten/aanhangend streepje met spaties (" — ") wordt een komma;
 *   - een streepje zonder spaties (woord—woord) wordt een gewoon koppelteken;
 *   - overtollige spaties vóór komma's en dubbele komma's worden opgeruimd.
 * En-streepjes (–) blijven ongemoeid: die zijn de nette bereikscheiding.
 */
export function normalizeProseDashes(text: string): string {
  return text
    .replace(/^—[ \t]*/gm, "- ")
    .replace(/[ \t]+—[ \t]+/g, ", ")
    .replace(/—/g, "-")
    .replace(/[ \t]+,/g, ",")
    .replace(/,[ \t]*,/g, ",");
}

/**
 * Voor bereikvelden (tijden, prijsindicatie): een em-streepje is vrijwel altijd
 * een bereikscheiding, dus wordt het het halve streepje zonder spaties dat de
 * rest van de content ook gebruikt (bv. "11:00–18:00").
 */
export function normalizeRangeDashes(text: string): string {
  return text.replace(/\s*—\s*/g, "–");
}
```

- [ ] **Step 2: Vervang in `scripts/lib/content.ts` de twee functiedefinities (het blok tussen `/* ---------- Tekstnormalisatie ---------- */` en `/* ---------- Event wegschrijven ---------- */`) door een re-export**

```ts
/* ---------- Tekstnormalisatie ---------- */

// Verhuisd naar src/lib/text.ts (gedeeld met de social-captions); re-export
// zodat de scrapers en hun tests hier blijven importeren.
export { normalizeProseDashes, normalizeRangeDashes } from "../../src/lib/text";
```

Let op: `writeEventMdx` verderop in hetzelfde bestand gebruikt de functies lokaal; voeg daarom bovenin het bestand bij de imports toe:

```ts
import { normalizeProseDashes, normalizeRangeDashes } from "../../src/lib/text";
```

en verwijder de re-export-regel niet: TypeScript staat een import én een `export { … } from` van dezelfde namen toe.

- [ ] **Step 3: Draai de bestaande tests**

Run: `npm run test`
Expected: alles groen, inclusief `normalizeProseDashes …` in content.test.ts en pipeline-fixes.test.ts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/text.ts scripts/lib/content.ts
git commit -m "refactor(text): streepjes-normalisatie naar src/lib/text.ts, re-export voor de scrapers"
```

---

### Task 3: Datamodel — `gepubliceerdOp` op events en `instagram` op sauna's

**Files:**
- Modify: `src/lib/content.ts` (interfaces + parsing)
- Modify: `keystatic.config.ts`
- Modify: `scripts/lib/content.ts` (`writeEventMdx`)
- Test: `scripts/lib/content.test.ts` (uitbreiden)

- [ ] **Step 1: Schrijf de falende test onderaan `scripts/lib/content.test.ts`**

Voeg bovenin bij de imports uit `./content` `writeEventMdx` toe en importeer gray-matter:

```ts
import matter from "gray-matter";
```

Onderaan:

```ts
test("writeEventMdx zet gepubliceerdOp bij status gepubliceerd, niet bij concept", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "events-"));
  const basis = {
    saunaSlug: "thermen-bussloo",
    titel: "Opgietweekend Test",
    type: "opgietweekend" as const,
    startDatum: "2026-11-14",
    beschrijving: "Test.",
  };
  const pub = writeEventMdx({ ...basis, status: "gepubliceerd" }, dir, "2026-09-11");
  const con = writeEventMdx({ ...basis, startDatum: "2026-11-21", status: "concept" }, dir, "2026-09-11");
  assert.ok(pub && con);
  assert.equal(matter(fs.readFileSync(pub, "utf8")).data.gepubliceerdOp, "2026-09-11");
  assert.equal(matter(fs.readFileSync(con, "utf8")).data.gepubliceerdOp, undefined);
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `node --import tsx --test scripts/lib/content.test.ts`
Expected: FAIL: `gepubliceerdOp` is `undefined` bij het gepubliceerde event (en mogelijk een TS-fout over het derde argument).

- [ ] **Step 3: Pas `writeEventMdx` aan in `scripts/lib/content.ts`**

Import bovenin:

```ts
import { todayISOInTimeZone } from "../../src/lib/dates";
```

Signatuur en frontmatter:

```ts
export function writeEventMdx(ev: NewEvent, dir: string = EVENTS_DIR, vandaag: string = todayISOInTimeZone()): string | null {
  fs.mkdirSync(dir, { recursive: true });
  const slug = eventSlug(ev);
  const filePath = path.join(dir, `${slug}.mdx`);
  if (fs.existsSync(filePath)) return null;

  const titel = normalizeProseDashes(ev.titel);

  const frontmatter: Record<string, unknown> = {
    slug,
    saunaSlug: ev.saunaSlug,
    titel,
    type: ev.type,
    startDatum: ev.startDatum,
    ...(ev.eindDatum ? { eindDatum: ev.eindDatum } : {}),
    ...(ev.tijden ? { tijden: normalizeRangeDashes(ev.tijden) } : {}),
    ...(ev.prijsIndicatie ? { prijsIndicatie: normalizeRangeDashes(ev.prijsIndicatie) } : {}),
    ...(ev.ticketUrl ? { ticketUrl: ev.ticketUrl } : {}),
    status: ev.status,
    // Voedt de rubriek "Nieuw in de agenda" van de social-kit. Alleen bij
    // autopublicatie; een concept krijgt de datum pas als iemand het in
    // Keystatic publiceert en het veld invult.
    ...(ev.status === "gepubliceerd" ? { gepubliceerdOp: vandaag } : {}),
    bron: "scraper",
    ...(ev.keurNotitie ? { keurNotitie: ev.keurNotitie } : {}),
  };

  const body = escapeMdxText(normalizeProseDashes(ev.beschrijving?.trim() || `${titel} bij deze sauna.`));
  const file = matter.stringify(`\n${body}\n`, frontmatter);
  fs.writeFileSync(filePath, file);
  return filePath;
}
```

- [ ] **Step 4: Loader — `src/lib/content.ts`**

In `interface Sauna` na `website?: string;`:

```ts
  /** Instagram-handle zonder @, alleen als die op de eigen website van de sauna staat (tagging in social-posts, sameAs). */
  instagram?: string;
```

In `getAllSaunas` na `website: data.website as string | undefined,`:

```ts
      instagram: data.instagram as string | undefined,
```

In `interface OpgietEvent` na `status: EventStatus;`:

```ts
  /** Datum waarop het event op de site kwam; voedt "Nieuw in de agenda" (social-kit). */
  gepubliceerdOp?: string;
```

In `getAllEvents` na `status: (data.status as EventStatus) ?? "gepubliceerd",`:

```ts
        gepubliceerdOp: toISODate(data.gepubliceerdOp),
```

- [ ] **Step 5: Keystatic-schema — `keystatic.config.ts`**

In `saunas.schema` direct na `website: fields.url({ label: "Website" }),`:

```ts
        instagram: fields.text({
          label: "Instagram-handle",
          description:
            "Zonder @. Alleen als het op de eigen website van de sauna staat. Gebruikt om de sauna te taggen in onze social-posts en in de structured data.",
          validation: {
            pattern: { regex: /^([A-Za-z0-9._]{1,30})?$/, message: "Alleen letters, cijfers, punt en underscore (max. 30)." },
          },
        }),
```

In `events.schema` direct na het `status`-veld:

```ts
        gepubliceerdOp: fields.date({
          label: "Gepubliceerd op",
          description:
            "Wordt door de scraper gezet bij autopublicatie. Vul in bij handmatig publiceren: voedt de rubriek 'Nieuw in de agenda' van de social-kit.",
        }),
```

- [ ] **Step 6: Draai alle tests**

Run: `npm run test`
Expected: groen, inclusief de nieuwe writeEventMdx-test en `keystatic-schema.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/content.ts keystatic.config.ts scripts/lib/content.ts scripts/lib/content.test.ts
git commit -m "feat(content): gepubliceerdOp op events en instagram-handle op sauna's (loader, Keystatic, scraper)"
```

---

### Task 4: `socials`-config en UTM-helper

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/app/layout.tsx:35-38`
- Create: `src/lib/utm.ts`
- Test: `scripts/lib/social-links.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
// scripts/lib/social-links.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { socials } from "../../src/lib/site";
import { utmUrl, kanaalUitParam } from "../../src/lib/utm";

test("socials: drie unieke kanalen met https-URL's", () => {
  assert.deepEqual(socials.map((s) => s.id), ["instagram", "facebook", "tiktok"]);
  for (const s of socials) assert.match(s.url, /^https:\/\//, s.id);
});

test("utmUrl: relatief pad blijft relatief, bestaande query blijft staan", () => {
  assert.equal(
    utmUrl("/agenda?land=NL", { source: "instagram", medium: "bio", campaign: "links" }),
    "/agenda?land=NL&utm_source=instagram&utm_medium=bio&utm_campaign=links",
  );
});

test("utmUrl: absolute URL blijft absoluut en waarden worden opgeschoond", () => {
  assert.equal(
    utmUrl("https://opgietingen.nl/event/x", { source: "Face Book", medium: "social", campaign: "weekend-2026-W37" }),
    "https://opgietingen.nl/event/x?utm_source=face-book&utm_medium=social&utm_campaign=weekend-2026-w37",
  );
});

test("kanaalUitParam: bekend kanaal of 'social'", () => {
  assert.equal(kanaalUitParam("tiktok"), "tiktok");
  assert.equal(kanaalUitParam("x"), "social");
  assert.equal(kanaalUitParam(undefined), "social");
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `node --import tsx --test scripts/lib/social-links.test.ts`
Expected: FAIL (module `utm` ontbreekt, `socials` bestaat niet).

- [ ] **Step 3: `src/lib/site.ts` — vervang `twitter: "@opgietingen",` en voeg `socials` toe**

Verwijder de regel `twitter: "@opgietingen",` uit `site`. Voeg direct onder het `site`-object toe:

```ts
/** Eén sociaal kanaal van Opgietingen.nl. */
export interface Social {
  id: "instagram" | "facebook" | "tiktok";
  label: string;
  /** Gebruikersnaam zonder @; ontbreekt zolang Facebook geen gebruikersnaam heeft. */
  handle?: string;
  url: string;
}

/**
 * Sociale kanalen (aangemaakt 2026-09-08). Enige bron voor footer, over-pagina,
 * Organization.sameAs en /links. Facebook linkt op paginanummer tot er een
 * gebruikersnaam geclaimd is; dan alleen hier de URL aanpassen.
 */
export const socials: readonly Social[] = [
  { id: "instagram", label: "Instagram", handle: "opgietingen.nl", url: "https://www.instagram.com/opgietingen.nl/" },
  { id: "facebook", label: "Facebook", url: "https://www.facebook.com/profile.php?id=61594226581273" },
  { id: "tiktok", label: "TikTok", handle: "opgietingen.nl", url: "https://www.tiktok.com/@opgietingen.nl" },
];

export type SocialId = Social["id"];
```

- [ ] **Step 4: `src/app/layout.tsx` — twitter-blok zonder `site`**

```ts
  twitter: {
    card: "summary_large_image",
  },
```

- [ ] **Step 5: Maak `src/lib/utm.ts`**

```ts
import { site, socials, type SocialId } from "@/lib/site";

/*
  UTM-conventie (spec §8.4):
    utm_source   instagram | facebook | tiktok | whatsapp | link | native | social
    utm_medium   bio (link-in-bio) | social (caption-link) | deel (deelknoppen)
    utm_campaign links | <post-id> | event-<slug>
  Vercel Analytics toont utm_source als bron.
*/
export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
}

function schoon(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Voegt UTM-parameters toe; een relatief pad blijft relatief, bestaande query blijft staan. */
export function utmUrl(padOfUrl: string, utm: UtmParams): string {
  const absoluut = /^https?:\/\//.test(padOfUrl);
  const url = new URL(padOfUrl, site.url);
  url.searchParams.set("utm_source", schoon(utm.source));
  url.searchParams.set("utm_medium", schoon(utm.medium));
  url.searchParams.set("utm_campaign", schoon(utm.campaign));
  return absoluut ? url.toString() : `${url.pathname}${url.search}`;
}

/** `?k=` van /links naar een bekend kanaal; onbekend of leeg wordt "social". */
export function kanaalUitParam(k: string | undefined): SocialId | "social" {
  const gevonden = socials.find((s) => s.id === k);
  return gevonden ? gevonden.id : "social";
}
```

- [ ] **Step 6: Draai de test en zie hem slagen**

Run: `node --import tsx --test scripts/lib/social-links.test.ts`
Expected: 4 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/site.ts src/app/layout.tsx src/lib/utm.ts scripts/lib/social-links.test.ts
git commit -m "feat(site): socials-config en UTM-helper; X-placeholder verwijderd"
```

---

### Task 5: `SocialLinks`-component in footer, over-pagina en voor-sauna's

**Files:**
- Create: `src/components/SocialLinks.tsx`
- Modify: `src/components/SiteFooter.tsx:15-21`
- Modify: `src/app/(site)/over/page.tsx`
- Modify: `src/app/(site)/voor-saunas/page.tsx:11-27`

- [ ] **Step 1: Maak `src/components/SocialLinks.tsx`**

```tsx
import { socials, type SocialId } from "@/lib/site";

/*
  Volg-links naar de sociale kanalen. Inline SVG (geen icon-bibliotheek),
  rel="me" markeert de kanalen als eigen profielen. Twee varianten:
  iconen (footer, /links) en tekst (lopende zin op /over).
*/

const ICONEN: Record<SocialId, string> = {
  instagram:
    "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM17.5 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  facebook:
    "M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3Z",
  tiktok:
    "M16.5 2c.3 2.3 1.6 3.7 3.9 3.9v3.2c-1.5 0-2.8-.4-3.9-1.2v6.6c0 3.7-2.7 6.1-6 5.9-3-.2-5.1-2.6-5.1-5.5 0-3.3 2.9-5.9 6.4-5.5v3.3c-1.7-.4-3.2.7-3.2 2.3 0 1.2.9 2.2 2.1 2.3 1.4.1 2.5-.9 2.5-2.4V2h3.3Z",
};

export function SocialLinks({ variant = "iconen", className = "" }: { variant?: "iconen" | "tekst"; className?: string }) {
  if (variant === "tekst") {
    return (
      <span className={className}>
        {socials.map((s, i) => (
          <span key={s.id}>
            {i > 0 && (i === socials.length - 1 ? " en " : ", ")}
            <a href={s.url} target="_blank" rel="me noopener" className="font-medium text-ember hover:underline">
              {s.label}
            </a>
          </span>
        ))}
      </span>
    );
  }
  return (
    <ul className={`flex items-center gap-3 ${className}`} aria-label="Volg Opgietingen.nl">
      {socials.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            target="_blank"
            rel="me noopener"
            aria-label={`Opgietingen.nl op ${s.label}`}
            title={s.label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-sand bg-surface text-ink-soft transition-colors hover:border-ember hover:text-ember"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" fillRule="evenodd" aria-hidden="true">
              <path d={ICONEN[s.id]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Footer — `src/components/SiteFooter.tsx`**

Import toevoegen:

```ts
import { SocialLinks } from "@/components/SocialLinks";
```

Vervang het merk-blok (de eerste `<div className="sm:col-span-2 lg:col-span-1">`) door:

```tsx
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-lg font-semibold text-ink">
            Opgietingen<span className="text-ember">.nl</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-ink-soft">{site.tagline}.</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-faint">Volg ons</p>
          <SocialLinks className="mt-3" />
        </div>
```

- [ ] **Step 3: Over-pagina — `src/app/(site)/over/page.tsx`**

Import toevoegen en na de derde `<p>` (contact/voor-sauna's) een vierde alinea:

```tsx
import { SocialLinks } from "@/components/SocialLinks";
```

```tsx
        <p>
          Volg ons op <SocialLinks variant="tekst" /> voor de opgietingen van het weekend, nieuwe events en
          uitgelichte opgietweekenden.
        </p>
```

- [ ] **Step 4: Voor-sauna's — `src/app/(site)/voor-saunas/page.tsx`**

Pas het eerste voordeel aan:

```ts
  {
    titel: "Bereik gerichte bezoekers",
    tekst:
      "Saunaliefhebbers die actief op zoek zijn naar opgietingen vinden jouw events via de agenda en regiopagina's. Opgenomen events delen we ook op onze sociale kanalen.",
  },
```

- [ ] **Step 5: Controleer visueel**

Run: `npm run dev` en open `http://localhost:3000/over` en de footer op de homepage.
Expected: drie ronde iconen onder de tagline in de footer; op /over een zin met drie ember-links die in een nieuw tabblad openen.

- [ ] **Step 6: Commit**

```bash
git add src/components/SocialLinks.tsx src/components/SiteFooter.tsx "src/app/(site)/over/page.tsx" "src/app/(site)/voor-saunas/page.tsx"
git commit -m "feat(site): volg-links in footer en over-pagina; socials genoemd in de B2B-pitch"
```

---

### Task 6: `sameAs` in de structured data

**Files:**
- Modify: `src/lib/schema.ts` (`siteSchema`, `saunaSchema`)
- Test: `scripts/lib/social-links.test.ts` (uitbreiden)

- [ ] **Step 1: Schrijf de falende tests (onderaan `social-links.test.ts`)**

```ts
import { siteSchema, saunaSchema } from "../../src/lib/schema";
import type { Sauna } from "../../src/lib/content";

test("siteSchema: Organization.sameAs bevat precies de drie kanalen", () => {
  const graph = siteSchema()["@graph"] as { "@type": string; sameAs?: string[] }[];
  const org = graph.find((n) => n["@type"] === "Organization")!;
  assert.deepEqual(org.sameAs, socials.map((s) => s.url));
});

const sauna: Sauna = {
  slug: "thermen-bussloo",
  naam: "Thermen Bussloo",
  land: "NL",
  provincie: "Gelderland",
  plaats: "Voorst",
  adres: "Bloemenksweg 38",
  lat: 52.19,
  lng: 6.11,
  faciliteiten: [],
  website: "https://www.thermenbussloo.nl",
  instagram: "thermenbussloo",
  affiliateUrl: "https://www.thermenbussloo.nl/reserveren",
  sponsored: false,
  body: "",
};

test("saunaSchema: sameAs bevat website én Instagram-URL", () => {
  const s = saunaSchema(sauna) as { sameAs?: string[] };
  assert.deepEqual(s.sameAs, ["https://www.thermenbussloo.nl", "https://www.instagram.com/thermenbussloo/"]);
});

test("saunaSchema: zonder website en handle geen sameAs", () => {
  const s = saunaSchema({ ...sauna, website: undefined, instagram: undefined }) as { sameAs?: string[] };
  assert.equal(s.sameAs, undefined);
});
```

- [ ] **Step 2: Draai en zie falen**

Run: `node --import tsx --test scripts/lib/social-links.test.ts`
Expected: FAIL op `sameAs`.

- [ ] **Step 3: Pas `src/lib/schema.ts` aan**

Import: `import { site, socials, COUNTRY_LABELS } from "@/lib/site";`

In `siteSchema()` in het Organization-object na `areaServed: ["Nederland", "België"],`:

```ts
        sameAs: socials.map((s) => s.url),
```

Voeg boven `saunaSchema` toe:

```ts
/** Publieke URL van een Instagram-handle (zonder @). */
export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}
```

In `saunaSchema` vervang `...(sauna.website ? { sameAs: [sauna.website] } : {}),` door:

```ts
    ...(() => {
      const sameAs = [sauna.website, sauna.instagram ? instagramUrl(sauna.instagram) : undefined].filter(
        (u): u is string => Boolean(u),
      );
      return sameAs.length > 0 ? { sameAs } : {};
    })(),
```

- [ ] **Step 4: Draai en zie slagen**

Run: `npm run test`
Expected: groen (ook `site-polish.test.ts`, dat `saunaSchema` al test met alleen een website).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts scripts/lib/social-links.test.ts
git commit -m "feat(seo): sameAs met sociale kanalen op Organization en Instagram op LocalBusiness"
```

---

### Task 7: Link-in-bio-pagina `/links`

**Files:**
- Create: `src/lib/links-in-bio.ts`
- Create: `src/app/(site)/links/page.tsx`
- Modify: `scripts/lib/beheer-routes.test.ts`
- Test: `scripts/lib/social-links.test.ts` (uitbreiden)

- [ ] **Step 1: Falende tests**

Onderaan `social-links.test.ts`:

```ts
import { linkKnoppen } from "../../src/lib/links-in-bio";

test("linkKnoppen: zes knoppen, elk met UTM van het kanaal", () => {
  const knoppen = linkKnoppen("oktober-2026", "instagram");
  assert.equal(knoppen.length, 6);
  assert.equal(knoppen[0].label, "Dit weekend");
  for (const k of knoppen) {
    assert.match(k.href, /utm_source=instagram&utm_medium=bio&utm_campaign=links$/, k.href);
  }
  assert.ok(knoppen.some((k) => k.href.startsWith("/agenda/oktober-2026?")), "maandknop wijst naar de maandpagina");
  assert.ok(knoppen.some((k) => k.label === "Deze maand: Oktober 2026"));
});
```

In `scripts/lib/beheer-routes.test.ts` de sitemap-test uitbreiden:

```ts
test("sitemap bevat geen beheer-URL's en geen /links", () => {
  const urls = sitemap().map((e) => e.url);
  assert.ok(urls.length > 10, "sitemap lijkt leeg");
  assert.deepEqual(
    urls.filter((u) => u.includes("/keystatic") || u.includes("/api/") || u.includes("/beheer") || u.endsWith("/links")),
    [],
  );
});
```

(Vervang de bestaande test `sitemap bevat geen beheer-URL's` hierdoor.)

- [ ] **Step 2: Draai en zie falen**

Run: `node --import tsx --test scripts/lib/social-links.test.ts`
Expected: FAIL (module ontbreekt).

- [ ] **Step 3: Maak `src/lib/links-in-bio.ts`**

```ts
import { monthYearLabel } from "@/lib/dates";
import { utmUrl } from "@/lib/utm";

export interface LinkKnop {
  label: string;
  href: string;
}

/**
 * Knoppen van /links (link-in-bio). `kanaal` is de utm_source, `maandSlug` de
 * huidige maand (bv. "oktober-2026"). Volgorde = wat een volger het vaakst zoekt.
 */
export function linkKnoppen(maandSlug: string, kanaal: string): LinkKnop[] {
  const utm = { source: kanaal, medium: "bio", campaign: "links" };
  const maandLabel = monthYearLabel(maandSlug) ?? "deze maand";
  return [
    { label: "Dit weekend", pad: "/opgietingen/dit-weekend" },
    { label: "Volledige agenda", pad: "/agenda" },
    { label: `Deze maand: ${maandLabel}`, pad: `/agenda/${maandSlug}` },
    { label: "Wat is een opgieting?", pad: "/wat-is-een-opgieting" },
    { label: "Saunagids", pad: "/gids" },
    { label: "Onze saunahoed", pad: "/saunahoed" },
  ].map(({ label, pad }) => ({ label, href: utmUrl(pad, utm) }));
}
```

- [ ] **Step 4: Maak `src/app/(site)/links/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { currentMonthSlug, todayISO } from "@/lib/dates";
import { kanaalUitParam } from "@/lib/utm";
import { linkKnoppen } from "@/lib/links-in-bio";
import { SocialLinks } from "@/components/SocialLinks";

/*
  Link-in-bio op eigen domein (spec §3.3). De bio-URL per kanaal is
  /links?k=instagram|facebook|tiktok; elke knop krijgt UTM's met die bron.
  Dynamisch (searchParams + huidige maand), noindex, niet in de sitemap.
*/

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Links",
  description: `Snel naar de agenda, dit weekend, de saunagids en meer van ${site.name}.`,
  robots: { index: false, follow: true },
  alternates: { canonical: "/links" },
};

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const knoppen = linkKnoppen(currentMonthSlug(todayISO()), kanaalUitParam(k));

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="font-display text-3xl font-semibold text-ink">
          Opgietingen<span className="text-ember">.nl</span>
        </p>
        <p className="mt-2 text-ink-soft">{site.tagline}.</p>
      </div>

      <ul className="mt-8 space-y-3">
        {knoppen.map((knop) => (
          <li key={knop.href}>
            <Link
              href={knop.href}
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-sand bg-surface px-5 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-ember hover:text-ember"
            >
              {knop.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Volg ons</p>
        <SocialLinks />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Draai tests en controleer de pagina**

Run: `npm run test` → groen.
Run: `npm run dev`, open `http://localhost:3000/links?k=tiktok`, hover een knop.
Expected: knoppen linken naar `…?utm_source=tiktok&utm_medium=bio&utm_campaign=links`; `curl -s http://localhost:3000/links | grep -o 'name="robots"[^>]*'` toont `noindex`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/links-in-bio.ts "src/app/(site)/links/page.tsx" scripts/lib/beheer-routes.test.ts scripts/lib/social-links.test.ts
git commit -m "feat(site): link-in-bio-pagina /links met UTM per kanaal (noindex)"
```

---

### Task 8: Deelknoppen op eventpagina's

**Files:**
- Create: `src/components/EventDeelKnoppen.tsx`
- Modify: `src/app/(site)/event/[slug]/page.tsx` (import + onder de .ics-link)

- [ ] **Step 1: Maak `src/components/EventDeelKnoppen.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { utmUrl } from "@/lib/utm";

/*
  "Deel dit event": WhatsApp (het echte "ga je mee?"-kanaal), link kopiëren en
  het native deelmenu. Elke variant krijgt een eigen utm_source zodat Vercel
  Analytics laat zien welk kanaal terugkomt. De native knop verschijnt pas na
  mount: navigator.share bestaat niet op de server (geen hydration-mismatch).
*/
export function EventDeelKnoppen({ slug, titel, url }: { slug: string; titel: string; url: string }) {
  const [kanNative, setKanNative] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  useEffect(() => {
    setKanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const deelUrl = (source: string) => utmUrl(url, { source, medium: "deel", campaign: `event-${slug}` });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${titel} ${deelUrl("whatsapp")}`)}`;

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(deelUrl("link"));
      setGekopieerd(true);
      track("deel", { kanaal: "link", slug });
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // Klembord geweigerd: knop blijft staan, geen foutmelding nodig.
    }
  }

  async function deel() {
    try {
      await navigator.share({ title: titel, url: deelUrl("native") });
      track("deel", { kanaal: "native", slug });
    } catch {
      // Geannuleerd door de gebruiker.
    }
  }

  const knop =
    "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-sand bg-surface px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember";

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Deel dit event</p>
      <div className="mt-2 flex gap-2">
        <a href={whatsapp} target="_blank" rel="noopener" className={knop} onClick={() => track("deel", { kanaal: "whatsapp", slug })}>
          WhatsApp
        </a>
        <button type="button" onClick={kopieer} className={knop}>
          {gekopieerd ? "Gekopieerd" : "Link kopiëren"}
        </button>
        {kanNative && (
          <button type="button" onClick={deel} className={knop}>
            Delen
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Eventpagina — `src/app/(site)/event/[slug]/page.tsx`**

Import toevoegen:

```ts
import { EventDeelKnoppen } from "@/components/EventDeelKnoppen";
```

In het `mt-5`-blok, binnen de `<>…</>` van het niet-afgelopen geval, direct na de tweede `<p className="mt-2 text-center text-xs text-ink-faint">…</p>`:

```tsx
                  <EventDeelKnoppen slug={event.slug} titel={event.titel} url={absoluteUrl(`/event/${event.slug}`)} />
```

(`absoluteUrl` is al geïmporteerd in dit bestand.)

- [ ] **Step 3: Controleer**

Run: `npm run dev`, open een komend event.
Expected: rij met WhatsApp en "Link kopiëren" (op desktop-Chrome ook "Delen"); WhatsApp-link bevat `utm_source=whatsapp&utm_medium=deel&utm_campaign=event-<slug>`; kopiëren toont 2 s "Gekopieerd". Afgelopen event: geen deelrij.

- [ ] **Step 4: Commit**

```bash
git add src/components/EventDeelKnoppen.tsx "src/app/(site)/event/[slug]/page.tsx"
git commit -m "feat(event): deelknoppen (WhatsApp, kopiëren, native) met UTM per kanaal"
```

---

### Task 9: Selectieregels en posts — `src/lib/social.ts`

**Files:**
- Create: `src/lib/social.ts`
- Create: `scripts/lib/social-fixtures.ts` (testdata, gedeeld door de social-tests; geen testbestand, anders draaien tests dubbel bij import)
- Test: `scripts/lib/social.test.ts`

- [ ] **Step 1: Maak de fixtures `scripts/lib/social-fixtures.ts`**

```ts
// scripts/lib/social-fixtures.ts
import type { OpgietEvent, Sauna } from "../../src/lib/content";

export const sauna: Sauna = {
  slug: "thermen-bussloo",
  naam: "Thermen Bussloo",
  land: "NL",
  provincie: "Gelderland",
  plaats: "Voorst",
  adres: "Bloemenksweg 38",
  lat: 52.19,
  lng: 6.11,
  faciliteiten: [],
  affiliateUrl: "https://example.com",
  sponsored: false,
  instagram: "thermenbussloo",
  body: "",
};

export function maakEvent(o: Partial<OpgietEvent> & { slug: string; startDatum: string }): OpgietEvent {
  return {
    saunaSlug: sauna.slug,
    titel: `Event `,
    type: "thema",
    status: "gepubliceerd",
    body: "",
    sauna,
    ...o,
  };
}
```

- [ ] **Step 2: Schrijf de falende tests**

```ts
// scripts/lib/social.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { maakEvent, sauna } from "./social-fixtures";
import {
  weekendEvents,
  maandEvents,
  nieuweEvents,
  uitgelichtKandidaten,
  bouwPosts,
  MAX_EVENT_SLIDES,
} from "../../src/lib/social";

// Referentie: vrijdag 11 september 2026 (ISO-week 37, weekend 11–13 sep).
const DATUM = "2026-09-11";

test("weekendEvents: overlap met vr–zo, gesorteerd op datum en saunanaam", () => {
  const events = [
    maakEvent({ slug: "za", startDatum: "2026-09-12" }),
    maakEvent({ slug: "meerdaags", startDatum: "2026-09-09", eindDatum: "2026-09-11" }), // eindigt vrijdag: telt
    maakEvent({ slug: "volgende-week", startDatum: "2026-09-18" }),
    maakEvent({ slug: "do", startDatum: "2026-09-10" }), // donderdag: telt niet
    maakEvent({ slug: "vr-b", startDatum: "2026-09-11", sauna: { ...sauna, naam: "Zwaluwhoeve" } }),
    maakEvent({ slug: "vr-a", startDatum: "2026-09-11" }),
  ];
  assert.deepEqual(
    weekendEvents(events, "2026-W37").map((e) => e.slug),
    ["meerdaags", "vr-a", "vr-b", "za"],
  );
  assert.deepEqual(weekendEvents(events, "onzin"), []);
});

test("maandEvents: alleen startdatum in die maand", () => {
  const events = [
    maakEvent({ slug: "okt", startDatum: "2026-10-03" }),
    maakEvent({ slug: "sep", startDatum: "2026-09-30", eindDatum: "2026-10-02" }),
  ];
  assert.deepEqual(maandEvents(events, "oktober-2026").map((e) => e.slug), ["okt"]);
  assert.deepEqual(maandEvents(events, "geen-maand"), []);
});

test("nieuweEvents: gepubliceerdOp in de afgelopen zeven dagen en nog komend", () => {
  const events = [
    maakEvent({ slug: "vers", startDatum: "2026-10-10", gepubliceerdOp: "2026-09-07" }),
    maakEvent({ slug: "grens", startDatum: "2026-10-11", gepubliceerdOp: "2026-09-05" }), // datum-6: telt
    maakEvent({ slug: "oud", startDatum: "2026-10-12", gepubliceerdOp: "2026-09-04" }),
    maakEvent({ slug: "voorbij", startDatum: "2026-09-10", gepubliceerdOp: "2026-09-08" }),
    maakEvent({ slug: "zonder", startDatum: "2026-10-13" }),
  ];
  assert.deepEqual(nieuweEvents(events, DATUM).map((e) => e.slug), ["vers", "grens"]);
});

test("uitgelichtKandidaten: venster 7–28 dagen, prioriteit op type, dan datum, max 3", () => {
  const events = [
    maakEvent({ slug: "te-vroeg", startDatum: "2026-09-17", type: "opgietweekend" }), // dag 6
    maakEvent({ slug: "thema", startDatum: "2026-09-19", type: "thema" }),
    maakEvent({ slug: "weekend-laat", startDatum: "2026-10-08", type: "opgietweekend" }),
    maakEvent({ slug: "weekend-vroeg", startDatum: "2026-09-25", type: "opgietweekend" }),
    maakEvent({ slug: "kamp", startDatum: "2026-10-02", type: "kampioenschap" }),
    maakEvent({ slug: "regulier", startDatum: "2026-09-20", type: "regulier" }),
    maakEvent({ slug: "te-laat", startDatum: "2026-10-10", type: "opgietweekend" }), // dag 29
  ];
  assert.deepEqual(
    uitgelichtKandidaten(events, DATUM).map((e) => e.slug),
    ["weekend-vroeg", "weekend-laat", "kamp"],
  );
});

test("bouwPosts: vier rubrieken met stabiele id's en plaatsingsdagen vanuit vrijdag", () => {
  const events = [
    maakEvent({ slug: "we", startDatum: "2026-09-12" }),
    maakEvent({ slug: "nieuw", startDatum: "2026-10-20", gepubliceerdOp: "2026-09-07" }),
    maakEvent({ slug: "uit", startDatum: "2026-09-26", type: "opgietweekend" }),
  ];
  // Vrijdag 25 september: maandstart 1 oktober valt in het venster.
  const posts = bouwPosts([...events, maakEvent({ slug: "okt", startDatum: "2026-10-03" })], "2026-09-25");
  const ids = posts.map((p) => p.id);
  assert.ok(ids.includes("weekend-2026-W39"), ids.join());
  assert.ok(ids.includes("maand-oktober-2026"), ids.join());
  assert.ok(ids.includes("uitgelicht-okt") || ids.includes("uitgelicht-nieuw"), ids.join());
  const maand = posts.find((p) => p.id === "maand-oktober-2026")!;
  assert.equal(maand.plaatsingsdag, "2026-10-01");
  assert.deepEqual(maand.periode, { van: "2026-10-01", tot: "2026-10-31" });

  const p11 = bouwPosts(events, DATUM);
  const weekend = p11.find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.id, "weekend-2026-W37");
  assert.equal(weekend.plaatsingsdag, "2026-09-11");
  assert.deepEqual(weekend.slides.map((s) => s.rol), ["cover", "event", "afsluiter"]);
  assert.equal(weekend.slides[0].pad, "/social/weekend/2026-W37");
  assert.equal(weekend.slides[1].pad, "/social/event/we");
  const nieuw = p11.find((p) => p.rubriek === "nieuw")!;
  assert.equal(nieuw.plaatsingsdag, "2026-09-14"); // maandag
  const uit = p11.find((p) => p.rubriek === "uitgelicht")!;
  assert.equal(uit.id, "uitgelicht-uit");
  assert.equal(uit.rang, 1);
  assert.equal(uit.plaatsingsdag, "2026-09-16"); // woensdag
  assert.deepEqual(uit.slides.map((s) => s.rol), ["event"]);
  assert.ok(!p11.some((p) => p.rubriek === "maand"), "geen maandstart in het venster");
});

test("bouwPosts: vanuit maandag komt hetzelfde weekend, plaatsingsdag vrijdag", () => {
  const posts = bouwPosts([maakEvent({ slug: "we", startDatum: "2026-09-12" })], "2026-09-07");
  const weekend = posts.find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.id, "weekend-2026-W37");
  assert.equal(weekend.plaatsingsdag, "2026-09-11");
});

test("bouwPosts: meer dan acht events -> acht slides, alle events in de post", () => {
  const events = Array.from({ length: 11 }, (_, i) => maakEvent({ slug: `e${i}`, startDatum: "2026-09-12" }));
  const weekend = bouwPosts(events, DATUM).find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.slides.length, MAX_EVENT_SLIDES + 2);
  assert.equal(weekend.events.length, 11);
  assert.equal(weekend.titel, "Dit weekend: 11 opgietingen");
});

test("bouwPosts: lege agenda -> geen posts", () => {
  assert.deepEqual(bouwPosts([], DATUM), []);
});
```

- [ ] **Step 3: Draai en zie falen**

Run: `node --import tsx --test scripts/lib/social.test.ts`
Expected: FAIL (module ontbreekt).

- [ ] **Step 4: Maak `src/lib/social.ts`**

```ts
import type { OpgietEvent } from "@/lib/content";
import type { EventType } from "@/lib/site";
import {
  addDaysISO,
  eersteVanMaandIn,
  isoWeek,
  monthYearSlug,
  parseISO,
  parseMonthYearSlug,
  volgendeWeekdag,
  weekendVanIsoWeek,
} from "@/lib/dates";

/*
  Social-kit: welke posts horen bij een referentiedatum (spec §5). Pure
  functies zonder I/O; de routes onder /social en het script social-kit zijn
  dunne schillen hieromheen. Referentie is normaal een vrijdag (Nathaniels
  plandag); vanuit maandag (latere Buffer-adapter) komt hetzelfde weekend.
*/

export type Rubriek = "weekend" | "uitgelicht" | "maand" | "nieuw";
export type Kanaal = "instagram" | "facebook" | "tiktok";
export type Formaat = "feed" | "story";

export const KANALEN: readonly Kanaal[] = ["instagram", "facebook", "tiktok"];
/** Instagram-carrousels tellen maximaal 10 slides: cover + 8 events + afsluiter. */
export const MAX_EVENT_SLIDES = 8;

/** Platte event-weergave voor planning-JSON en captions (geen body, geen sauna-object). */
export interface PlanningEvent {
  slug: string;
  titel: string;
  type: EventType;
  startDatum: string;
  eindDatum?: string;
  tijden?: string;
  prijsIndicatie?: string;
  sauna: string;
  plaats: string;
  provincie: string;
  /** Instagram-handle van de sauna zonder @, als bekend. */
  instagram?: string;
}

export interface Slide {
  rol: "cover" | "event" | "afsluiter";
  eventSlug?: string;
  /** Pad zonder `?formaat=`; de planning maakt er feed- en story-URL's van. */
  pad: string;
}

export interface SocialPost {
  /** Stabiel per week/event, bv. weekend-2026-W37, uitgelicht-<slug>. */
  id: string;
  rubriek: Rubriek;
  /** 1, behalve de tweede en derde uitgelicht-kandidaat (2 en 3). */
  rang: number;
  titel: string;
  plaatsingsdag: string;
  /** Bereik waar de post over gaat (weekend, maand, nieuw-venster of eventdatum). */
  periode: { van: string; tot: string };
  events: PlanningEvent[];
  slides: Slide[];
}

const PRIORITEIT: Record<EventType, number> = { opgietweekend: 0, kampioenschap: 1, thema: 2, regulier: 3 };

function opDatumEnSauna(a: OpgietEvent, b: OpgietEvent): number {
  return a.startDatum.localeCompare(b.startDatum) || a.sauna.naam.localeCompare(b.sauna.naam, "nl");
}

export function aantalTekst(n: number): string {
  return `${n} ${n === 1 ? "opgieting" : "opgietingen"}`;
}

export function naarPlanningEvent(e: OpgietEvent): PlanningEvent {
  return {
    slug: e.slug,
    titel: e.titel,
    type: e.type,
    startDatum: e.startDatum,
    eindDatum: e.eindDatum,
    tijden: e.tijden,
    prijsIndicatie: e.prijsIndicatie,
    sauna: e.sauna.naam,
    plaats: e.sauna.plaats,
    provincie: e.sauna.provincie,
    instagram: e.sauna.instagram,
  };
}

/* ---------- Selectie ---------- */

/** Events die (deels) in het weekend vr–zo van de ISO-week vallen. */
export function weekendEvents(events: OpgietEvent[], week: string): OpgietEvent[] {
  const w = weekendVanIsoWeek(week);
  if (!w) return [];
  return events
    .filter((e) => e.startDatum <= w.tot && (e.eindDatum ?? e.startDatum) >= w.van)
    .sort(opDatumEnSauna);
}

/** Events met startdatum in de maand van de slug ("oktober-2026"). */
export function maandEvents(events: OpgietEvent[], maandSlug: string): OpgietEvent[] {
  const p = parseMonthYearSlug(maandSlug);
  if (!p) return [];
  const prefix = `${p.year}-${String(p.monthIndex + 1).padStart(2, "0")}`;
  return events.filter((e) => e.startDatum.startsWith(prefix)).sort(opDatumEnSauna);
}

/** Events die in [datum-6, datum] zijn gepubliceerd en nog komen. */
export function nieuweEvents(events: OpgietEvent[], datum: string): OpgietEvent[] {
  const van = addDaysISO(datum, -6);
  return events
    .filter((e) => e.gepubliceerdOp !== undefined && e.gepubliceerdOp >= van && e.gepubliceerdOp <= datum && e.startDatum >= datum)
    .sort(opDatumEnSauna);
}

/** Kandidaten voor Uitgelicht: start over 1–4 weken; opgietweekend > kampioenschap > thema > regulier, dan datum. */
export function uitgelichtKandidaten(events: OpgietEvent[], datum: string, n = 3): OpgietEvent[] {
  const van = addDaysISO(datum, 7);
  const tot = addDaysISO(datum, 28);
  return events
    .filter((e) => e.startDatum >= van && e.startDatum <= tot)
    .sort((a, b) => PRIORITEIT[a.type] - PRIORITEIT[b.type] || opDatumEnSauna(a, b))
    .slice(0, n);
}

/* ---------- Posts ---------- */

function carrousel(coverPad: string, events: OpgietEvent[]): Slide[] {
  return [
    { rol: "cover", pad: coverPad },
    ...events.slice(0, MAX_EVENT_SLIDES).map((e) => ({ rol: "event" as const, eventSlug: e.slug, pad: `/social/event/${e.slug}` })),
    { rol: "afsluiter", pad: "/social/afsluiter" },
  ];
}

/** Eerste en laatste dag van de maand van een maandslug. */
export function maandBereik(maandSlug: string): { van: string; tot: string } | null {
  const p = parseMonthYearSlug(maandSlug);
  if (!p) return null;
  const eerste = new Date(Date.UTC(p.year, p.monthIndex, 1));
  const volgende = new Date(Date.UTC(p.year, p.monthIndex + 1, 1));
  return { van: eerste.toISOString().slice(0, 10), tot: addDaysISO(volgende.toISOString().slice(0, 10), -1) };
}

/** Alle posts voor een referentiedatum, gesorteerd op plaatsingsdag en rang. Lege rubrieken vallen weg. */
export function bouwPosts(events: OpgietEvent[], datum: string): SocialPost[] {
  const posts: SocialPost[] = [];

  const week = isoWeek(datum);
  const weekend = weekendVanIsoWeek(week);
  const we = weekendEvents(events, week);
  if (weekend && we.length > 0) {
    posts.push({
      id: `weekend-${week}`,
      rubriek: "weekend",
      rang: 1,
      titel: `Dit weekend: ${aantalTekst(we.length)}`,
      plaatsingsdag: weekend.van > datum ? weekend.van : datum,
      periode: weekend,
      events: we.map(naarPlanningEvent),
      slides: carrousel(`/social/weekend/${week}`, we),
    });
  }

  const nieuw = nieuweEvents(events, datum);
  if (nieuw.length > 0) {
    posts.push({
      id: `nieuw-${datum}`,
      rubriek: "nieuw",
      rang: 1,
      titel: `Nieuw in de agenda: ${aantalTekst(nieuw.length)}`,
      plaatsingsdag: volgendeWeekdag(datum, 1),
      periode: { van: addDaysISO(datum, -6), tot: datum },
      events: nieuw.map(naarPlanningEvent),
      slides: carrousel(`/social/nieuw/${datum}`, nieuw),
    });
  }

  uitgelichtKandidaten(events, datum).forEach((e, i) => {
    posts.push({
      id: `uitgelicht-${e.slug}`,
      rubriek: "uitgelicht",
      rang: i + 1,
      titel: `Uitgelicht: ${e.titel}`,
      plaatsingsdag: volgendeWeekdag(datum, 3),
      periode: { van: e.startDatum, tot: e.eindDatum ?? e.startDatum },
      events: [naarPlanningEvent(e)],
      slides: [{ rol: "event", eventSlug: e.slug, pad: `/social/event/${e.slug}` }],
    });
  });

  const eerste = eersteVanMaandIn(datum, 6);
  if (eerste) {
    const slug = monthYearSlug(eerste);
    const me = maandEvents(events, slug);
    const bereik = maandBereik(slug);
    if (me.length > 0 && bereik) {
      const maandNaam = slug.split("-")[0];
      posts.push({
        id: `maand-${slug}`,
        rubriek: "maand",
        rang: 1,
        titel: `Deze maand: ${aantalTekst(me.length)} in ${maandNaam}`,
        plaatsingsdag: eerste,
        periode: bereik,
        events: me.map(naarPlanningEvent),
        slides: carrousel(`/social/maand/${slug}`, me),
      });
    }
  }

  return posts.sort((a, b) => a.plaatsingsdag.localeCompare(b.plaatsingsdag) || a.rang - b.rang);
}

/** Nummer van de ISO-week (1–53), voor het rouleren van captionvarianten. */
export function weekNummer(iso: string): number {
  return Number(isoWeek(iso).slice(-2));
}

/** Aantal dagen van `van` tot `tot` (positief als `tot` later is). */
export function dagenTussen(van: string, tot: string): number {
  return Math.round((parseISO(tot).getTime() - parseISO(van).getTime()) / 86_400_000);
}
```

- [ ] **Step 5: Draai en zie slagen**

Run: `node --import tsx --test scripts/lib/social.test.ts`
Expected: 9 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/social.ts scripts/lib/social-fixtures.ts scripts/lib/social.test.ts
git commit -m "feat(social): selectieregels en posts per rubriek voor de social-kit"
```

---

### Task 10: Captions — `src/lib/social-captions.ts`

**Files:**
- Create: `src/lib/social-captions.ts`
- Test: `scripts/lib/social-captions.test.ts`

- [ ] **Step 1: Falende tests**

```ts
// scripts/lib/social-captions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwPosts } from "../../src/lib/social";
import { bouwCaption, hashtags, LIMIET } from "../../src/lib/social-captions";
import { maakEvent, sauna } from "./social-fixtures";

const DATUM = "2026-09-11";
const events = [
  maakEvent({ slug: "vr", startDatum: "2026-09-11", titel: "Vuur & Kruiden", type: "thema" }),
  maakEvent({
    slug: "we",
    startDatum: "2026-09-12",
    eindDatum: "2026-09-13",
    titel: "Opgietweekend Herfstgloed",
    type: "opgietweekend",
    sauna: { ...sauna, naam: "Zwaluwhoeve", plaats: "Hierden", instagram: undefined },
  }),
];
const weekend = bouwPosts(events, DATUM).find((p) => p.rubriek === "weekend")!;

test("instagram: opening, eventregels met @handle waar bekend, link-in-bio, hashtags", () => {
  const c = bouwCaption(weekend, "instagram");
  assert.match(c, /^Dit weekend staan er 2 opgietingen|^Zin in een opgieting dit weekend|^Weekendplanning: 2 opgietingen/);
  assert.match(c, /📅 vr 11 sep · Vuur & Kruiden · Thermen Bussloo, Voorst @thermenbussloo/);
  assert.match(c, /📅 za 12 sep t\/m zo 13 sep · Opgietweekend Herfstgloed · Zwaluwhoeve, Hierden\n/);
  assert.ok(!c.includes("Zwaluwhoeve, Hierden @"), "geen @ zonder handle");
  assert.match(c, /Volledige agenda via de link in bio\./);
  assert.ok(!c.includes("http"), "geen links op Instagram");
  assert.match(c, /#opgieting #opgietingen #aufguss #sauna #saunaliefhebbers #wellness #themaopgieting #opgietweekend #voorst #hierden$/);
  assert.ok(!c.includes("—"), "geen em-streepjes");
});

test("facebook: echte URL met UTM, drie hashtags, geen @handles", () => {
  const c = bouwCaption(weekend, "facebook");
  assert.match(c, /Volledige agenda: https:\/\/opgietingen\.nl\/opgietingen\/dit-weekend\?utm_source=facebook&utm_medium=social&utm_campaign=weekend-2026-w37/);
  assert.match(c, /#opgieting #aufguss #sauna$/);
  assert.ok(!c.includes("@thermenbussloo"));
});

test("tiktok: vijf hashtags en link-in-bio", () => {
  const c = bouwCaption(weekend, "tiktok");
  assert.match(c, /#opgieting #opgietingen #aufguss #sauna #saunaliefhebbers$/);
  assert.match(c, /link in bio/);
});

test("uitgelicht: detailregels met tijden en prijs, facebook linkt naar het event", () => {
  const ev = maakEvent({ slug: "u", startDatum: "2026-09-26", type: "opgietweekend", titel: "Herfstweekend", tijden: "10:00–22:00", prijsIndicatie: "Vanaf € 49,50" });
  const post = bouwPosts([ev], DATUM).find((p) => p.rubriek === "uitgelicht")!;
  const ig = bouwCaption(post, "instagram");
  assert.match(ig, /Tijden: 10:00–22:00/);
  assert.match(ig, /Prijs: Vanaf € 49,50/);
  const fb = bouwCaption(post, "facebook");
  assert.match(fb, /https:\/\/opgietingen\.nl\/event\/u\?utm_source=facebook&utm_medium=social&utm_campaign=uitgelicht-u/);
});

test("limiet: te lange caption laat eventregels weg met een teller, hashtags blijven", () => {
  const veel = Array.from({ length: 60 }, (_, i) =>
    maakEvent({ slug: `e${i}`, startDatum: "2026-09-12", titel: `Een behoorlijk lange eventtitel nummer ${i} met extra woorden erbij` }),
  );
  const post = bouwPosts(veel, DATUM).find((p) => p.rubriek === "weekend")!;
  const c = bouwCaption(post, "instagram");
  assert.ok(c.length <= LIMIET.instagram, `${c.length}`);
  assert.match(c, /…en \d+ meer op opgietingen\.nl/);
  assert.match(c, /#opgieting/);
});

test("hashtags: maximaal 12 op Instagram, plaatsnamen zonder streepjes", () => {
  const post = bouwPosts(
    [maakEvent({ slug: "a", startDatum: "2026-09-12", sauna: { ...sauna, plaats: "Sint-Michielsgestel" } })],
    DATUM,
  ).find((p) => p.rubriek === "weekend")!;
  const tags = hashtags(post, "instagram");
  assert.ok(tags.length <= 12);
  assert.ok(tags.includes("sintmichielsgestel"));
});
```

- [ ] **Step 2: Draai en zie falen**

Run: `node --import tsx --test scripts/lib/social-captions.test.ts`
Expected: FAIL (module ontbreekt).

- [ ] **Step 3: Maak `src/lib/social-captions.ts`**

```ts
import { site, type EventType } from "@/lib/site";
import { slugify } from "@/lib/content";
import { formatDagKort, MONTHS_NL, parseISO } from "@/lib/dates";
import { normalizeProseDashes } from "@/lib/text";
import { utmUrl } from "@/lib/utm";
import { aantalTekst, dagenTussen, weekNummer, MAX_EVENT_SLIDES, type Kanaal, type PlanningEvent, type SocialPost } from "@/lib/social";

/*
  Captions uit templates (spec §5.4): deterministisch, feitelijk, zonder
  superlatieven. Variatie via drie openingen die op weeknummer rouleren.
  Het kalender-emoji vóór elke eventregel is het enige emoji.
*/

export const LIMIET: Record<Kanaal, number> = { instagram: 2200, facebook: Number.POSITIVE_INFINITY, tiktok: 4000 };

const KERN = ["opgieting", "opgietingen", "aufguss", "sauna", "saunaliefhebbers", "wellness"];
const TYPE_TAGS: Partial<Record<EventType, string>> = {
  opgietweekend: "opgietweekend",
  kampioenschap: "aufgusskampioenschap",
  thema: "themaopgieting",
};

function uniek<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** ", van Groningen tot Limburg" als de events over minstens twee provincies verspreid zijn. */
function spreiding(post: SocialPost): string {
  const provincies = uniek(post.events.map((e) => e.provincie));
  return provincies.length >= 2 ? `, van ${provincies[0]} tot ${provincies[provincies.length - 1]}` : "";
}

function maandNaam(post: SocialPost): string {
  return MONTHS_NL[parseISO(post.periode.van).getUTCMonth()];
}

const OPENINGEN: Record<SocialPost["rubriek"], ((p: SocialPost) => string)[]> = {
  weekend: [
    (p) => `Dit weekend staan er ${aantalTekst(p.events.length)} op de agenda in Nederland en België.`,
    (p) => `Zin in een opgieting dit weekend? Dit is er te doen${spreiding(p)}.`,
    (p) => `Weekendplanning: ${aantalTekst(p.events.length)}${spreiding(p)}.`,
  ],
  nieuw: [
    (p) => `Nieuw in de agenda: ${aantalTekst(p.events.length)} toegevoegd deze week.`,
    (p) => `Vers toegevoegd aan de agenda: ${aantalTekst(p.events.length)}.`,
    (p) => `Deze week nieuw op opgietingen.nl: ${aantalTekst(p.events.length)}.`,
  ],
  maand: [
    (p) => `${hoofdletter(maandNaam(p))} op de agenda: ${aantalTekst(p.events.length)} in Nederland en België.`,
    (p) => `Wat staat er in ${maandNaam(p)} op het programma? ${aantalTekst(p.events.length)}.`,
    (p) => `Overzicht ${maandNaam(p)}: ${aantalTekst(p.events.length)}${spreiding(p)}.`,
  ],
  uitgelicht: [
    (p) => `Uitgelicht: ${p.events[0].titel} bij ${p.events[0].sauna} in ${p.events[0].plaats}.`,
    (p) => `Alvast in je agenda: ${p.events[0].titel}, ${dagLabel(p.events[0])} bij ${p.events[0].sauna}.`,
    (p) => `Over ${wekenTekst(dagenTussen(p.plaatsingsdag, p.events[0].startDatum))}: ${p.events[0].titel} bij ${p.events[0].sauna}.`,
  ],
};

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 week" of "3 weken", minimaal 1. */
function wekenTekst(dagen: number): string {
  const n = Math.max(1, Math.round(dagen / 7));
  return n === 1 ? "1 week" : ` weken`;
}

function dagLabel(e: PlanningEvent): string {
  return e.eindDatum && e.eindDatum !== e.startDatum
    ? `${formatDagKort(e.startDatum)} t/m ${formatDagKort(e.eindDatum)}`
    : formatDagKort(e.startDatum);
}

function saunaLabel(e: PlanningEvent): string {
  return e.sauna.toLowerCase().includes(e.plaats.toLowerCase()) ? e.sauna : `${e.sauna}, ${e.plaats}`;
}

function eventRegel(e: PlanningEvent, kanaal: Kanaal): string {
  const tag = kanaal === "instagram" && e.instagram ? ` @${e.instagram}` : "";
  return `📅 ${dagLabel(e)} · ${e.titel} · ${saunaLabel(e)}${tag}`;
}

function detailRegels(e: PlanningEvent): string[] {
  return [...(e.tijden ? [`Tijden: ${e.tijden}`] : []), ...(e.prijsIndicatie ? [`Prijs: ${e.prijsIndicatie}`] : [])];
}

/** Doelpagina op de site per rubriek (voor de Facebook-caption). */
export function doelPad(post: SocialPost): string {
  switch (post.rubriek) {
    case "weekend":
      return "/opgietingen/dit-weekend";
    case "maand":
      return `/agenda/${post.id.replace(/^maand-/, "")}`;
    case "uitgelicht":
      return `/event/${post.events[0].slug}`;
    case "nieuw":
      return "/agenda";
  }
}

function oproep(post: SocialPost, kanaal: Kanaal): string {
  if (kanaal !== "facebook") {
    return post.rubriek === "uitgelicht" ? "Meer info en tickets via de link in bio." : "Volledige agenda via de link in bio.";
  }
  const url = utmUrl(new URL(doelPad(post), site.url).toString(), { source: "facebook", medium: "social", campaign: post.id });
  return post.rubriek === "uitgelicht" ? `Meer info en tickets: ${url}` : `Volledige agenda: ${url}`;
}

export function hashtags(post: SocialPost, kanaal: Kanaal): string[] {
  if (kanaal === "facebook") return KERN.slice(0, 3);
  if (kanaal === "tiktok") return KERN.slice(0, 5);
  const types = uniek(post.events.map((e) => TYPE_TAGS[e.type]).filter((t): t is string => Boolean(t)));
  const plaatsen = uniek(post.events.slice(0, MAX_EVENT_SLIDES).map((e) => slugify(e.plaats).replace(/-/g, ""))).slice(0, 3);
  return uniek([...KERN, ...types, ...plaatsen]).slice(0, 12);
}

/** Caption per kanaal; te lange captions laten eventregels van achteren weg. */
export function bouwCaption(post: SocialPost, kanaal: Kanaal): string {
  const varianten = OPENINGEN[post.rubriek];
  const opening = varianten[weekNummer(post.plaatsingsdag) % varianten.length](post);
  const regels = post.events.map((e) => eventRegel(e, kanaal));
  const extra = post.rubriek === "uitgelicht" ? detailRegels(post.events[0]) : [];
  const slot = oproep(post, kanaal);
  const tags = hashtags(post, kanaal).map((t) => `#${t}`).join(" ");

  const samenstellen = (aantal: number): string => {
    const weggelaten = regels.length - aantal;
    return normalizeProseDashes(
      [
        opening,
        "",
        ...regels.slice(0, aantal),
        ...(weggelaten > 0 ? [`…en ${weggelaten} meer op opgietingen.nl`] : []),
        ...(extra.length > 0 ? ["", ...extra] : []),
        "",
        slot,
        "",
        tags,
      ].join("\n"),
    );
  };

  let aantal = regels.length;
  let tekst = samenstellen(aantal);
  while (tekst.length > LIMIET[kanaal] && aantal > 0) {
    aantal--;
    tekst = samenstellen(aantal);
  }
  return tekst;
}
```

- [ ] **Step 4: Draai en zie slagen**

Run: `node --import tsx --test scripts/lib/social-captions.test.ts`
Expected: 6 PASS. Let op: `weekNummer("2026-09-11")` = 37, `37 % 3 = 1`, dus de weekendopening is "Zin in een opgieting dit weekend? …"; de eerste test accepteert alle drie.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social-captions.ts scripts/lib/social-captions.test.ts
git commit -m "feat(social): captions uit templates per kanaal, met hashtags, tags en tekenlimiet"
```

---

### Task 11: Planning-JSON en route `/social/planning`

**Files:**
- Create: `src/lib/social-planning.ts`
- Create: `src/app/social/planning/route.ts`
- Test: `scripts/lib/social-planning.test.ts`

- [ ] **Step 1: Falende test**

```ts
// scripts/lib/social-planning.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwPlanning } from "../../src/lib/social-planning";
import { maakEvent } from "./social-fixtures";

test("bouwPlanning: contract voor script en Buffer-adapter", () => {
  const planning = bouwPlanning(
    [maakEvent({ slug: "we", startDatum: "2026-09-12" }), maakEvent({ slug: "uit", startDatum: "2026-09-26", type: "opgietweekend" })],
    "2026-09-11",
    "http://localhost:3000",
  );
  assert.equal(planning.datum, "2026-09-11");
  assert.equal(planning.basis, "http://localhost:3000");
  const weekend = planning.posts.find((p) => p.rubriek === "weekend")!;
  assert.equal(weekend.slides[0].feed, "http://localhost:3000/social/weekend/2026-W37?formaat=feed");
  assert.equal(weekend.slides[0].story, "http://localhost:3000/social/weekend/2026-W37?formaat=story");
  assert.equal(weekend.slides[1].eventSlug, "we");
  assert.deepEqual(Object.keys(weekend.captions).sort(), ["facebook", "instagram", "tiktok"]);
  assert.ok(weekend.captions.instagram.length > 20);
  assert.ok(weekend.slides.length <= 10);
  assert.ok(!("pad" in weekend.slides[0]), "interne paden niet in het contract");
});
```

- [ ] **Step 2: Draai en zie falen**

Run: `node --import tsx --test scripts/lib/social-planning.test.ts` → FAIL.

- [ ] **Step 3: Maak `src/lib/social-planning.ts`**

```ts
import type { OpgietEvent } from "@/lib/content";
import { bouwPosts, KANALEN, type Kanaal, type PlanningEvent, type Rubriek } from "@/lib/social";
import { bouwCaption } from "@/lib/social-captions";

/*
  Het contract dat /social/planning serveert (spec §5.3). Consumenten: het
  script social-kit (nu) en de Buffer-adapter (later). Wijzig velden hier
  alleen achterwaarts compatibel.
*/

export interface PlanningSlide {
  rol: "cover" | "event" | "afsluiter";
  eventSlug?: string;
  feed: string;
  story: string;
}

export interface PlanningPost {
  id: string;
  rubriek: Rubriek;
  rang: number;
  titel: string;
  plaatsingsdag: string;
  periode: { van: string; tot: string };
  events: PlanningEvent[];
  slides: PlanningSlide[];
  captions: Record<Kanaal, string>;
}

export interface PlanningJson {
  datum: string;
  /** Oorsprong waarop de slide-URL's zijn gebouwd. */
  basis: string;
  posts: PlanningPost[];
}

export function bouwPlanning(events: OpgietEvent[], datum: string, basis: string): PlanningJson {
  const oorsprong = basis.replace(/\/$/, "");
  const posts = bouwPosts(events, datum).map((post) => ({
    id: post.id,
    rubriek: post.rubriek,
    rang: post.rang,
    titel: post.titel,
    plaatsingsdag: post.plaatsingsdag,
    periode: post.periode,
    events: post.events,
    slides: post.slides.map((s) => ({
      rol: s.rol,
      ...(s.eventSlug ? { eventSlug: s.eventSlug } : {}),
      feed: `${oorsprong}${s.pad}?formaat=feed`,
      story: `${oorsprong}${s.pad}?formaat=story`,
    })),
    captions: Object.fromEntries(KANALEN.map((k) => [k, bouwCaption(post, k)])) as Record<Kanaal, string>,
  }));
  return { datum, basis: oorsprong, posts };
}
```

- [ ] **Step 4: Maak `src/app/social/planning/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { isGeldigeIsoDatum, todayISO } from "@/lib/dates";
import { bouwPlanning } from "@/lib/social-planning";

/*
  Planning-JSON voor de social-kit (spec §5.3). Geen cache: de standaard-
  datum is "vandaag" en zou anders een dag blijven hangen. noindex via header.
*/
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const datum = request.nextUrl.searchParams.get("datum") ?? todayISO();
  if (!isGeldigeIsoDatum(datum)) {
    return Response.json({ fout: "ongeldige datum, verwacht YYYY-MM-DD" }, { status: 400 });
  }
  const planning = bouwPlanning(getAllEvents(), datum, request.nextUrl.origin);
  return Response.json(planning, {
    headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
}
```

- [ ] **Step 5: Draai tests en controleer de route**

Run: `npm run test` → groen.
Run: `npm run dev` en `curl -s "http://localhost:3000/social/planning?datum=2026-09-11" | head -c 600`
Expected: JSON met `datum`, `basis: "http://localhost:3000"` en posts; `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/social/planning?datum=2026-13-01"` → `400`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/social-planning.ts src/app/social/planning/route.ts scripts/lib/social-planning.test.ts
git commit -m "feat(social): planning-JSON (contract) en route /social/planning"
```

---

### Task 12: Renderlaag — stijl, fonts, response-helper en slide-componenten

Geen unit-tests (beeld); verificatie via de routes in Task 13.

**Files:**
- Create: `src/lib/social-stijl.ts`, `src/lib/social-fonts.ts`, `src/lib/social-render.tsx`, `src/lib/social-slides.tsx`

- [ ] **Step 1: `src/lib/social-stijl.ts`**

```ts
import type { Formaat } from "@/lib/social";

/*
  Satori kent geen Tailwind; dit zijn de hexwaarden van de themetokens in
  src/app/globals.css. Wijzigt een token, wijzig het hier mee.
*/
export const KLEUR = {
  cream: "#f7f2ea",
  sand: "#ece1d1",
  ink: "#2b2119",
  inkSoft: "#5f5044",
  wood: "#6d4a2f",
  woodDark: "#3a2718",
  ember: "#c1592a",
  emberSoft: "#e0955f",
} as const;

export const HOUT_GRADIENT = `linear-gradient(135deg, ${KLEUR.woodDark} 0%, ${KLEUR.wood} 100%)`;

export const FORMATEN: Record<Formaat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/** Boven en onder vrijhouden op story-formaat (UI-zones van Instagram/TikTok). */
export const STORY_VEILIG = 250;

export const PROFIEL = { width: 1080, height: 1080 };
export const OMSLAG = { width: 1640, height: 624 };
```

- [ ] **Step 2: `src/lib/social-fonts.ts`**

```ts
/*
  Fonts voor satori. next/font werkt daar niet, en losse fontbestanden in de
  repo zijn overbodig: de Google Fonts CSS-API levert met een oude User-Agent
  statische TTF-instanties per gewicht. Eén keer per proces geladen.
*/
export interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal";
}

const OUDE_UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; nl-nl) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
const cache = new Map<string, Promise<ArrayBuffer>>();

async function laadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const sleutel = `${family}:${weight}`;
  if (!cache.has(sleutel)) {
    const laden = (async () => {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
        headers: { "User-Agent": OUDE_UA },
      }).then((r) => r.text());
      const bron = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
      if (!bron) throw new Error(`Geen TTF-bron voor ${sleutel}`);
      const res = await fetch(bron[1]);
      if (!res.ok) throw new Error(`Font ${sleutel}: HTTP ${res.status}`);
      return res.arrayBuffer();
    })();
    laden.catch(() => cache.delete(sleutel));
    cache.set(sleutel, laden);
  }
  return cache.get(sleutel)!;
}

/** Fraunces 600 (koppen) en Inter 400/500 (tekst); undefined als het laden faalt zodat een render nooit op fonts stukloopt. */
export async function socialFonts(): Promise<SatoriFont[] | undefined> {
  try {
    const [fraunces, inter400, inter500] = await Promise.all([
      laadGoogleFont("Fraunces", 600),
      laadGoogleFont("Inter", 400),
      laadGoogleFont("Inter", 500),
    ]);
    return [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Inter", data: inter400, weight: 400, style: "normal" },
      { name: "Inter", data: inter500, weight: 500, style: "normal" },
    ];
  } catch (err) {
    console.warn("social-fonts: fallback op standaardfont:", (err as Error).message);
    return undefined;
  }
}
```

- [ ] **Step 3: `src/lib/social-render.tsx`**

```tsx
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { Formaat } from "@/lib/social";
import { socialFonts } from "@/lib/social-fonts";

/*
  Gedeelde schil om ImageResponse: formaat uit de query, vaste headers
  (noindex; een dag cache, Vercel leegt de edge-cache bij elke deploy en
  content wijzigt alleen via een deploy) en fonts.
*/

export const SOCIAL_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": "public, max-age=300, s-maxage=86400",
};

export function parseFormaat(params: URLSearchParams): Formaat {
  return params.get("formaat") === "story" ? "story" : "feed";
}

export async function slideResponse(element: ReactElement, size: { width: number; height: number }): Promise<ImageResponse> {
  return new ImageResponse(element, { ...size, fonts: await socialFonts(), headers: SOCIAL_HEADERS });
}

export function nietGevonden(): Response {
  return new Response("Niet gevonden", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
}

const aanwezig = new Map<string, Promise<boolean>>();

/**
 * Publieke URL van een beeld onder public/, of undefined als het niet bestaat.
 * Satori faalt hard op een 404-beeld; een HEAD vooraf houdt de slide overeind
 * (dan houtgradient). Beelden gaan via de eigen oorsprong (lokaal én Vercel),
 * niet via fs: public/ zit niet in de functiebundel.
 */
export async function beeldUrlAlsAanwezig(oorsprong: string, pad: string | undefined): Promise<string | undefined> {
  if (!pad) return undefined;
  const url = /^https?:\/\//.test(pad) ? pad : `${oorsprong}${pad}`;
  if (!aanwezig.has(url)) {
    aanwezig.set(
      url,
      fetch(url, { method: "HEAD" })
        .then((r) => r.ok)
        .catch(() => false),
    );
  }
  return (await aanwezig.get(url)!) ? url : undefined;
}
```

- [ ] **Step 4: `src/lib/social-slides.tsx`**

```tsx
/* eslint-disable @next/next/no-img-element -- satori rendert gewone <img>, geen next/image */
import type { ReactNode } from "react";
import type { OpgietEvent } from "@/lib/content";
import type { Formaat } from "@/lib/social";
import { FORMATEN, HOUT_GRADIENT, KLEUR, OMSLAG, PROFIEL, STORY_VEILIG } from "@/lib/social-stijl";
import { formatDateRange } from "@/lib/dates";
import { EVENT_TYPES, site } from "@/lib/site";

/*
  Slide-componenten voor satori (spec §4.4). Satori-regels: elke div met
  meerdere kinderen is flex; tekst als één string per div; <img> met
  expliciete maten. Geen Tailwind.
*/

const KOP = "Fraunces";
const TEKST = "Inter";

/** Kap op woordgrens af met beletselteken. */
export function afkap(tekst: string, max: number): string {
  if (tekst.length <= max) return tekst;
  const stuk = tekst.slice(0, max);
  const spatie = stuk.lastIndexOf(" ");
  return `${stuk.slice(0, spatie > max * 0.6 ? spatie : max).trimEnd()}…`;
}

function Steam({ kleur, grootte }: { kleur: string; grootte: number }) {
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 64 64">
      <g fill="none" stroke={kleur} strokeWidth="4.5" strokeLinecap="round">
        <path d="M21 16c0 5-5 6.5-5 11.5S21 34 21 39" />
        <path d="M33 13c0 5.5-5.5 7.5-5.5 13S33 33.5 33 39.5" />
        <path d="M45 16c0 5-5 6.5-5 11.5S45 34 45 39" />
      </g>
      <path d="M14 47h36" stroke={kleur} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ tekst }: { tekst: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        padding: "10px 26px",
        borderRadius: 999,
        background: KLEUR.ember,
        color: KLEUR.cream,
        fontSize: 28,
        fontWeight: 500,
      }}
    >
      {tekst}
    </div>
  );
}

function Canvas({ formaat, beeld, children }: { formaat: Formaat; beeld?: string; children: ReactNode }) {
  const { width, height } = FORMATEN[formaat];
  const onder = formaat === "story" ? STORY_VEILIG + 48 : 96;
  const boven = formaat === "story" ? STORY_VEILIG : 72;
  return (
    <div style={{ width, height, display: "flex", position: "relative", background: HOUT_GRADIENT, fontFamily: TEKST, color: KLEUR.cream }}>
      {beeld ? (
        <img src={beeld} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          background: beeld ? "linear-gradient(180deg, rgba(43,33,25,0.2) 0%, rgba(43,33,25,0.88) 100%)" : "transparent",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `${boven}px 72px ${onder}px 72px`,
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: formaat === "story" ? STORY_VEILIG : 40,
          display: "flex",
          fontSize: 28,
          fontWeight: 500,
          color: "#f7f2eacc",
        }}
      >
        opgietingen.nl
      </div>
    </div>
  );
}

export function CoverSlide({ formaat, beeld, label, kop, sub }: { formaat: Formaat; beeld?: string; label: string; kop: string; sub: string }) {
  return (
    <Canvas formaat={formaat} beeld={beeld}>
      <Badge tekst={label} />
      <div style={{ display: "flex", marginTop: 32, fontFamily: KOP, fontWeight: 600, fontSize: kop.length > 16 ? 92 : 112, lineHeight: 1.05 }}>{kop}</div>
      <div style={{ display: "flex", marginTop: 22, fontSize: 40, color: KLEUR.emberSoft }}>{sub}</div>
    </Canvas>
  );
}

export function EventSlide({
  formaat,
  event,
  beeld,
  logo,
}: {
  formaat: Formaat;
  event: OpgietEvent;
  /** Eigen eventbeeld of echte saunafoto; ontbreekt → houtgradient met logo. */
  beeld?: string;
  logo?: string;
}) {
  const titel = afkap(event.titel, 90);
  const wanneer = `${formatDateRange(event.startDatum, event.eindDatum)}${event.tijden ? ` · ${event.tijden}` : ""}`;
  const logoPlaat = event.sauna.logoAchtergrond === "donker" ? KLEUR.woodDark : KLEUR.cream;
  return (
    <Canvas formaat={formaat} beeld={beeld}>
      {!beeld && logo ? (
        <div style={{ display: "flex", alignSelf: "flex-start", padding: 28, borderRadius: 24, background: logoPlaat, marginBottom: 44 }}>
          <img src={logo} width={320} height={160} style={{ width: 320, height: 160, objectFit: "contain" }} />
        </div>
      ) : null}
      <Badge tekst={EVENT_TYPES[event.type]} />
      <div style={{ display: "flex", marginTop: 30, fontFamily: KOP, fontWeight: 600, fontSize: titel.length > 40 ? 64 : 78, lineHeight: 1.1, lineClamp: 3 }}>
        {titel}
      </div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 38, fontWeight: 500 }}>{`${event.sauna.naam} · ${event.sauna.plaats}`}</div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 34, color: KLEUR.emberSoft }}>{wanneer}</div>
      {event.prijsIndicatie ? <div style={{ display: "flex", marginTop: 10, fontSize: 30, color: "#f7f2eacc" }}>{event.prijsIndicatie}</div> : null}
    </Canvas>
  );
}

export function AfsluiterSlide({ formaat }: { formaat: Formaat }) {
  return (
    <Canvas formaat={formaat}>
      <Steam kleur={KLEUR.emberSoft} grootte={150} />
      <div style={{ display: "flex", marginTop: 36, fontFamily: KOP, fontWeight: 600, fontSize: 84, lineHeight: 1.08 }}>
        Alle opgietingen in Nederland en België op één plek
      </div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 42, color: KLEUR.emberSoft }}>Link in bio</div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 32, color: "#f7f2eacc" }}>Sla deze post op en deel hem met je saunamaatje.</div>
    </Canvas>
  );
}

export function ProfielSlide() {
  return (
    <div style={{ width: PROFIEL.width, height: PROFIEL.height, display: "flex", alignItems: "center", justifyContent: "center", background: KLEUR.cream }}>
      <Steam kleur={KLEUR.ember} grootte={720} />
    </div>
  );
}

export function OmslagSlide({ beeld }: { beeld?: string }) {
  const { width, height } = OMSLAG;
  return (
    <div style={{ width, height, display: "flex", position: "relative", background: HOUT_GRADIENT, fontFamily: TEKST, color: KLEUR.cream }}>
      {beeld ? <img src={beeld} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(90deg, rgba(43,33,25,0.85) 0%, rgba(43,33,25,0.35) 70%, rgba(43,33,25,0) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px" }}>
        <div style={{ display: "flex", fontFamily: KOP, fontWeight: 600, fontSize: 96 }}>{`${site.name}`}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 40, color: KLEUR.emberSoft, maxWidth: 900 }}>{site.tagline}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: geen fouten. Klaagt TS over `lineClamp` in het style-object, vervang die regel door `WebkitLineClamp: 3, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden"` (satori ondersteunt beide schrijfwijzen).

- [ ] **Step 6: Commit**

```bash
git add src/lib/social-stijl.ts src/lib/social-fonts.ts src/lib/social-render.tsx src/lib/social-slides.tsx
git commit -m "feat(social): renderlaag voor slides (stijl, fonts via Google Fonts, response-helper, componenten)"
```

---

### Task 13: Beeldroutes onder `/social/…`

**Files:**
- Create: `src/app/social/event/[slug]/route.tsx`
- Create: `src/app/social/afsluiter/route.tsx`
- Create: `src/app/social/weekend/[week]/route.tsx`
- Create: `src/app/social/maand/[maand]/route.tsx`
- Create: `src/app/social/nieuw/[datum]/route.tsx`
- Create: `src/app/social/profiel/route.tsx`
- Create: `src/app/social/omslag/route.tsx`

- [ ] **Step 1: `src/app/social/event/[slug]/route.tsx`**

```tsx
import type { NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/content";
import { beeldUrlAlsAanwezig, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { EventSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Event-slide (spec §4.4). Eigen eventbeeld of saunafoto (event.afbeelding, via de loader), anders logo. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const oorsprong = request.nextUrl.origin;
  const [beeld, logo] = await Promise.all([
    beeldUrlAlsAanwezig(oorsprong, event.afbeelding),
    beeldUrlAlsAanwezig(oorsprong, event.sauna.logo),
  ]);
  return slideResponse(<EventSlide formaat={formaat} event={event} beeld={beeld} logo={logo} />, FORMATEN[formaat]);
}
```

- [ ] **Step 2: `src/app/social/afsluiter/route.tsx`**

```tsx
import type { NextRequest } from "next/server";
import { parseFormaat, slideResponse } from "@/lib/social-render";
import { AfsluiterSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

export async function GET(request: NextRequest) {
  const formaat = parseFormaat(request.nextUrl.searchParams);
  return slideResponse(<AfsluiterSlide formaat={formaat} />, FORMATEN[formaat]);
}
```

- [ ] **Step 3: `src/app/social/weekend/[week]/route.tsx`**

```tsx
import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { formatDagKort, weekendVanIsoWeek } from "@/lib/dates";
import { aantalTekst, weekendEvents } from "@/lib/social";
import { beeldUrlAlsAanwezig, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { CoverSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover "Dit weekend" per ISO-week, bv. /social/weekend/2026-W37. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const weekend = weekendVanIsoWeek(week);
  if (!weekend) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const events = weekendEvents(getAllEvents(), week);
  const beeld = await beeldUrlAlsAanwezig(request.nextUrl.origin, "/images/social/weekend.jpg");
  return slideResponse(
    <CoverSlide
      formaat={formaat}
      beeld={beeld}
      label="Dit weekend"
      kop={aantalTekst(events.length)}
      sub={`${formatDagKort(weekend.van)} t/m ${formatDagKort(weekend.tot)}`}
    />,
    FORMATEN[formaat],
  );
}
```

- [ ] **Step 4: `src/app/social/maand/[maand]/route.tsx`**

```tsx
import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { monthYearLabel } from "@/lib/dates";
import { aantalTekst, maandEvents } from "@/lib/social";
import { beeldUrlAlsAanwezig, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { CoverSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover "Deze maand", bv. /social/maand/oktober-2026. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ maand: string }> }) {
  const { maand } = await params;
  const label = monthYearLabel(maand);
  if (!label) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const events = maandEvents(getAllEvents(), maand);
  const beeld = await beeldUrlAlsAanwezig(request.nextUrl.origin, "/images/social/maand.jpg");
  return slideResponse(
    <CoverSlide formaat={formaat} beeld={beeld} label="Deze maand" kop={aantalTekst(events.length)} sub={label} />,
    FORMATEN[formaat],
  );
}
```

- [ ] **Step 5: `src/app/social/nieuw/[datum]/route.tsx`**

```tsx
import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { isGeldigeIsoDatum } from "@/lib/dates";
import { aantalTekst, nieuweEvents } from "@/lib/social";
import { beeldUrlAlsAanwezig, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { CoverSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover "Nieuw in de agenda": events gepubliceerd in de zeven dagen t/m `datum`. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ datum: string }> }) {
  const { datum } = await params;
  if (!isGeldigeIsoDatum(datum)) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const events = nieuweEvents(getAllEvents(), datum);
  const beeld = await beeldUrlAlsAanwezig(request.nextUrl.origin, "/images/social/nieuw.jpg");
  return slideResponse(
    <CoverSlide formaat={formaat} beeld={beeld} label="Nieuw in de agenda" kop={aantalTekst(events.length)} sub="Deze week toegevoegd" />,
    FORMATEN[formaat],
  );
}
```

- [ ] **Step 6: `src/app/social/profiel/route.tsx` en `src/app/social/omslag/route.tsx`**

```tsx
// src/app/social/profiel/route.tsx
import { slideResponse } from "@/lib/social-render";
import { ProfielSlide } from "@/lib/social-slides";
import { PROFIEL } from "@/lib/social-stijl";

export async function GET() {
  return slideResponse(<ProfielSlide />, PROFIEL);
}
```

```tsx
// src/app/social/omslag/route.tsx
import type { NextRequest } from "next/server";
import { beeldUrlAlsAanwezig, slideResponse } from "@/lib/social-render";
import { OmslagSlide } from "@/lib/social-slides";
import { OMSLAG } from "@/lib/social-stijl";

export async function GET(request: NextRequest) {
  const beeld = await beeldUrlAlsAanwezig(request.nextUrl.origin, "/images/hero/hero-desktop.jpg");
  return slideResponse(<OmslagSlide beeld={beeld} />, OMSLAG);
}
```

- [ ] **Step 7: Verifieer alle routes lokaal**

Run: `npm run dev`. Bepaal een gepubliceerd event met eigen beeld (`grep -l "afbeelding:" content/events/*.mdx | head -1`) en een zonder. Open in de browser:

- `http://localhost:3000/social/event/<slug-met-beeld>` en `…?formaat=story` → foto met overlay, badge, titel, sauna, datum; story met lege zones boven/onder.
- `http://localhost:3000/social/event/<slug-zonder-beeld>` → houtgradient met logo op plaat (of alleen typografie zonder logo).
- `http://localhost:3000/social/weekend/2026-W37`, `/social/maand/oktober-2026`, `/social/nieuw/2026-09-11` → cover met houtgradient (sfeerbeelden ontbreken nog; geen 500).
- `/social/afsluiter`, `/social/profiel`, `/social/omslag`.
- `curl -sI http://localhost:3000/social/afsluiter | grep -i "x-robots-tag\|cache-control\|content-type"` → `noindex`, `public, max-age=300, s-maxage=86400`, `image/png`.
- `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/social/weekend/2026-W99` → `404`; `/social/event/bestaat-niet` → `404`.

Controleer in de terminal dat er geen `social-fonts: fallback`-waarschuwing staat (dan laadden de fonts).

- [ ] **Step 8: Commit**

```bash
git add src/app/social
git commit -m "feat(social): beeldroutes voor covers, event-slides, afsluiter, profiel en omslag"
```

---

### Task 14: Script `npm run social-kit`

**Files:**
- Create: `scripts/lib/social-kit.ts`
- Create: `scripts/social-kit.ts`
- Modify: `package.json` (scripts), `.gitignore`
- Test: `scripts/lib/social-kit.test.ts`

- [ ] **Step 1: Falende test**

```ts
// scripts/lib/social-kit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestandsnaam, captionsMarkdown, downloadPost } from "./social-kit";
import type { PlanningPost } from "../../src/lib/social-planning";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const post: PlanningPost = {
  id: "weekend-2026-W37",
  rubriek: "weekend",
  rang: 1,
  titel: "Dit weekend: 1 opgieting",
  plaatsingsdag: "2026-09-11",
  periode: { van: "2026-09-11", tot: "2026-09-13" },
  events: [],
  slides: [
    { rol: "cover", feed: "https://x/social/weekend/2026-W37?formaat=feed", story: "https://x/social/weekend/2026-W37?formaat=story" },
    { rol: "event", eventSlug: "herfstgloed", feed: "https://x/social/event/herfstgloed?formaat=feed", story: "https://x/social/event/herfstgloed?formaat=story" },
    { rol: "afsluiter", feed: "https://x/social/afsluiter?formaat=feed", story: "https://x/social/afsluiter?formaat=story" },
  ],
  captions: { instagram: "IG-tekst", facebook: "FB-tekst", tiktok: "TT-tekst" },
};

test("bestandsnaam: volgnummer, rol, eventslug en formaat", () => {
  assert.equal(bestandsnaam(0, post.slides[0], "feed"), "01-cover-feed.png");
  assert.equal(bestandsnaam(1, post.slides[1], "story"), "02-event-herfstgloed-story.png");
  assert.equal(bestandsnaam(2, post.slides[2], "feed"), "03-afsluiter-feed.png");
});

test("captionsMarkdown: titel, plaatsingsdag, slides en drie kanalen", () => {
  const md = captionsMarkdown(post);
  assert.match(md, /^# Dit weekend: 1 opgieting\n/);
  assert.match(md, /Plaatsingsdag: 2026-09-11/);
  assert.match(md, /- 02 event \(herfstgloed\)/);
  assert.match(md, /## Instagram\n\nIG-tekst/);
  assert.match(md, /## Facebook\n\nFB-tekst/);
  assert.match(md, /## TikTok\n\nTT-tekst/);
});

test("downloadPost: schrijft slides en captions; ruimt de map op bij een mislukte download", async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), "social-kit-"));
  const ok = async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  await downloadPost(post, map, ["feed"], ok);
  assert.ok(fs.existsSync(path.join(map, "01-cover-feed.png")));
  assert.ok(fs.existsSync(path.join(map, "03-afsluiter-feed.png")));
  assert.ok(!fs.existsSync(path.join(map, "01-cover-story.png")), "alleen het gevraagde formaat");
  assert.ok(fs.existsSync(path.join(map, "captions.md")));

  const kapot = async (url: string) => new Response("", { status: url.includes("herfstgloed") ? 404 : 200 });
  await assert.rejects(() => downloadPost(post, map, ["feed"], kapot), /404/);
  assert.ok(!fs.existsSync(map), "halve kit wordt verwijderd");
});
```

- [ ] **Step 2: Draai en zie falen**

Run: `node --import tsx --test scripts/lib/social-kit.test.ts` → FAIL (module ontbreekt).

- [ ] **Step 3: Maak `scripts/lib/social-kit.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import type { PlanningPost, PlanningSlide } from "../../src/lib/social-planning";
import type { Formaat } from "../../src/lib/social";

/* Pure helpers van het social-kit-script; het script zelf regelt flags en de planning-fetch. */

export function bestandsnaam(index: number, slide: PlanningSlide, formaat: Formaat): string {
  const nr = String(index + 1).padStart(2, "0");
  const slug = slide.eventSlug ? `-${slide.eventSlug}` : "";
  return `${nr}-${slide.rol}${slug}-${formaat}.png`;
}

const KANAAL_LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" } as const;

export function captionsMarkdown(post: PlanningPost): string {
  const slides = post.slides.map((s, i) => `- ${String(i + 1).padStart(2, "0")} ${s.rol}${s.eventSlug ? ` (${s.eventSlug})` : ""}`);
  const kanalen = (Object.keys(KANAAL_LABEL) as (keyof typeof KANAAL_LABEL)[]).flatMap((k) => [`## ${KANAAL_LABEL[k]}`, "", post.captions[k], ""]);
  return [
    `# ${post.titel}`,
    "",
    `Plaatsingsdag: ${post.plaatsingsdag}`,
    `Rubriek: ${post.rubriek}${post.rang > 1 ? ` (kandidaat ${post.rang})` : ""}`,
    `Periode: ${post.periode.van} t/m ${post.periode.tot}`,
    "",
    "## Slides",
    "",
    ...slides,
    "",
    ...kanalen,
  ].join("\n");
}

export type Ophalen = (url: string) => Promise<Response>;

/**
 * Downloadt alle slides van één post in de gevraagde formaten naar `map` en
 * schrijft captions.md. Faalt één download, dan wordt de hele map verwijderd:
 * een halve kit is verwarrender dan geen kit.
 */
export async function downloadPost(post: PlanningPost, map: string, formaten: Formaat[], ophalen: Ophalen = fetch): Promise<void> {
  fs.rmSync(map, { recursive: true, force: true });
  fs.mkdirSync(map, { recursive: true });
  try {
    for (const [i, slide] of post.slides.entries()) {
      for (const formaat of formaten) {
        const res = await ophalen(slide[formaat]);
        if (!res.ok) throw new Error(`${slide[formaat]}: HTTP ${res.status}`);
        fs.writeFileSync(path.join(map, bestandsnaam(i, slide, formaat)), Buffer.from(await res.arrayBuffer()));
      }
    }
    fs.writeFileSync(path.join(map, "captions.md"), captionsMarkdown(post));
  } catch (err) {
    fs.rmSync(map, { recursive: true, force: true });
    throw err;
  }
}
```

- [ ] **Step 4: Maak `scripts/social-kit.ts`**

```ts
/*
  Social-kit: haalt de weekplanning en alle slides van de site en zet ze klaar
  om in Buffer in te plannen (spec §6).

    npm run social-kit                                  # vandaag, van opgietingen.nl
    npm run social-kit -- --datum 2026-09-18            # andere referentiedatum
    npm run social-kit -- --basis http://localhost:3000 # lokale dev-server
    npm run social-kit -- --formaat feed                # feed | story | beide (default)
    npm run social-kit -- --map data/social             # doelmap (default)

  Uitvoer: data/social/<datum>/<post-id>/NN-<rol>[-<slug>]-<formaat>.png + captions.md
*/
import path from "node:path";
import { todayISOInTimeZone } from "../src/lib/dates";
import type { Formaat } from "../src/lib/social";
import type { PlanningJson } from "../src/lib/social-planning";
import { downloadPost } from "./lib/social-kit";

function flag(naam: string, standaard: string): string {
  const i = process.argv.indexOf(naam);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : standaard;
}

const DATUM = flag("--datum", todayISOInTimeZone());
const BASIS = flag("--basis", "https://opgietingen.nl").replace(/\/$/, "");
const FORMAAT = flag("--formaat", "beide");
const MAP = flag("--map", "data/social");

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATUM)) throw new Error(`Ongeldige --datum: ${DATUM}`);
  const formaten: Formaat[] = FORMAAT === "beide" ? ["feed", "story"] : FORMAAT === "story" ? ["story"] : ["feed"];

  const url = `${BASIS}/social/planning?datum=${DATUM}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
  const planning = (await res.json()) as PlanningJson;

  if (planning.posts.length === 0) {
    console.log(`Geen posts voor ${DATUM}: de agenda is leeg voor deze week.`);
    return;
  }

  console.log(`Social-kit voor ${DATUM} (${planning.posts.length} posts) → ${MAP}/${DATUM}/\n`);
  for (const post of planning.posts) {
    const map = path.join(process.cwd(), MAP, DATUM, post.id);
    await downloadPost(post, map, formaten);
    const kandidaat = post.rang > 1 ? ` (kandidaat ${post.rang})` : "";
    console.log(
      `${post.plaatsingsdag}  ${post.rubriek.padEnd(10)} ${String(post.slides.length).padStart(2)} slides  ${String(post.events.length).padStart(2)} events  ${post.titel}${kandidaat}`,
    );
  }
  console.log("\nKlaar. Sleep de PNG's in Buffer en plak de caption uit captions.md.");
}

main().catch((err) => {
  console.error(`social-kit: ${(err as Error).message}`);
  process.exit(1);
});
```

- [ ] **Step 5: `package.json` en `.gitignore`**

In `scripts` toevoegen (na `"run-record"`):

```json
    "social-kit": "tsx scripts/social-kit.ts",
    "vind-instagram": "tsx scripts/vind-instagram.ts"
```

(`vind-instagram` komt in Task 15.) In `.gitignore` onderaan:

```
# social-kit: lokaal gegenereerde slides + captions voor Buffer (spec 2026-09-08)
/data/social/
```

- [ ] **Step 6: Draai tests en het script tegen de dev-server**

Run: `node --import tsx --test scripts/lib/social-kit.test.ts` → 3 PASS.
Run (met `npm run dev` actief): `npm run social-kit -- --basis http://localhost:3000 --datum 2026-09-11 --formaat feed`
Expected: een regel per post en een map `data/social/2026-09-11/weekend-2026-W37/` met `01-cover-feed.png`, event-slides, afsluiter en `captions.md`. Open een PNG.

- [ ] **Step 7: Commit**

```bash
git add scripts/social-kit.ts scripts/lib/social-kit.ts scripts/lib/social-kit.test.ts package.json .gitignore
git commit -m "feat(social): npm run social-kit — planning + slides + captions lokaal klaarzetten voor Buffer"
```

---

### Task 15: Instagram-handles van sauna's vinden en vullen

**Files:**
- Create: `scripts/vind-instagram.ts`
- Modify: `content/saunas/*.mdx` (veld `instagram` waar gevonden)

- [ ] **Step 1: Maak `scripts/vind-instagram.ts`**

```ts
/*
  Zoekt Instagram-handles op de eigen websites van sauna-profielen zonder
  `instagram`-veld en print voorstellen. Schrijft niets: een handle opvoeren
  is een claim over de sauna, dus die gaat handmatig het profiel in.

    npm run vind-instagram
*/
import { getAllSaunas } from "../src/lib/content";
import { fetchUrl, isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";

// Paden op instagram.com die geen profiel zijn.
const GEEN_PROFIEL = new Set(["p", "reel", "reels", "explore", "accounts", "share", "stories", "tv", "about", "legal", "directory", "developer", "web"]);

async function main() {
  const saunas = getAllSaunas().filter((s) => s.website && !s.instagram);
  console.log(`${saunas.length} profielen zonder instagram-veld.\n`);
  for (const s of saunas) {
    const site = s.website!;
    if (!(await isAllowed(site))) {
      console.log(`${s.slug.padEnd(28)} robots.txt staat ophalen niet toe`);
      continue;
    }
    const res = await fetchUrl(site, 15000);
    if (!res.ok) {
      console.log(`${s.slug.padEnd(28)} fout: ${res.error ?? `HTTP ${res.status}`}`);
      continue;
    }
    const handles = new Set<string>();
    for (const m of res.body.matchAll(/instagram\.com\/([A-Za-z0-9._]{1,30})/g)) {
      if (!GEEN_PROFIEL.has(m[1].toLowerCase())) handles.add(m[1].replace(/\.$/, ""));
    }
    console.log(`${s.slug.padEnd(28)} ${handles.size > 0 ? [...handles].join(", ") : "-"}`);
    await sleep(REQUEST_DELAY_MS);
  }
}

main().catch((err) => {
  console.error(`vind-instagram: ${(err as Error).message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Draai het script**

Run: `npm run vind-instagram`
Expected: per profiel één regel met 0, 1 of meer handles (duurt ~2 minuten door de nette vertraging).

- [ ] **Step 3: Vul de profielen**

Voor elk profiel met precies één handle: open `https://www.instagram.com/<handle>/` in de browser en controleer dat het de sauna is. Voeg dan aan de frontmatter van `content/saunas/<slug>.mdx` toe, direct onder `website:`:

```yaml
instagram: <handle>
```

Profielen met meerdere of geen handles: overslaan (Nathaniel kan ze later in Keystatic invullen). Geen handle uit andere bronnen dan de eigen website.

- [ ] **Step 4: Tests en commit**

Run: `npm run test` (keystatic-schema.test.ts valideert de gewijzigde profielen).

```bash
git add scripts/vind-instagram.ts content/saunas
git commit -m "feat(content): instagram-handles op sauna-profielen (gevonden op de eigen websites) + vind-instagram-script"
```

---

### Task 16: Documentatie — image-prompts, CLAUDE.md, spec

**Files:**
- Modify: `docs/image-prompts.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md`

- [ ] **Step 1: `docs/image-prompts.md` — nieuwe sectie onderaan**

```markdown
---

## Social-covers (social-kit)

Drie sfeerbeelden voor de covers van de wekelijkse posts. Bestanden: `public/images/social/weekend.jpg`,
`maand.jpg`, `nieuw.jpg`. Formaat **9:16 (1080×1920)**, JPEG, ≤ 400 KB (de route knipt zelf naar 4:5 voor de
feed). Er komt tekst óver het onderste twee derde, dus houd dat deel rustig en donker genoeg. Geen herkenbare
interieurs: dit zijn generieke sfeerbeelden, geen foto's van een specifieke sauna.

Gebruik de basis-prompt met `Output: photorealistic, natural film grain, warm tones, 9:16 vertical` en:

### weekend.jpg
> Scene: close-up of a towel mid-swing in a dim sauna, warm ember glow from below, thick soft steam filling the
> upper half of the frame, lower half dark and calm for text overlay.

### maand.jpg
> Scene: a row of small wooden sauna buckets and ladles on a bench, one bucket steaming, low golden side light,
> deep shadow in the lower half for text overlay.

### nieuw.jpg
> Scene: a single ladle pouring water onto glowing sauna stones, sharp burst of steam rising, dark wooden wall
> behind, lower half fading to near-black for text overlay.

Zolang een bestand ontbreekt, valt de cover terug op de houtgradient (geen fout).
```

- [ ] **Step 2: `CLAUDE.md`**

In de projectstructuur onder `src/lib/`:

```
    utm.ts          # UTM-helper (kanaal → utm_source), gebruikt door /links, deelknoppen en captions
    social*.ts(x)   # social-kit: selectie (social.ts), captions, planning-JSON, render (satori) en slides
```

Onder `scripts/`:

```
  social-kit.ts     # haalt planning + slides van de site → data/social/<datum>/ (klaarzetten voor Buffer)
  vind-instagram.ts # print Instagram-handles die op sauna-websites staan (voorstellen, schrijft niets)
```

In de routes-tabel:

```
| `/links` | Link-in-bio op eigen domein; `?k=instagram|facebook|tiktok` zet UTM's op elke knop; noindex |
| `/social/planning` | JSON met de posts van een week (`?datum=`); contract voor `social-kit` en de latere Buffer-adapter |
| `/social/{weekend,maand,nieuw}/[…]`, `/social/event/[slug]`, `/social/afsluiter`, `/social/profiel`, `/social/omslag` | Slides als PNG (`?formaat=feed|story`), noindex-header, niet in robots-disallow (Facebook-fetcher) |
```

In het datamodel: bij **Sauna** `instagram` (handle zonder @, alleen van de eigen website; tagging + `sameAs`); bij **Event** `gepubliceerdOp` (gezet door de scraper bij autopublicatie; handmatig in Keystatic; voedt "Nieuw in de agenda").

Nieuwe sectie na *Run-metrics*:

```markdown
## Social-kit

Wekelijkse posts voor Instagram, Facebook en TikTok uit de agenda (spec: [docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md](docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md)). Vier rubrieken: *Dit weekend* (vrijdag), *Nieuw in de agenda* (maandag), *Uitgelicht* (woensdag, drie kandidaten), *Deze maand* (de 1e). Selectie en captions zijn pure functies in `src/lib/social*.ts` (tests in `scripts/lib/social*.test.ts`); de slides worden live gerenderd onder `/social/…` met `next/og` (fonts via de Google Fonts CSS-API, beelden via de eigen oorsprong met HEAD-check; ontbrekend sfeerbeeld = houtgradient). `npm run social-kit -- --datum <vrijdag>` haalt alles naar `data/social/` (gitignored); Nathaniel plant het vrijdag in Buffer. Sociale kanalen staan in `socials` (`src/lib/site.ts`); Facebook linkt op paginanummer tot er een gebruikersnaam is. Automatisch plaatsen (Buffer-API, deelproject 2) leest hetzelfde `/social/planning`-contract. Geen beelden die suggereren hoe een specifieke sauna eruitziet; captions feitelijk, geen em-streepjes.
```

In *Commando's*:

```bash
npm run social-kit      # planning + slides + captions van de site → data/social/<datum>/ (-- --datum, --basis, --formaat)
npm run vind-instagram  # voorstellen voor instagram-handles uit sauna-websites (schrijft niets)
```

- [ ] **Step 3: Commit**

```bash
git add docs/image-prompts.md CLAUDE.md
git commit -m "docs: social-kit, /links en socials gedocumenteerd"
```

---

### Task 17: Eindverificatie

- [ ] **Step 1: Volledige controle**

Run: `npm run test && npm run lint && npm run build`
Expected: alle tests groen, lint zonder fouten (waarschuwingen over `<img>` mogen niet voorkomen dankzij de disable-comment), build slaagt en toont de nieuwe routes (`/links` als dynamisch, `/social/…` als route-handlers).

- [ ] **Step 2: Handmatige checklist (`npm run start` na de build)**

- Footer: drie iconen, openen in nieuw tabblad; `/over` toont de zin met links.
- Homepage bron: `curl -s http://localhost:3000 | grep -o '"sameAs":\[[^]]*\]'` bevat de drie URL's.
- `/links?k=facebook`: knoppen met `utm_source=facebook`; `noindex` in de meta.
- Eventpagina: deelrij; WhatsApp-URL met UTM; afgelopen event geen deelrij.
- `/social/planning?datum=2026-09-11`: `Cache-Control: no-store`.
- `npm run social-kit -- --basis http://localhost:3000 --datum 2026-09-11`: map met PNG's en captions.md; captions zonder em-streepje (`grep -r "—" data/social && echo FOUT || echo ok`).
- Story-formaat: open een `-story.png` en controleer dat boven en onder ~250 px leeg zijn.

- [ ] **Step 3: Na de merge (Nathaniel)**

De account-checklist uit spec §8.1, de drie sfeerbeelden in `public/images/social/`, en de twee Buffer-verificatiepunten uit spec §7 (PNG voor Instagram; carrousels via de API).

---

## Afwijkingen van de spec (al in de spec verwerkt op 2026-09-08)

1. **Fonts** via de Google Fonts CSS-API in plaats van meegeleverde TTF-bestanden: geen fontbestanden in de repo, geen `fs` in de functie, en de site gebruikt dezelfde bron al via `next/font/google`.
2. **Beelden** via de eigen oorsprong met HEAD-check in plaats van `fs`-reads als data-URL: `public/` zit niet in de Vercel-functiebundel, en een ontbrekend beeld mag geen 500 geven.
3. **`src/lib/text.ts`** (bestaand) in plaats van een nieuw `src/lib/tekst.ts` voor de streepjes-normalisatie.
4. **Volg-links** in de merk-cel van de footer in plaats van een zesde kolom (grid blijft `lg:grid-cols-5`).

## Self-review (uitgevoerd bij het schrijven)

- **Spec-dekking:** §3.1–3.5 → Tasks 4–8; §4.1–4.6 → Tasks 3, 12, 13; §5.1–5.4 → Tasks 1, 9, 10, 11; §6 → Task 14; §4.6 vullen → Task 15; §8/§9 documentatie en handmatige checks → Tasks 16, 17. §7 (Buffer-adapter) is bewust buiten scope; het contract (§5.3) staat in Task 11.
- **Typen:** `Formaat`, `Kanaal`, `Rubriek`, `PlanningEvent`, `Slide`, `SocialPost` in `social.ts`; `PlanningSlide`/`PlanningPost`/`PlanningJson` in `social-planning.ts`; `SatoriFont` in `social-fonts.ts`; `Social`/`SocialId`/`socials` in `site.ts`; `utmUrl`/`kanaalUitParam` in `utm.ts`. Namen zijn in alle taken gelijk gehouden.
- **Placeholders:** geen; elke codestap bevat de volledige code.
