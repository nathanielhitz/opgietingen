# Facebook-postscraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatisch Facebook-postaankondigingen van sauna's in de agenda opnemen, via een gratis `gallery-dl`-fetch-laag die door dezelfde extractie/poort/dedup-keten gaat als de bestaande scrapers.

**Architecture:** Een nieuwe fetch-laag (`src/lib/facebook.ts`) haalt met `gallery-dl` (subprocess, geen login) de recente foto-posts van elke bron met een `facebook`-veld op. Een nieuw script (`scripts/scrape-facebook.ts`), qua opzet een kruising tussen `scrape-events.ts` (publicatielogica) en `scrape-mail.ts` (tekst-extractie via `extractEventsFromText`), verwerkt de caption-tekst tot events. Publicatieregel is identiek aan de website-scraper. Een klein gedeeld hulpmiddel (`scripts/lib/warnings.ts`) voorkomt dat twee scrape-scripts in dezelfde workflow-run elkaars `scrape-warnings.json` overschrijven.

**Tech Stack:** TypeScript (tsx), Node.js `child_process` (subprocess naar `gallery-dl`), bestaande `@anthropic-ai/sdk`-extractieroute, `node:test` voor unit-tests.

**Spec:** [docs/superpowers/specs/2026-08-26-facebook-postscraper-design.md](../specs/2026-08-26-facebook-postscraper-design.md)

---

## File Structure

- **Create:** `scripts/lib/warnings.ts` — gedeelde helper die warnings toevoegt aan `scrape-warnings.json` in plaats van het te overschrijven.
- **Create:** `scripts/lib/warnings.test.ts` — tests voor die helper.
- **Modify:** `scripts/scrape-events.ts` — gebruikt de gedeelde helper in plaats van een eigen inline write.
- **Create:** `src/lib/facebook.ts` — fetch-laag: pure parsing/filtering + de subprocess-wrapper `fetchFacebookPosts`.
- **Create:** `scripts/lib/facebook.test.ts` — tests voor de pure functies in `src/lib/facebook.ts` (test leeft in `scripts/lib/` omdat de testrunner alleen `scripts/**/*.test.ts` oppikt — zelfde patroon als bestaande tests die uit `src/lib/` importeren, bv. `scripts/lib/event-meta.test.ts`).
- **Create:** `scripts/scrape-facebook.ts` — het scrape-script zelf (CLI entry point).
- **Modify:** `package.json` — nieuw `scrape-facebook`-npm-script.
- **Modify:** `.github/workflows/scrape.yml` — nieuwe CI-stappen.
- **Modify:** `CLAUDE.md` — documentatie.

---

### Task 1: Gedeelde warnings-helper (`scripts/lib/warnings.ts`)

**Waarom eerst:** zowel het bestaande `scrape-events.ts` als het nieuwe `scrape-facebook.ts` schrijven straks naar `scrape-warnings.json` binnen dezelfde workflow-run. Zonder een gedeelde "append"-helper overschrijft de tweede aanroep de eerste, en zou `scrape-report.ts` (dat het bestand als één geheel leest) de helft van de waarschuwingen missen.

**Files:**
- Create: `scripts/lib/warnings.ts`
- Test: `scripts/lib/warnings.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Maak `scripts/lib/warnings.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendScrapeWarnings } from "./warnings";

// appendScrapeWarnings schrijft naar process.cwd()/scrape-warnings.json; de
// tests draaien tijdelijk in een lege map zodat ze het echte bestand niet raken.
function withTmpCwd(fn: () => void): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "warnings-test-"));
  const origCwd = process.cwd();
  process.chdir(tmp);
  try {
    fn();
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("appendScrapeWarnings maakt het bestand aan als het nog niet bestaat", () => {
  withTmpCwd(() => {
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna A", melding: "test" }]);
    const data = JSON.parse(fs.readFileSync("scrape-warnings.json", "utf-8"));
    assert.equal(data.run, "2026-08-26");
    assert.deepEqual(data.warnings, [{ bron: "Sauna A", melding: "test" }]);
  });
});

test("appendScrapeWarnings voegt toe aan een bestaand bestand i.p.v. te overschrijven", () => {
  withTmpCwd(() => {
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna A", melding: "eerste" }]);
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna B", melding: "tweede" }]);
    const data = JSON.parse(fs.readFileSync("scrape-warnings.json", "utf-8"));
    assert.deepEqual(data.warnings, [
      { bron: "Sauna A", melding: "eerste" },
      { bron: "Sauna B", melding: "tweede" },
    ]);
  });
});

test("appendScrapeWarnings start opnieuw als het bestaande bestand onleesbaar is", () => {
  withTmpCwd(() => {
    fs.writeFileSync("scrape-warnings.json", "geen geldige JSON");
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna A", melding: "test" }]);
    const data = JSON.parse(fs.readFileSync("scrape-warnings.json", "utf-8"));
    assert.deepEqual(data.warnings, [{ bron: "Sauna A", melding: "test" }]);
  });
});
```

- [ ] **Step 2: Bevestig dat de test faalt**

Run: `node --import tsx --test scripts/lib/warnings.test.ts`
Expected: FAIL — `Cannot find module './warnings'` (of vergelijkbare importfout).

- [ ] **Step 3: Implementeer de helper**

Maak `scripts/lib/warnings.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

export interface ScrapeWarning {
  bron: string;
  melding: string;
}

/**
 * Voegt warnings toe aan scrape-warnings.json in plaats van het te
 * overschrijven: meerdere scrape-scripts (events, facebook) draaien na elkaar
 * in dezelfde workflow-run en schrijven naar hetzelfde bestand, dat
 * scrape-report.ts als één geheel leest. Bestaat het bestand nog niet (eerste
 * script in de run) dan wordt het aangemaakt. Pad wordt per aanroep bepaald
 * (niet als module-constante) zodat dit ook binnen een tijdelijke testmap werkt.
 */
export function appendScrapeWarnings(run: string, nieuw: ScrapeWarning[]): void {
  const bestandspad = path.join(process.cwd(), "scrape-warnings.json");
  let bestaand: ScrapeWarning[] = [];
  if (fs.existsSync(bestandspad)) {
    try {
      const data = JSON.parse(fs.readFileSync(bestandspad, "utf-8")) as { warnings?: ScrapeWarning[] };
      bestaand = data.warnings ?? [];
    } catch {
      bestaand = [];
    }
  }
  fs.writeFileSync(
    bestandspad,
    JSON.stringify({ run, warnings: [...bestaand, ...nieuw] }, null, 2) + "\n",
  );
}
```

- [ ] **Step 4: Bevestig dat de test slaagt**

Run: `node --import tsx --test scripts/lib/warnings.test.ts`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/warnings.ts scripts/lib/warnings.test.ts
git commit -m "feat(scraper): gedeelde append-helper voor scrape-warnings.json"
```

---

### Task 2: `scrape-events.ts` gebruikt de gedeelde helper

**Files:**
- Modify: `scripts/scrape-events.ts`

- [ ] **Step 1: Vervang de inline write door de gedeelde helper**

In `scripts/scrape-events.ts`, voeg de import toe naast de bestaande imports uit `./lib/content`:

```ts
import { evaluateEvent, OPGIET_RE } from "./lib/quality-gate";
import { appendScrapeWarnings } from "./lib/warnings";
import { isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";
```

Verwijder de losse constante (rond regel 52-53):

```ts
/** Waarschuwingen per run; scrape-report neemt ze mee in het wekelijkse issue. */
const WARNINGS_PATH = "scrape-warnings.json";
```

Vervang het bestaande schrijfblok aan het einde van `main()`:

```ts
  if (!DRY_RUN) {
    fs.writeFileSync(
      WARNINGS_PATH,
      JSON.stringify({ run: TODAY, warnings: rapportWarnings }, null, 2) + "\n",
    );
  }
  console.log(
    `Klaar. ${written} nieuw event(s), ${skipped} overgeslagen (dedup), ` +
      `${rapportWarnings.length} waarschuwing(en)${DRY_RUN ? "" : ` → ${WARNINGS_PATH}`}.`,
  );
```

door:

```ts
  if (!DRY_RUN) appendScrapeWarnings(TODAY, rapportWarnings);
  console.log(
    `Klaar. ${written} nieuw event(s), ${skipped} overgeslagen (dedup), ` +
      `${rapportWarnings.length} waarschuwing(en)${DRY_RUN ? "" : " → scrape-warnings.json"}.`,
  );
```

- [ ] **Step 2: Rooktest — het script draait nog steeds end-to-end**

Run: `npm run scrape -- --dry-run`
Expected: het vertrouwde dry-run-verslag ("Scraper gestart (DRY-RUN). ... Klaar. 4 nieuw event(s), 2 overgeslagen (dedup), ..."), zonder importfouten of TypeScript-fouten. (Dry-run schrijft nooit naar `scrape-warnings.json` — dat pad wordt hier dus niet uitgeoefend; deze stap bevestigt alleen dat de refactor het script niet breekt. De echte schrijf-route wordt in Task 5 opnieuw geraakt door `scrape-facebook.ts`.)

- [ ] **Step 3: Volledige testsuite blijft groen**

Run: `npm run test`
Expected: alle tests slagen (inclusief de nieuwe `warnings.test.ts` uit Task 1).

- [ ] **Step 4: Commit**

```bash
git add scripts/scrape-events.ts
git commit -m "refactor(scraper): scrape-events.ts gebruikt de gedeelde warnings-helper"
```

---

### Task 3: Pure parsing/filtering in `src/lib/facebook.ts`

**Files:**
- Create: `src/lib/facebook.ts` (dit task: alleen `parseGalleryDlOutput` + `filterRecentePosts` + types)
- Test: `scripts/lib/facebook.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Maak `scripts/lib/facebook.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGalleryDlOutput, filterRecentePosts } from "../../src/lib/facebook";

// Verkorte, maar structureel identieke vorm van echte `gallery-dl -j`-output
// (geverifieerd tegen https://www.facebook.com/ThermenBinnenmaas/photos): elke
// post komt twee keer voor (een Directory- en een Url-Message), telkens met de
// post-metadata als LAATSTE array-element.
const VOORBEELD_STDOUT = JSON.stringify([
  [
    2,
    {
      caption: "Opgietweekend! Zaterdag 26 en zondag 27 september.",
      date: "2026-08-24 08:30:03",
      id: "1365586929090243",
    },
  ],
  [
    3,
    "https://scontent.example/photo1.jpg",
    {
      caption: "Opgietweekend! Zaterdag 26 en zondag 27 september.",
      date: "2026-08-24 08:30:03",
      id: "1365586929090243",
    },
  ],
  [
    2,
    { caption: "Regenachtige dag? Kom lekker genieten.", date: "2026-06-01 10:00:00", id: "999888777" },
  ],
  [
    3,
    "https://scontent.example/photo2.jpg",
    { caption: "Regenachtige dag? Kom lekker genieten.", date: "2026-06-01 10:00:00", id: "999888777" },
  ],
]);

test("parseGalleryDlOutput dedupliceert dezelfde post op id en behoudt caption + datum", () => {
  const posts = parseGalleryDlOutput(VOORBEELD_STDOUT);
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0], {
    caption: "Opgietweekend! Zaterdag 26 en zondag 27 september.",
    datum: "2026-08-24",
  });
  assert.deepEqual(posts[1], { caption: "Regenachtige dag? Kom lekker genieten.", datum: "2026-06-01" });
});

test("parseGalleryDlOutput slaat items zonder caption of zonder id over", () => {
  const stdout = JSON.stringify([
    [2, { date: "2026-08-24 08:30:03", id: "111" }], // geen caption
    [3, "https://scontent.example/x.jpg", { caption: "Tekst zonder id", date: "2026-08-24 08:30:03" }], // geen id
  ]);
  assert.deepEqual(parseGalleryDlOutput(stdout), []);
});

test("parseGalleryDlOutput geeft een lege lijst bij ongeldige JSON", () => {
  assert.deepEqual(parseGalleryDlOutput("dit is geen JSON"), []);
});

test("parseGalleryDlOutput geeft een lege lijst bij een niet-array top-level waarde", () => {
  assert.deepEqual(parseGalleryDlOutput(JSON.stringify({ foo: "bar" })), []);
});

test("filterRecentePosts sluit posts uit die ouder zijn dan de grens; exact op de grens telt nog mee", () => {
  const posts = [
    { caption: "vandaag", datum: "2026-08-26" },
    { caption: "op de grens (1 dag terug)", datum: "2026-08-25" },
    { caption: "te oud (2 dagen terug)", datum: "2026-08-24" },
  ];
  const gefilterd = filterRecentePosts(posts, "2026-08-26", 1);
  assert.deepEqual(
    gefilterd.map((p) => p.caption),
    ["vandaag", "op de grens (1 dag terug)"],
  );
});

test("filterRecentePosts houdt alles binnen een ruime marge", () => {
  const posts = [
    { caption: "recent", datum: "2026-08-01" },
    { caption: "twee maanden terug", datum: "2026-06-20" },
  ];
  assert.equal(filterRecentePosts(posts, "2026-08-26", 60).length, 2);
});
```

- [ ] **Step 2: Bevestig dat de tests falen**

Run: `node --import tsx --test scripts/lib/facebook.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/facebook'`.

- [ ] **Step 3: Implementeer de pure functies**

Maak `src/lib/facebook.ts`:

```ts
/*
  Facebook-postscraper — fetch-laag. Haalt recente foto-posts van een publieke
  Facebook-pagina op via gallery-dl (al aanwezig in de tooling, gebruikt door
  de fb-fotos-skill; gratis, geen login nodig voor publieke pagina's —
  geverifieerd tegen de echte Thermen Binnenmaas-pagina, zie
  docs/superpowers/specs/2026-08-26-facebook-postscraper-design.md). Levert
  platte tekst (caption + datum) die door dezelfde extractEventsFromText-route
  gaat als een doorgestuurde nieuwsbrief-mail (src/lib/scraper.ts).
*/

export interface FacebookPost {
  caption: string;
  datum: string; // ISO YYYY-MM-DD, uit het date-veld van gallery-dl
}

export interface FacebookFetchResult {
  posts: FacebookPost[];
  warnings: string[];
}

/**
 * Parst de ruwe `gallery-dl -j`-output. Elke post komt meerdere keren voor
 * (één keer per Message-type — Directory, Url, …), telkens als een array
 * waarvan het LAATSTE element de post-metadata is (zowel bij een 2-elements
 * Directory-entry als een 3-elements Url-entry). Dedupliceert op het
 * `id`-veld van die metadata en houdt alleen posts met een niet-lege
 * `caption` over — sfeerposts zonder tekst leveren toch geen event op.
 */
export function parseGalleryDlOutput(stdout: string): FacebookPost[] {
  let ruw: unknown;
  try {
    ruw = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(ruw)) return [];

  const gezien = new Set<string>();
  const posts: FacebookPost[] = [];
  for (const entry of ruw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const meta = entry[entry.length - 1];
    if (meta === null || typeof meta !== "object") continue;
    const m = meta as Record<string, unknown>;
    const id = typeof m.id === "string" ? m.id : undefined;
    const caption = typeof m.caption === "string" ? m.caption.trim() : "";
    const datum = typeof m.date === "string" ? m.date.slice(0, 10) : "";
    if (!id || !caption || !datum || gezien.has(id)) continue;
    gezien.add(id);
    posts.push({ caption, datum });
  }
  return posts;
}

/**
 * Sluit posts uit die vóór `vandaag - maxOuderdomDagen` gepubliceerd zijn: een
 * post van maanden terug kondigt vrijwel zeker geen toekomstig event meer aan,
 * en dit scheelt onnodige Claude-extractiecalls.
 */
export function filterRecentePosts(
  posts: FacebookPost[],
  vandaag: string,
  maxOuderdomDagen: number,
): FacebookPost[] {
  const grens = new Date(`${vandaag}T00:00:00Z`);
  grens.setUTCDate(grens.getUTCDate() - maxOuderdomDagen);
  const grensISO = grens.toISOString().slice(0, 10);
  return posts.filter((p) => p.datum >= grensISO);
}
```

- [ ] **Step 4: Bevestig dat de tests slagen**

Run: `node --import tsx --test scripts/lib/facebook.test.ts`
Expected: PASS — 6 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/facebook.ts scripts/lib/facebook.test.ts
git commit -m "feat(facebook): parse en filter gallery-dl-postoutput"
```

---

### Task 4: Subprocess-wrapper `fetchFacebookPosts`

Dit is de enige impure functie in `src/lib/facebook.ts` (draait een subprocess) — geen unit-test (mirrort hoe `scrapeAgenda`/`plainFetchText` in `src/lib/scraper.ts` ook niet los unit-getest worden), wel een handmatige verificatie tegen de echte, publieke Thermen Binnenmaas-pagina.

**Files:**
- Modify: `src/lib/facebook.ts`

- [ ] **Step 1: Implementeer `fetchFacebookPosts`**

Voeg toe aan `src/lib/facebook.ts` (onder de bestaande code uit Task 3):

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Aantal recente foto-posts dat per bron wordt opgehaald. */
export const DEFAULT_RANGE = "1-15";
/** Posts ouder dan dit aantal dagen worden niet meer geëxtraheerd. */
export const DEFAULT_MAX_OUDERDOM_DAGEN = 60;

export interface FetchFacebookPostsContext {
  /** Referentiedatum (ISO YYYY-MM-DD) voor het leeftijdsfilter. */
  vandaag: string;
  maxOuderdomDagen?: number;
  range?: string;
}

/**
 * Haalt de recente foto-posts van een publieke Facebook-pagina op via
 * gallery-dl. Faalt de subprocess (gallery-dl ontbreekt, pagina geblokkeerd/
 * onbereikbaar, onverwachte output) dan wordt dat NOOIT doorgegooid: de
 * aanroeper (scrape-facebook.ts) moet die ene bron kunnen overslaan zonder de
 * hele run te laten crashen — zelfde filosofie als de per-bron try/catch in
 * scrape-events.ts.
 */
export async function fetchFacebookPosts(
  facebookUrl: string,
  ctx: FetchFacebookPostsContext,
): Promise<FacebookFetchResult> {
  const range = ctx.range ?? DEFAULT_RANGE;
  const maxOuderdomDagen = ctx.maxOuderdomDagen ?? DEFAULT_MAX_OUDERDOM_DAGEN;
  const url = `${facebookUrl.replace(/\/+$/, "")}/photos`;
  try {
    const { stdout } = await execFileAsync(
      "python3",
      ["-m", "gallery_dl", "-j", "--range", range, url],
      { timeout: 60000, maxBuffer: 10_000_000 },
    );
    const alle = parseGalleryDlOutput(stdout);
    const posts = filterRecentePosts(alle, ctx.vandaag, maxOuderdomDagen);
    return { posts, warnings: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { posts: [], warnings: [`gallery-dl-fout voor ${facebookUrl}: ${msg}`] };
  }
}
```

- [ ] **Step 2: Handmatige verificatie tegen de echte Thermen Binnenmaas-pagina**

Vereist netwerktoegang en `gallery-dl` lokaal geïnstalleerd (`python3 -m pip install --user gallery-dl` als het ontbreekt — al aanwezig in de meeste dev-omgevingen van dit project, zie de `fb-fotos`-skill).

Maak een tijdelijk verificatiescript:

```bash
cat > scripts/verify-facebook-tmp.ts << 'EOF'
import { fetchFacebookPosts } from "../src/lib/facebook";

fetchFacebookPosts("https://www.facebook.com/ThermenBinnenmaas", {
  vandaag: "2026-08-26",
  maxOuderdomDagen: 365,
}).then((res) => {
  console.log(`${res.posts.length} post(s), ${res.warnings.length} warning(s)`);
  console.log(JSON.stringify(res, null, 2));
});
EOF
npx tsx scripts/verify-facebook-tmp.ts
```

Expected: JSON-output met minstens 1 post; elke post heeft een niet-lege `caption` in leesbaar Nederlands en een `datum` in `YYYY-MM-DD`-formaat. `warnings` is een lege array. (Dit bevestigt dat de subprocess-aanroep, de parsing én het leeftijdsfilter end-to-end werken tegen een echte, publieke pagina — dezelfde pagina die tijdens het ontwerp al met de kale `gallery-dl -j`-CLI is geverifieerd.)

Ruim het tijdelijke bestand daarna op:

```bash
rm scripts/verify-facebook-tmp.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/facebook.ts
git commit -m "feat(facebook): fetchFacebookPosts haalt posts op via gallery-dl-subprocess"
```

---

### Task 5: `scripts/scrape-facebook.ts` — het scrape-script

**Files:**
- Create: `scripts/scrape-facebook.ts`
- Modify: `package.json`

- [ ] **Step 1: Voeg het npm-script toe**

In `package.json`, voeg toe aan `"scripts"` (na `"scrape-mail"`):

```json
    "scrape-mail": "tsx scripts/scrape-mail.ts",
    "scrape-facebook": "tsx scripts/scrape-facebook.ts",
    "check-roosters": "tsx scripts/check-roosters.ts",
```

- [ ] **Step 2: Schrijf het script**

Maak `scripts/scrape-facebook.ts`:

```ts
/*
  Facebook-postscraper. Leest content/bronnen.json, haalt voor elke bron MET
  een facebook-veld de recente foto-posts op via gallery-dl (src/lib/facebook.ts,
  gratis, geen login), extraheert events uit de samengevoegde captions (Claude,
  via extractEventsFromText — src/lib/scraper.ts), dedupliceert tegen bestaande
  events (saunaSlug + startDatum, plus de cross-sauna titel/datum-check),
  beoordeelt via de kwaliteitspoort en schrijft ze als MDX. Publicatieregel
  IDENTIEK aan scrape-events.ts (niet aan scrape-mail.ts, dat altijd concept
  blijft): de facebook-URL komt uit onze eigen gecureerde bronnen.json, niet
  uit een spoofbare afzender. Status "gepubliceerd" bij poort-pass + opgiet-
  trefwoord in de titel + geen cross-sauna-kopie + geen externe ticket-URL +
  SCRAPE_AUTOPUBLISH=true, anders "concept" (met de blokkades in keurNotitie).

  Gebruik:
    npm run scrape-facebook                 # alle bronnen met een facebook-veld
    npm run scrape-facebook -- --limit 2    # eerste 2 van die bronnen
    npm run scrape-facebook -- --dry-run    # mock-extractie; test poort + dedup + MDX
                                             # zonder gallery-dl/API-keys

  Env: ANTHROPIC_API_KEY (niet nodig bij --dry-run), SCRAPE_AUTOPUBLISH=true.
  Vereist gallery-dl op PATH (python3 -m gallery_dl); ontbreekt dat, dan faalt
  de fetch per bron met een warning (zie src/lib/facebook.ts) — nooit de hele run.
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readBronnen,
  existingEventTitles,
  existingTitelDatumIndex,
  existingSaunaSlugs,
  externeTicketHost,
  dedupKey,
  titelDatumKey,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
import { evaluateEvent, OPGIET_RE } from "./lib/quality-gate";
import { appendScrapeWarnings } from "./lib/warnings";
import { sleep, REQUEST_DELAY_MS } from "./lib/net";
import { todayISOInTimeZone } from "../src/lib/dates";
import { extractEventsFromText, type ScrapeOutcome, type ScrapedEvent } from "../src/lib/scraper";
import { fetchFacebookPosts, type FacebookPost } from "../src/lib/facebook";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
// Dry-run schrijft naar een tijdelijke map: mock-events horen nooit in
// content/events/ terecht te komen (en dus ook nooit in een commit).
const DOEL_DIR = DRY_RUN ? fs.mkdtempSync(path.join(os.tmpdir(), "opgietingen-fb-dry-run-")) : undefined;
const TODAY = todayISOInTimeZone();
const AUTO_PUBLISH = process.env.SCRAPE_AUTOPUBLISH === "true";

const CAPTION_SCHEIDING = "\n\n---\n\n";

/**
 * Voegt captions samen tot één tekstblok voor extractEventsFromText: die
 * ondersteunt al meerdere events uit één tekstblok (zoals een volledige
 * agendapagina of een nieuwsbrief-mail met meerdere aankondigingen), dus één
 * aanroep per bron volstaat — geen aparte Claude-call per post nodig.
 */
function samengesteldeTekst(posts: FacebookPost[]): string {
  return posts.map((p) => `Post van ${p.datum}:\n${p.caption}`).join(CAPTION_SCHEIDING);
}

/** Mock-extractie voor --dry-run: dekt zowel het autopublish-pad als een blokkade. */
function mockOutcome(): ScrapeOutcome {
  const events: ScrapedEvent[] = [
    // Geldig — moet slagen (gepubliceerd bij AUTO_PUBLISH).
    {
      titel: "Opgietweekend (mock uit Facebook-post)",
      type: "opgietweekend",
      startDatum: "2027-02-06",
      beschrijving: "Twee dagen vol warme wappers en thema-opgietingen.",
    },
    // Poort ok (beschrijving bevat "opgietingen"), maar het opgiet-trefwoord
    // staat niet in de TITEL → nooit auto-publiceren.
    {
      titel: "Feestweekend (mock)",
      type: "regulier",
      startDatum: "2027-03-01",
      beschrijving: "Een gezellig weekend met opgietingen, maar het woord staat niet in de titel.",
    },
  ];
  // Geslaagde methode: "none" is voorbehouden aan een gefaalde extractie.
  return { events, markdown: "", method: "plain-claude", warnings: ["dry-run: geen echte fetch/extractie"] };
}

async function main() {
  const data = readBronnen();
  const targets = data.bronnen
    .filter((b): b is Bron & { facebook: string } => Boolean(b.facebook))
    .slice(0, LIMIT);

  console.log(
    `Facebook-scraper gestart${DRY_RUN ? " (DRY-RUN)" : ""}. ` +
      `${targets.length} bron(nen) met een facebook-veld.\n`,
  );

  const existing = existingEventTitles();
  const perTitelDatum = existingTitelDatumIndex();
  const saunaSlugs = existingSaunaSlugs();
  const seen = new Set<string>(); // dedup binnen deze run
  const rapportWarnings: { bron: string; melding: string }[] = [];
  let written = 0;
  let skipped = 0;

  for (const bron of targets) {
    console.log(`— ${bron.naam} (${bron.facebook})`);

    let outcome: ScrapeOutcome | null = null;

    if (DRY_RUN) {
      outcome = mockOutcome();
    } else {
      const fetched = await fetchFacebookPosts(bron.facebook, { vandaag: TODAY });
      for (const w of fetched.warnings) console.log(`  · ${w}`);
      if (fetched.warnings.length) {
        rapportWarnings.push({ bron: bron.naam, melding: fetched.warnings.join(" | ") });
      }
      if (fetched.posts.length > 0) {
        try {
          outcome = await extractEventsFromText(samengesteldeTekst(fetched.posts), {
            saunaNaam: bron.naam,
            land: bron.land === "BE" ? "BE" : "NL",
            vandaag: TODAY,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`  ✗ Fout: ${msg}`);
          rapportWarnings.push({ bron: bron.naam, melding: `extractie-fout: ${msg}` });
        }
      } else {
        console.log("  Geen (recente) posts gevonden.");
      }
    }

    if (outcome) {
      for (const w of outcome.warnings) console.log(`  · ${w}`);
      console.log(`  Extractie: ${outcome.method}, ${outcome.events.length} kandidaat-event(s).`);
      if (!DRY_RUN && outcome.method === "none") {
        rapportWarnings.push({
          bron: bron.naam,
          melding: `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`,
        });
      }

      for (const ev of outcome.events) {
        const key = dedupKey(bron.id, ev.startDatum);
        if (existing.has(key) || seen.has(key)) {
          console.log(`  = dedup: ${ev.titel} (${ev.startDatum}) bestaat al.`);
          skipped++;
          continue;
        }

        const verdict = evaluateEvent(
          {
            saunaSlug: bron.id,
            titel: ev.titel,
            type: ev.type,
            startDatum: ev.startDatum,
            beschrijving: ev.beschrijving,
          },
          { saunaSlugs, today: TODAY },
        );

        if (verdict.verleden) {
          console.log(`  · voorbij: ${ev.titel} (${ev.startDatum}) — niet weggeschreven.`);
          skipped++;
          continue;
        }

        // Zelfde titel op dezelfde dag bij een ándere sauna: vrijwel altijd een
        // keten-sauna die het event van een collega aankondigt.
        const tdKey = titelDatumKey(ev.titel, ev.startDatum);
        const eerdereSauna = perTitelDatum.get(tdKey);
        const isKopie = eerdereSauna !== undefined && eerdereSauna !== bron.id;

        const blokkades: string[] = [];
        if (!verdict.passed) blokkades.push(verdict.redenen.join("; "));
        if (isKopie) {
          blokkades.push(
            `zelfde titel en datum staan al bij "${eerdereSauna}" — waarschijnlijk kondigt deze sauna het event van een ander alleen aan; handmatig beoordelen`,
          );
        }
        const externeHost = externeTicketHost(ev.ticketUrl, bron.website || bron.agendaUrl);
        if (externeHost) {
          blokkades.push(
            `ticket-URL wijst naar extern domein ${externeHost} — controleer of dit een echte ticketpagina voor dit event is`,
          );
        }
        if (verdict.passed && !OPGIET_RE.test(ev.titel)) {
          blokkades.push(
            "opgiet-trefwoord staat niet in de titel, hooguit in de beschrijving — handmatig beoordelen en publiceren",
          );
        }

        const status: "concept" | "gepubliceerd" =
          AUTO_PUBLISH && blokkades.length === 0 ? "gepubliceerd" : "concept";
        const keurNotitie = blokkades.length ? blokkades.join("; ") : undefined;

        const newEvent: NewEvent = {
          saunaSlug: bron.id,
          titel: ev.titel,
          type: ev.type,
          startDatum: ev.startDatum,
          eindDatum: ev.eindDatum,
          tijden: ev.tijden,
          prijsIndicatie: ev.prijsIndicatie,
          ticketUrl: ev.ticketUrl ?? (bron.website || bron.agendaUrl),
          beschrijving: ev.beschrijving,
          status,
          ...(keurNotitie ? { keurNotitie } : {}),
        };

        const filePath = writeEventMdx(newEvent, DOEL_DIR);
        if (filePath) {
          seen.add(key);
          if (!perTitelDatum.has(tdKey)) perTitelDatum.set(tdKey, bron.id);
          written++;
          console.log(
            `  + ${status}${keurNotitie ? " (concept: " + keurNotitie + ")" : ""} — ${ev.titel}`,
          );
        } else {
          skipped++;
          console.log(`  = bestand bestaat al voor: ${ev.titel}`);
        }
      }
    }

    console.log("");
    if (!DRY_RUN) await sleep(REQUEST_DELAY_MS);
  }

  if (!DRY_RUN) appendScrapeWarnings(TODAY, rapportWarnings);
  console.log(
    `Klaar. ${written} nieuw event(s), ${skipped} overgeslagen (dedup), ` +
      `${rapportWarnings.length} waarschuwing(en)${DRY_RUN ? "" : " → scrape-warnings.json"}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Dry-run zonder autopublish**

Run: `npm run scrape-facebook -- --dry-run`

Expected (op basis van de huidige `content/bronnen.json`, waar alleen Thermen Binnenmaas een `facebook`-veld heeft):

```
Facebook-scraper gestart (DRY-RUN). 1 bron(nen) met een facebook-veld.

— Thermen Binnenmaas (https://www.facebook.com/ThermenBinnenmaas)
  · dry-run: geen echte fetch/extractie
  Extractie: plain-claude, 2 kandidaat-event(s).
  + concept — Opgietweekend (mock uit Facebook-post)
  + concept (concept: opgiet-trefwoord staat niet in de titel, hooguit in de beschrijving — handmatig beoordelen en publiceren) — Feestweekend (mock)

Klaar. 2 nieuw event(s), 0 overgeslagen (dedup), 0 waarschuwing(en).
```

(Zonder `SCRAPE_AUTOPUBLISH=true` blijft ook het geldige mock-event `concept`, net als bij `scrape-events.ts -- --dry-run`.)

- [ ] **Step 4: Dry-run mét autopublish — bevestigt het onderscheid tussen de twee mock-events**

Run: `SCRAPE_AUTOPUBLISH=true npm run scrape-facebook -- --dry-run`
Expected: de eerste regel wordt `+ gepubliceerd — Opgietweekend (mock uit Facebook-post)` (geen blokkades → volgt nu AUTO_PUBLISH), de tweede regel blijft ongewijzigd `+ concept (concept: opgiet-trefwoord staat niet in de titel...) — Feestweekend (mock)` (de blokkade staat los van `SCRAPE_AUTOPUBLISH`). Dit bevestigt dat de publicatieregel exact zo werkt als de website-scraper.

- [ ] **Step 5: Volledige testsuite blijft groen**

Run: `npm run test`
Expected: alle tests slagen (geen nieuwe tests in deze stap — dit script wordt net als `scrape-events.ts`/`scrape-mail.ts` niet los unit-getest, de dry-run hierboven is de verificatie).

- [ ] **Step 6: Commit**

```bash
git add scripts/scrape-facebook.ts package.json
git commit -m "feat(scraper): scrape-facebook.ts — Facebook-posts door de bestaande poort/dedup-keten"
```

---

### Task 6: Workflow-integratie (`.github/workflows/scrape.yml`)

**Files:**
- Modify: `.github/workflows/scrape.yml`

- [ ] **Step 1: Voeg de nieuwe stappen toe ná "Scrape events" en vóór "Scrape nieuwsbrieven"**

Zoek dit blok (huidige stap 2, direct gevolgd door stap 3):

```yaml
      # Stap 2 — scrape alleen de actieve bronnen.
      - name: Scrape events (poort → gepubliceerd/concept in content/events/)
        env:
          FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SCRAPE_AUTOPUBLISH: "true"
        run: |
          if [ -n "${{ github.event.inputs.limit }}" ]; then
            npm run scrape -- --limit "${{ github.event.inputs.limit }}"
          else
            npm run scrape
          fi

      # Stap 3 — verwerk nieuwsbrieven uit de gedeelde inbox (events@opgietingen.nl).
      # Slaat zichzelf over als de IMAP-secrets nog niet gezet zijn.
      - name: Scrape nieuwsbrieven (IMAP → poort → concept/gepubliceerd)
```

Vervang door (nieuwe stappen ertussen, en de stapnummers in de commentaren van de bestaande stappen eronder bijgewerkt):

```yaml
      # Stap 2 — scrape alleen de actieve bronnen.
      - name: Scrape events (poort → gepubliceerd/concept in content/events/)
        env:
          FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SCRAPE_AUTOPUBLISH: "true"
        run: |
          if [ -n "${{ github.event.inputs.limit }}" ]; then
            npm run scrape -- --limit "${{ github.event.inputs.limit }}"
          else
            npm run scrape
          fi

      # Stap 3 — haal Facebook-postaankondigingen op (gratis, via gallery-dl,
      # geen login) voor bronnen met een facebook-veld en verwerk ze door
      # dezelfde extractie/poort/dedup-keten als de website-scraper.
      - name: Setup gallery-dl
        run: pip install gallery-dl

      - name: Scrape Facebook-pagina's (poort → gepubliceerd/concept in content/events/)
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SCRAPE_AUTOPUBLISH: "true"
        run: npm run scrape-facebook

      # Stap 4 — verwerk nieuwsbrieven uit de gedeelde inbox (events@opgietingen.nl).
      # Slaat zichzelf over als de IMAP-secrets nog niet gezet zijn.
      - name: Scrape nieuwsbrieven (IMAP → poort → concept/gepubliceerd)
```

- [ ] **Step 2: Werk de resterende stapnummers in de commentaren bij**

Zoek:

```yaml
      # Stap 4 — hercontroleer verouderde opgietroosters (> 60 dagen niet
      # bevestigd) tegen de sauna-website; bevestigde roosters krijgen een
      # verse roosterGecheckt-datum, afwijkingen komen in het scraper-issue.
      - name: Hercheck opgietroosters
```

Vervang door:

```yaml
      # Stap 5 — hercontroleer verouderde opgietroosters (> 60 dagen niet
      # bevestigd) tegen de sauna-website; bevestigde roosters krijgen een
      # verse roosterGecheckt-datum, afwijkingen komen in het scraper-issue.
      - name: Hercheck opgietroosters
```

- [ ] **Step 3: Valideer de YAML-syntax**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/scrape.yml'))" && echo OK`
Expected: `OK` (geen `yaml.scanner.ScannerError`/`yaml.parser.ParserError`). Gebruik dit als snelle syntaxcheck; als `python3 -c "import yaml"` faalt omdat PyYAML lokaal ontbreekt, lees het bestand dan handmatig na op consistente inspringing in plaats van de dependency te installeren.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/scrape.yml
git commit -m "ci(scraper): Facebook-postscraper in de wekelijkse workflow"
```

---

### Task 7: CLAUDE.md-documentatie

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Voeg de nieuwe sectie toe ná "Facebook-doorstuurkanaal" en vóór "Env / secrets"**

Zoek deze exacte alinea (staat al in `CLAUDE.md`):

```
**Facebook-doorstuurkanaal (via dezelfde inbox)** — sauna's kondigen opgietweekenden vaak (alleen) op Facebook aan, en Facebook is niet direct scrapebaar (login-wall, bot-detectie; een anonieme fetch van een publieke post levert een lege foutpagina op). De workflow is: posttekst kopiëren + link naar de post of pagina erbij, mailen naar `events@opgietingen.nl` (regel: **altijd de posttekst meeplakken** — de link is voor de matching, de tekst voor de extractie; een mail met alleen een link levert 0 events op en wordt alleen gelogd). Mails van een vertrouwd doorstuur-adres (env `MAIL_VERTROUWDE_AFZENDERS`, kommagescheiden, volledig adres) worden bij een gemiste afzender-match op **inhoud** gekoppeld via `matchBronByContent`: eerst het `facebook`-veld van de bronnen (paginanaam uit post-/pagina-URLs, www./m.-varianten, met domeingrens-checks tegen lookalike-domeinen), dan het website-domein als fallback — uniek of niets, ambigu blijft het bestaande vangnet (concept + keurNotitie). Trusted bepaalt alleen de kóppeling, nooit de publicatiestatus. Zie de [spec](docs/superpowers/specs/2026-08-02-facebook-doorstuurkanaal-design.md).

**Env / secrets:** `FIRECRAWL_API_KEY` (fetch + primaire extractie + verify-fallback), `ANTHROPIC_API_KEY` (extractie-fallback + nieuwsbrief-extractie), `MAIL_IMAP_*` (nieuwsbrief-inbox), `MAIL_VERTROUWDE_AFZENDERS` (doorstuur-route). Lokaal via `.env`/export; in CI via GitHub Actions secrets.
```

Vervang door (nieuwe alinea ertussen):

```
**Facebook-doorstuurkanaal (via dezelfde inbox)** — sauna's kondigen opgietweekenden vaak (alleen) op Facebook aan, en Facebook is niet direct scrapebaar (login-wall, bot-detectie; een anonieme fetch van een publieke post levert een lege foutpagina op). De workflow is: posttekst kopiëren + link naar de post of pagina erbij, mailen naar `events@opgietingen.nl` (regel: **altijd de posttekst meeplakken** — de link is voor de matching, de tekst voor de extractie; een mail met alleen een link levert 0 events op en wordt alleen gelogd). Mails van een vertrouwd doorstuur-adres (env `MAIL_VERTROUWDE_AFZENDERS`, kommagescheiden, volledig adres) worden bij een gemiste afzender-match op **inhoud** gekoppeld via `matchBronByContent`: eerst het `facebook`-veld van de bronnen (paginanaam uit post-/pagina-URLs, www./m.-varianten, met domeingrens-checks tegen lookalike-domeinen), dan het website-domein als fallback — uniek of niets, ambigu blijft het bestaande vangnet (concept + keurNotitie). Trusted bepaalt alleen de kóppeling, nooit de publicatiestatus. Zie de [spec](docs/superpowers/specs/2026-08-02-facebook-doorstuurkanaal-design.md).

**Facebook-postscraper** (`npm run scrape-facebook`) — gratis, geautomatiseerde tegenhanger van het doorstuurkanaal hierboven: haalt voor elke bron met een `facebook`-veld de recente foto-posts op via `gallery-dl` (`src/lib/facebook.ts`, geen login/API-key nodig — publieke pagina's zijn zo bereikbaar) en verwerkt de caption-tekst door dezelfde `extractEventsFromText`-route als het nieuwsbriefkanaal. In tegenstelling tot het mailkanaal geldt hier **dezelfde publicatieregel als de website-scraper** (poort + opgiet-trefwoord in de titel + `SCRAPE_AUTOPUBLISH=true` → gepubliceerd): de `facebook`-URL komt uit onze eigen gecureerde `bronnen.json`, niet uit een spoofbare afzender. Beperkingen: alleen posts **met een foto** worden gezien (gallery-dl haalt de `/photos`-tab op), posts ouder dan 60 dagen worden overgeslagen, en een Facebook-layoutwijziging laat die ene bron falen met een waarschuwing zonder de rest van de run te raken. Vereist `gallery-dl` op de runner (`pip install gallery-dl`); geen nieuwe secrets. Instagram blijft bewust buiten scope. Zie de [spec](docs/superpowers/specs/2026-08-26-facebook-postscraper-design.md).

**Env / secrets:** `FIRECRAWL_API_KEY` (fetch + primaire extractie + verify-fallback), `ANTHROPIC_API_KEY` (extractie-fallback + nieuwsbrief-extractie), `MAIL_IMAP_*` (nieuwsbrief-inbox), `MAIL_VERTROUWDE_AFZENDERS` (doorstuur-route). Lokaal via `.env`/export; in CI via GitHub Actions secrets.
```

- [ ] **Step 2: Werk de commando-tabel bij**

Zoek:

```
npm run scrape-mail     # verwerk ongelezen nieuwsbrieven uit de inbox (IMAP + ANTHROPIC_API_KEY)
npm run scrape-mail -- --dry-run  # mock-inbox; test matching + poort zonder keys
npm run check-roosters  # hercontroleer verouderde opgietroosters (ANTHROPIC_API_KEY)
```

Vervang door:

```
npm run scrape-mail     # verwerk ongelezen nieuwsbrieven uit de inbox (IMAP + ANTHROPIC_API_KEY)
npm run scrape-mail -- --dry-run  # mock-inbox; test matching + poort zonder keys
npm run scrape-facebook # scrape Facebook-postaankondigingen (gallery-dl, gratis) → poort
npm run scrape-facebook -- --dry-run  # mock-extractie; test poort + dedup zonder gallery-dl/keys
npm run check-roosters  # hercontroleer verouderde opgietroosters (ANTHROPIC_API_KEY)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Facebook-postscraper in CLAUDE.md"
```

---

### Task 8: Eindverificatie

**Files:** geen wijzigingen — alleen verificatie.

- [ ] **Step 1: Volledige testsuite**

Run: `npm run test`
Expected: alle tests slagen (inclusief `warnings.test.ts` en `facebook.test.ts` uit dit plan).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: geen fouten.

- [ ] **Step 3: Productie-build**

Run: `npm run build`
Expected: build slaagt zonder TypeScript- of ESLint-fouten (CLAUDE.md-conventie: altijd verifiëren met `npm run build` vóór een commit die als "klaar" geldt).

- [ ] **Step 4: Beide dry-runs nogmaals als laatste rooktest**

Run: `npm run scrape -- --dry-run && npm run scrape-facebook -- --dry-run`
Expected: beide scripts draaien end-to-end zonder fouten, met de verslagen zoals hierboven beschreven in Task 2 (Step 2) en Task 5 (Step 3).

- [ ] **Step 5: Los, buiten dit plan (spec §4 "Rollout")**

Herinnering, geen uit te voeren stap: het handmatig aanvullen van het `facebook`-veld voor de overige bronnen in `content/bronnen.json` gebeurt als aparte actie ná deze implementatie, niet als onderdeel van dit plan.
