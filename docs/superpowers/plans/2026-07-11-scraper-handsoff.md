# Hands-off scraper-pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gescrapete opgiet-events die door een kwaliteitspoort komen gaan automatisch live; Nathaniel krijgt alléén een GitHub-issue als er problemen zijn (twijfelgevallen, kapotte bronnen, ontbrekende profielen).

**Architecture:** Een pure kwaliteitspoort-functie (`scripts/lib/quality-gate.ts`) beoordeelt elk geëxtraheerd event op harde criteria en levert `{ passed, redenen[] }`. De scrape-stap gebruikt de uitkomst om `status` (`gepubliceerd` vs `concept`) en `keurNotitie` in de MDX-frontmatter te zetten, gestuurd door een `SCRAPE_AUTOPUBLISH`-env-vlag zodat auto-publiceren als laatste stap aangezet wordt (spec §5). `verify-bronnen` krijgt een Firecrawl-fallback voor JS-gerenderde agendapagina's. Na elke run bouwt `scripts/scrape-report.ts` één issue-rapport; de workflow commit direct op `main` en opent/actualiseert/sluit één GitHub-issue.

**Tech Stack:** TypeScript + `tsx`, `gray-matter`, `@mendable/firecrawl-js`, `@anthropic-ai/sdk`, Node's ingebouwde testrunner (`node:test` + `node:assert`, uitgevoerd via `tsx`), GitHub Actions + `gh` CLI.

---

## File Structure

**Nieuw:**
- `scripts/lib/quality-gate.ts` — pure kwaliteitspoort: `evaluateEvent()`, `OPGIET_RE`, `isRealIsoDate()`.
- `scripts/lib/quality-gate.test.ts` — unit tests voor de poort.
- `scripts/scrape-report.ts` — bouwt het issue-rapport (concepts + bronnen + ontbrekende profielen), schrijft `scrape-issue.md`, print `problemen`/`schoon`.

**Gewijzigd:**
- `scripts/lib/content.ts` — `existingSaunaSlugs()` toevoegen; `NewEvent` uitbreiden met `status`/`keurNotitie`; `writeEventMdx` schrijft die velden.
- `scripts/scrape-events.ts` — poort aanroepen, status/keurNotitie bepalen, dry-run mockset uitbreiden met afkeur-cases.
- `src/lib/scraper.ts` — `firecrawlFetchMarkdown()` exporteren voor verify-fallback.
- `scripts/verify-bronnen.ts` — Firecrawl-fallback in de `geen-agenda`-tak.
- `scripts/bronnen-report.ts` — logica in exпорteerbare `bronnenReport(): string` functie, CLI wordt dunne wrapper.
- `.github/workflows/scrape.yml` — verify met Firecrawl-key, commit op `main`, issue-beheer i.p.v. PR.
- `package.json` — `test` script.
- `CLAUDE.md` — documenteer `keurNotitie`, `SCRAPE_AUTOPUBLISH`, auto-publish + issue-flow.

---

## Task 1: Testrunner-infra

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/package.json`
- Test: `/Users/nathaniel/Documents/Opgieting.nl/scripts/lib/quality-gate.test.ts` (smoke, verwijderd in Task 2)

- [ ] **Step 1: Voeg een `test`-script toe**

In `package.json`, in het `"scripts"`-blok, na `"scrape"`:

```json
    "scrape": "tsx scripts/scrape-events.ts",
    "test": "node --import tsx --test \"scripts/**/*.test.ts\""
```

- [ ] **Step 2: Schrijf een tijdelijke smoke-test**

Create `scripts/lib/quality-gate.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("testrunner werkt", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: Draai de test**

Run: `npm test`
Expected: PASS — `tests 1` / `pass 1` / `fail 0`. (Bevestigt dat `node --import tsx --test` de TS-testbestanden vindt en draait.)

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/lib/quality-gate.test.ts
git commit -m "chore: node:test testrunner via tsx toevoegen"
```

---

## Task 2: Kwaliteitspoort — pure functie (TDD)

De poort is de kern van de hands-off-flow. Bouw hem test-first. Criteria uit spec §1: geldige toekomstige ISO-datum, bestaande `saunaSlug`, niet-lege `titel`, geldig `type`, en opgiet-trefwoord in titel/beschrijving.

**Files:**
- Create: `/Users/nathaniel/Documents/Opgieting.nl/scripts/lib/quality-gate.ts`
- Test: `/Users/nathaniel/Documents/Opgieting.nl/scripts/lib/quality-gate.test.ts` (vervangt smoke-test)

- [ ] **Step 1: Schrijf de falende tests**

Vervang de volledige inhoud van `scripts/lib/quality-gate.test.ts` door:

```ts
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
```

- [ ] **Step 2: Draai de tests — verifieer dat ze falen**

Run: `npm test`
Expected: FAIL — module `./quality-gate` bestaat nog niet (`Cannot find module`).

- [ ] **Step 3: Implementeer de poort**

Create `scripts/lib/quality-gate.ts`:

```ts
// Kwaliteitspoort voor gescrapete events (spec §1). Pure functie zonder I/O:
// beoordeelt een geëxtraheerd event op harde criteria. Bij twijfel afkeuren —
// false negatives (te streng) zijn acceptabel, false positives (rommel live) niet.

// Geldige event-types (spiegelt EVENT_TYPES in src/lib/site.ts / src/lib/scraper.ts).
const GELDIGE_TYPES = new Set(["opgietweekend", "thema", "kampioenschap", "regulier"]);

// Herkent opgiet-gerelateerde content; voorkomt dat een "moederdagbrunch" doorglipt.
export const OPGIET_RE = /opgiet|aufguss|löyly|loyly|saunaritueel|gietceremonie/i;

export interface GateInput {
  saunaSlug: string;
  titel: string;
  type: string;
  startDatum: string;
  beschrijving?: string;
}

export interface GateContext {
  saunaSlugs: Set<string>; // bestaande profielen in content/saunas/
  today: string; // ISO YYYY-MM-DD, referentiedatum van de run
}

export interface GateResult {
  passed: boolean;
  redenen: string[]; // leeg wanneer passed === true
}

// True als s een echt bestaande kalenderdatum in ISO-formaat is.
export function isRealIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function evaluateEvent(ev: GateInput, ctx: GateContext): GateResult {
  const redenen: string[] = [];

  if (!isRealIsoDate(ev.startDatum)) {
    redenen.push(`ongeldige datum: "${ev.startDatum}" is geen geldige YYYY-MM-DD`);
  } else if (ev.startDatum < ctx.today) {
    redenen.push(`datum in het verleden: ${ev.startDatum} < ${ctx.today}`);
  }

  if (!ctx.saunaSlugs.has(ev.saunaSlug)) {
    redenen.push(`onbekende saunaSlug: "${ev.saunaSlug}" heeft geen profiel in content/saunas/`);
  }

  if (!ev.titel || !ev.titel.trim()) {
    redenen.push("lege titel");
  }

  if (!GELDIGE_TYPES.has(ev.type)) {
    redenen.push(`ongeldig type: "${ev.type}"`);
  }

  const haystack = `${ev.titel} ${ev.beschrijving ?? ""}`;
  if (!OPGIET_RE.test(haystack)) {
    redenen.push("niet herkenbaar opgiet-gerelateerd (geen trefwoord in titel/beschrijving)");
  }

  return { passed: redenen.length === 0, redenen };
}
```

- [ ] **Step 4: Draai de tests — verifieer dat ze slagen**

Run: `npm test`
Expected: PASS — alle poort-tests groen (`fail 0`). ISO-datumvergelijking als string is lexicografisch correct voor `YYYY-MM-DD`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/quality-gate.ts scripts/lib/quality-gate.test.ts
git commit -m "feat(scraper): kwaliteitspoort voor gescrapete events"
```

---

## Task 3: `existingSaunaSlugs()` helper

De poort heeft de set bestaande sauna-slugs nodig. `src/lib/content.ts` is Next-runtime; scripts lezen `content/saunas/` direct (net als `existingEventKeys`).

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/scripts/lib/content.ts`
- Test: `/Users/nathaniel/Documents/Opgieting.nl/scripts/lib/content.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Create `scripts/lib/content.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existingSaunaSlugs } from "./content";

test("existingSaunaSlugs bevat bekende profielen", () => {
  const slugs = existingSaunaSlugs();
  assert.ok(slugs instanceof Set);
  assert.ok(slugs.has("thermen-bussloo"), "verwacht thermen-bussloo als bestaand profiel");
  assert.ok(slugs.size >= 5);
});
```

- [ ] **Step 2: Draai — verifieer dat het faalt**

Run: `npm test`
Expected: FAIL — `existingSaunaSlugs` is niet geëxporteerd.

- [ ] **Step 3: Implementeer de helper**

In `scripts/lib/content.ts`, vlak na `existingEventKeys` (rond regel 83), voeg toe. Het bestand definieert al `SAUNAS_DIR`? Controleer bovenaan; als alleen `EVENTS_DIR` bestaat, voeg de const toe naast de bestaande dir-definitie:

```ts
// Naast EVENTS_DIR bovenaan het bestand — pad naar de sauna-profielen.
const SAUNAS_DIR = path.join(process.cwd(), "content", "saunas");

// Slugs van bestaande sauna-profielen (bestandsnaam zonder .mdx).
// Gebruikt door de kwaliteitspoort om saunaSlug-verwijzingen te valideren.
export function existingSaunaSlugs(): Set<string> {
  if (!fs.existsSync(SAUNAS_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(SAUNAS_DIR)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, "")),
  );
}
```

> Als er al een `SAUNAS_DIR`-const bestaat, hergebruik die en voeg alleen de functie toe.

- [ ] **Step 4: Draai — verifieer dat het slaagt**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/content.ts scripts/lib/content.test.ts
git commit -m "feat(scraper): existingSaunaSlugs helper voor de poort"
```

---

## Task 4: `writeEventMdx` schrijft `status` + `keurNotitie`

De poort-uitkomst moet in de frontmatter landen. Nu is `status: "concept"` hardcoded in `writeEventMdx` (content.ts regels 157-158).

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/scripts/lib/content.ts` (`NewEvent` interface ~regel 120-130 + `writeEventMdx` ~regel 141-165)

- [ ] **Step 1: Breid `NewEvent` uit**

In `scripts/lib/content.ts`, voeg aan de `NewEvent`-interface twee velden toe (na `beschrijving`):

```ts
export interface NewEvent {
  saunaSlug: string;
  titel: string;
  type: "opgietweekend" | "thema" | "kampioenschap" | "regulier";
  startDatum: string;
  eindDatum?: string;
  tijden?: string;
  prijsIndicatie?: string;
  ticketUrl?: string;
  beschrijving: string;
  status: "concept" | "gepubliceerd"; // door de poort bepaald
  keurNotitie?: string; // afkeurreden(en) bij status concept
}
```

- [ ] **Step 2: Pas de frontmatter-opbouw in `writeEventMdx` aan**

Vervang in `writeEventMdx` het hardcoded `status: "concept"` en voeg `keurNotitie` conditioneel toe. De frontmatter-opbouw wordt:

```ts
  const frontmatter: Record<string, unknown> = {
    slug,
    saunaSlug: ev.saunaSlug,
    titel: ev.titel,
    type: ev.type,
    startDatum: ev.startDatum,
    ...(ev.eindDatum ? { eindDatum: ev.eindDatum } : {}),
    ...(ev.tijden ? { tijden: ev.tijden } : {}),
    ...(ev.prijsIndicatie ? { prijsIndicatie: ev.prijsIndicatie } : {}),
    ...(ev.ticketUrl ? { ticketUrl: ev.ticketUrl } : {}),
    status: ev.status,
    bron: "scraper",
    ...(ev.keurNotitie ? { keurNotitie: ev.keurNotitie } : {}),
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — `scripts/scrape-events.ts` levert nu `NewEvent` aan zonder `status`. Dit is verwacht; Task 5 lost het op. (Als je liever geen tussentijdse rode typecheck wilt, doe Task 4 + Task 5 in één commit.)

- [ ] **Step 4: Commit (samen met Task 5)**

Deze taak compileert pas na Task 5. Geen aparte commit — ga door naar Task 5 en commit samen.

---

## Task 5: Poort inpluggen in de scrape-stap

Bepaal per event de status via de poort en de `SCRAPE_AUTOPUBLISH`-vlag. Zonder de vlag (rollout-stap 1-2, spec §5) blijft alles `concept`; met de vlag worden geslaagde events `gepubliceerd`.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/scripts/scrape-events.ts`

- [ ] **Step 1: Voeg imports + run-constanten toe**

Boven in `scrape-events.ts`, bij de bestaande imports, voeg toe:

```ts
import { evaluateEvent } from "./lib/quality-gate";
```

En voeg `existingSaunaSlugs` toe aan de bestaande `./lib/content`-importregel (die al `readBronnen, existingEventKeys, dedupKey, writeEventMdx, type Bron, type NewEvent` importeert):

```ts
import {
  readBronnen,
  existingEventKeys,
  existingSaunaSlugs,
  dedupKey,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
```

Voeg bij de run-constanten (naast `REF_YEAR`, regel ~32) toe:

```ts
const TODAY = new Date().toISOString().slice(0, 10);
const AUTO_PUBLISH = process.env.SCRAPE_AUTOPUBLISH === "true";
```

- [ ] **Step 2: Laad de sauna-slugs één keer in `main()`**

In `main()`, vlak na `const existing = existingEventKeys();` (regel ~66):

```ts
  const saunaSlugs = existingSaunaSlugs();
```

- [ ] **Step 3: Beoordeel elk event vóór het wegschrijven**

In de per-event-loop (regels ~97-126), waar nu de `NewEvent` wordt gebouwd en `writeEventMdx` aangeroepen, vervang de opbouw door een variant die de poort raadpleegt:

```ts
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

    const status: "concept" | "gepubliceerd" =
      verdict.passed && AUTO_PUBLISH ? "gepubliceerd" : "concept";

    const newEvent: NewEvent = {
      saunaSlug: bron.id,
      titel: ev.titel,
      type: ev.type,
      startDatum: ev.startDatum,
      eindDatum: ev.eindDatum,
      tijden: ev.tijden,
      prijsIndicatie: ev.prijsIndicatie,
      ticketUrl: ev.ticketUrl ?? bron.agendaUrl,
      beschrijving: ev.beschrijving,
      status,
      ...(verdict.passed ? {} : { keurNotitie: verdict.redenen.join("; ") }),
    };

    const path = writeEventMdx(newEvent);
    if (path) {
      written++;
      seen.add(key);
      console.log(
        `  + ${status}${verdict.passed ? "" : " (afgekeurd: " + verdict.redenen.join("; ") + ")"} — ${ev.titel}`,
      );
    }
```

> Behoud de bestaande dedup-check (`if (existing.has(key) || seen.has(key)) { skipped++; continue; }`) vóór dit blok — reeds bestaande events worden nooit overschreven (spec §1 slot).

- [ ] **Step 4: Typecheck + smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run scrape -- --dry-run --limit 1`
Expected: draait zonder API-keys; schrijft events als `concept` (want `SCRAPE_AUTOPUBLISH` niet gezet). Verwijder daarna eventueel aangemaakte testbestanden: `git checkout content/events && git clean -fq content/events`.

Run: `SCRAPE_AUTOPUBLISH=true npm run scrape -- --dry-run --limit 1`
Expected: de twee geldige mock-events krijgen `status: gepubliceerd`. Opschonen als hierboven.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/content.ts scripts/scrape-events.ts
git commit -m "feat(scraper): poort bepaalt status + keurNotitie; SCRAPE_AUTOPUBLISH-vlag"
```

---

## Task 6: Dry-run mockset met afkeur-cases (spec §6)

Zodat poortgedrag zonder API-kosten verifieerbaar is: de mock-set moet ook events bevatten die de poort expres afkeurt.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/scripts/scrape-events.ts` (`mockOutcome`, regels ~36-54)

- [ ] **Step 1: Breid `mockOutcome` uit**

Vervang de events-array in `mockOutcome` door een set die alle poort-takken raakt. Let op: `ScrapedEvent.type` is een union — een bewust-ongeldig type vereist een cast:

```ts
function mockOutcome(bron: Bron): ScrapeOutcome {
  const events: ScrapedEvent[] = [
    // Geldig — moet slagen (gepubliceerd bij AUTO_PUBLISH).
    {
      titel: "Aufguss-avond (mock)",
      type: "thema",
      startDatum: "2027-02-14",
      beschrijving: "Sfeervolle opgieting met muziek.",
    },
    {
      titel: "Opgietweekend (mock)",
      type: "opgietweekend",
      startDatum: "2027-03-07",
      beschrijving: "Doorlopende opgietingen het hele weekend.",
    },
    // Afkeur: datum in verleden.
    {
      titel: "Oude Aufguss (mock)",
      type: "thema",
      startDatum: "2020-01-01",
      beschrijving: "Voorbije opgieting.",
    },
    // Afkeur: niet-opgiet-event.
    {
      titel: "Moederdagbrunch (mock)",
      type: "regulier",
      startDatum: "2027-05-10",
      beschrijving: "Luxe buffet met bubbels.",
    },
    // Afkeur: ongeldig type.
    {
      titel: "Opgieting met fout type (mock)",
      type: "feestje" as ScrapedEvent["type"],
      startDatum: "2027-06-01",
      beschrijving: "Bevat opgiet-trefwoord maar fout type.",
    },
  ];
  return { events, markdown: "", method: "none", warnings: ["dry-run: geen echte fetch"] };
}
```

> De "onbekende saunaSlug"-tak wordt in dry-run niet expliciet geraakt (saunaSlug = `bron.id`, een bestaand actief profiel); die tak is gedekt door de unit-tests in Task 2.

- [ ] **Step 2: Verifieer poortgedrag in dry-run**

Run: `npm run scrape -- --dry-run --limit 1`
Expected: console toont 2× `concept` zonder afkeurreden (geldige events, autopublish uit) en 3× `concept (afgekeurd: ...)` met de juiste redenen (verleden / niet opgiet / ongeldig type).

Run: `SCRAPE_AUTOPUBLISH=true npm run scrape -- --dry-run --limit 1`
Expected: de 2 geldige events tonen `gepubliceerd`; de 3 foute blijven `concept (afgekeurd: ...)`.

Opschonen: `git checkout content/events 2>/dev/null; git clean -fq content/events`

- [ ] **Step 3: Commit**

```bash
git add scripts/scrape-events.ts
git commit -m "test(scraper): dry-run mockset met afkeur-cases voor de poort"
```

---

## Task 7: Firecrawl-fetch exporteren voor verify-fallback (spec §4)

`scrapeAgenda` gebruikt Firecrawl al, maar er is geen losse markdown-fetch. Voeg een dunne export toe die verify-bronnen kan gebruiken.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/src/lib/scraper.ts`

- [ ] **Step 1: Voeg `firecrawlFetchMarkdown` toe**

In `src/lib/scraper.ts`, na `firecrawlScrape` (rond regel 178), voeg toe:

```ts
// Haalt een pagina op als markdown via Firecrawl (echte browser-rendering),
// zonder structured extraction. Voor verify-bronnen's JS-fallback (spec §4).
// Retourneert null als er geen key is of de fetch niets bruikbaars oplevert.
export async function firecrawlFetchMarkdown(url: string): Promise<string | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const res = await getFirecrawl().scrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      headers: { "User-Agent": USER_AGENT },
      timeout: 60000,
    });
    const markdown = (res as { markdown?: string }).markdown;
    return markdown && markdown.trim() ? markdown : null;
  } catch {
    return null;
  }
}
```

> Gebruikt de bestaande `getFirecrawl()` en `USER_AGENT` in dit bestand (regel ~23). Als de scrape-optievorm afwijkt van `firecrawlScrape`, spiegel exact wat daar staat.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scraper.ts
git commit -m "feat(scraper): firecrawlFetchMarkdown export voor verify-fallback"
```

---

## Task 8: Firecrawl-fallback in `verify-bronnen`

In `resolveAgenda` levert de kale fetch bij JS-gerenderde sites `geen-agenda` op (regels ~157-164). Voeg vlak daarvóór een Firecrawl-fallback toe: robots blijft gelden.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/scripts/verify-bronnen.ts`

- [ ] **Step 1: Importeer de fallback-fetch**

Bij de imports van `verify-bronnen.ts` (regel ~14), voeg toe:

```ts
import { firecrawlFetchMarkdown } from "../src/lib/scraper";
```

- [ ] **Step 2: Voeg de fallback toe vóór de `geen-agenda`-return**

In `resolveAgenda`, direct vóór de bestaande fallback-return `status: "geen-agenda"` (regel ~157), voeg toe. `origin`, `bron`, `check()` en `CONTENT_HINT` bestaan al in scope:

```ts
    // Firecrawl-fallback (spec §4): kale fetch vond geen agendapagina —
    // mogelijk JS-gerenderd. Probeer echte browser-rendering, robots blijft gelden.
    if (check(bron.agendaUrl)) {
      const md = await firecrawlFetchMarkdown(bron.agendaUrl);
      if (md && CONTENT_HINT.test(md)) {
        return {
          status: "actief",
          url: bron.agendaUrl,
          notitie: "Bevestigd via Firecrawl (JS-gerenderd).",
        };
      }
    }
```

> `check()` is de robots-helper uit `resolveAgenda` (regel ~113 e.v.). Als de helper anders heet, gebruik de bestaande naam (bv. `isPathAllowed(rules, new URL(bron.agendaUrl).pathname)`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verifieer handmatig tegen één JS-bron (vereist `FIRECRAWL_API_KEY`)**

Run (met key in env of `.env`): `npm run verify-bronnen -- --all`
Expected: bronnen die eerder op `geen-agenda`/`kapot` stonden en wél een JS-agenda hebben, worden `actief` met notitie "Bevestigd via Firecrawl (JS-gerenderd).". Zonder key valt de fallback stil terug (retourneert null) en verandert er niets — geen crash.

> Zonder key: draai alsnog `npm run verify-bronnen` om te bevestigen dat er geen regressie is (statussen blijven zoals ze waren, geen exceptions).

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-bronnen.ts
git commit -m "feat(scraper): Firecrawl-fallback in verify-bronnen (JS-gerenderde agenda's)"
```

---

## Task 9: `bronnen-report` als herbruikbare functie

Het issue-rapport hergebruikt de bronnensectie (spec §3). Refactor `bronnen-report.ts` zodat de opbouw een exporteerbare functie is; de CLI wordt een dunne wrapper.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/scripts/bronnen-report.ts`

- [ ] **Step 1: Herstructureer naar `bronnenReport()`**

Vervang de volledige inhoud van `scripts/bronnen-report.ts` door (behoud de bestaande output-vorm exact — telregel + aandachtspunten-tabel):

```ts
// Markdown-statusrapport van alle scraper-bronnen.
// Als module: bronnenReport() levert de string. Als script: print naar stdout.
import { readBronnen } from "./lib/content";

export function bronnenReport(): string {
  const { bronnen } = readBronnen();
  const count = (s: string) => bronnen.filter((b) => b.status === s).length;

  const lines: string[] = [];
  lines.push("## Bronnenstatus");
  lines.push("");
  lines.push(
    `**actief:** ${count("actief")} · **geen-agenda:** ${count("geen-agenda")} · ` +
      `**handmatig:** ${count("handmatig")} · **kapot:** ${count("kapot")} · ` +
      `**te-verifieren:** ${count("te-verifieren")}`,
  );

  const nietActief = bronnen.filter((b) => b.status !== "actief");
  if (nietActief.length > 0) {
    lines.push("");
    lines.push("### ⚠ Aandachtspunten (niet-actieve bronnen)");
    lines.push("");
    lines.push("| Bron | Land | Status | Notitie |");
    lines.push("| --- | --- | --- | --- |");
    for (const b of nietActief) {
      lines.push(`| ${b.naam} | ${b.land} | ${b.status} | ${b.notities ?? ""} |`);
    }
  }

  return lines.join("\n") + "\n";
}

// CLI-modus: alleen printen als dit bestand direct wordt uitgevoerd.
if (process.argv[1] && process.argv[1].endsWith("bronnen-report.ts")) {
  process.stdout.write(bronnenReport());
}
```

- [ ] **Step 2: Verifieer dat de CLI-output ongewijzigd is**

Run: `npm run bronnen-report`
Expected: identiek markdown-rapport als voorheen (telregel + aandachtspunten-tabel).

- [ ] **Step 3: Commit**

```bash
git add scripts/bronnen-report.ts
git commit -m "refactor(scraper): bronnenReport() exporteerbaar maken"
```

---

## Task 10: Issue-rapport `scrape-report.ts` (spec §3)

Bouwt na een run één leesbaar issue-rapport: afgekeurde concepts (met keurNotitie), niet-actieve bronnen (hergebruik `bronnenReport()`), en actieve bronnen zonder sauna-profiel. Schrijft `scrape-issue.md` en print `problemen`/`schoon` zodat de workflow kan beslissen.

**Files:**
- Create: `/Users/nathaniel/Documents/Opgieting.nl/scripts/scrape-report.ts`

- [ ] **Step 1: Implementeer het rapport**

Create `scripts/scrape-report.ts`:

```ts
// Bouwt het scraper-probleemrapport na een run (spec §3).
// - Afgekeurde concepts (status: concept + keurNotitie) uit content/events/
// - Niet-actieve bronnen (via bronnenReport())
// - Actieve bronnen zonder sauna-profiel ("profiel aanmaken" blijft handwerk)
// Schrijft het rapport naar scrape-issue.md en print "problemen" of "schoon".
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { readBronnen, existingSaunaSlugs } from "./lib/content";
import { bronnenReport } from "./bronnen-report";

const EVENTS_DIR = path.join(process.cwd(), "content", "events");

interface ConceptProbleem {
  bestand: string;
  titel: string;
  keurNotitie: string;
}

function afgekeurdeConcepts(): ConceptProbleem[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  const out: ConceptProbleem[] = [];
  for (const f of fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith(".mdx"))) {
    const { data } = matter(fs.readFileSync(path.join(EVENTS_DIR, f), "utf8"));
    if (data.bron === "scraper" && data.status === "concept" && data.keurNotitie) {
      out.push({ bestand: f, titel: String(data.titel ?? f), keurNotitie: String(data.keurNotitie) });
    }
  }
  return out;
}

function actieveZonderProfiel(): string[] {
  const { bronnen } = readBronnen();
  const slugs = existingSaunaSlugs();
  return bronnen.filter((b) => b.status === "actief" && !slugs.has(b.id)).map((b) => b.naam);
}

function main() {
  const concepts = afgekeurdeConcepts();
  const zonderProfiel = actieveZonderProfiel();
  const { bronnen } = readBronnen();
  const nietActief = bronnen.filter((b) => b.status !== "actief");

  const problemen = concepts.length > 0 || nietActief.length > 0 || zonderProfiel.length > 0;

  const lines: string[] = [];
  lines.push("<!-- scraper-issue -->");
  lines.push("# Scraper-rapport");
  lines.push("");

  if (concepts.length > 0) {
    lines.push("## ⚠ Twijfelgevallen (niet gepubliceerd)");
    lines.push("");
    lines.push("Deze events zijn als `concept` weggeschreven en staan **niet** live:");
    lines.push("");
    for (const c of concepts) {
      lines.push(`- **${c.titel}** (\`${c.bestand}\`) — ${c.keurNotitie}`);
    }
    lines.push("");
  }

  if (zonderProfiel.length > 0) {
    lines.push("## Actieve bronnen zonder sauna-profiel");
    lines.push("");
    lines.push("Maak handmatig een profiel aan in `content/saunas/` zodat events zichtbaar worden:");
    lines.push("");
    for (const naam of zonderProfiel) lines.push(`- ${naam}`);
    lines.push("");
  }

  lines.push(bronnenReport());

  fs.writeFileSync("scrape-issue.md", lines.join("\n") + "\n");
  process.stdout.write(problemen ? "problemen\n" : "schoon\n");
}

main();
```

- [ ] **Step 2: Voeg een npm-script toe**

In `package.json`, in `"scripts"`, na `"test"`:

```json
    "scrape-report": "tsx scripts/scrape-report.ts"
```

- [ ] **Step 3: Verifieer**

Run: `npm run --silent scrape-report`
Expected: print `problemen` of `schoon`, en schrijft `scrape-issue.md`. Open `scrape-issue.md` en controleer dat de secties kloppen (bij een schone repo zonder afgekeurde concepts: alleen bronnensectie + niet-actieve bronnen).

Opschonen: `rm -f scrape-issue.md`

- [ ] **Step 4: Zorg dat `scrape-issue.md` niet gecommit wordt**

Voeg toe aan `.gitignore` (indien nog niet aanwezig):

```
scrape-issue.md
```

- [ ] **Step 5: Commit**

```bash
git add scripts/scrape-report.ts package.json .gitignore
git commit -m "feat(scraper): scrape-report bouwt het probleem-issue-rapport"
```

---

## Task 11: Workflow — auto-publiceren + issue-beheer (spec §2, §3)

Vervang de PR-flow door: verify (mét Firecrawl-key) → scrape (autopublish aan) → commit op `main` → één issue openen/actualiseren/sluiten.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/.github/workflows/scrape.yml`

- [ ] **Step 1: Voeg `issues: write` toe en Firecrawl-key aan de verify-stap**

Werk het `permissions`-blok bij (regel ~14-16):

```yaml
permissions:
  contents: write
  issues: write
```

En geef de verify-stap de Firecrawl-key mee (voor de §4-fallback):

```yaml
      - name: Verifieer bronnen
        run: npm run verify-bronnen -- --all
        env:
          FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
```

- [ ] **Step 2: Zet auto-publish aan op de scrape-stap**

Werk de scrape-stap bij zodat `SCRAPE_AUTOPUBLISH` aan staat (spec §5 stap 3):

```yaml
      - name: Scrape events
        run: |
          if [ -n "${{ github.event.inputs.limit }}" ]; then
            npm run scrape -- --limit ${{ github.event.inputs.limit }}
          else
            npm run scrape
          fi
        env:
          FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SCRAPE_AUTOPUBLISH: "true"
```

- [ ] **Step 3: Vervang de PR-stap door commit-op-main + issue-beheer**

Verwijder de `peter-evans/create-pull-request`-stap en de losse `pr-body.md`-bouwstap. Voeg in de plaats (na de scrape-stap):

```yaml
      - name: Commit resultaten op main
        run: |
          git config user.name "opgietingen-bot"
          git config user.email "bot@opgietingen.nl"
          git add content/events content/bronnen.json
          if git diff --cached --quiet; then
            echo "Geen wijzigingen om te committen."
          else
            git commit -m "chore(scraper): wekelijkse run — nieuwe events + bronnenstatus"
            git push origin HEAD:main
          fi

      - name: Bouw probleemrapport
        id: report
        run: echo "status=$(npm run --silent scrape-report)" >> "$GITHUB_OUTPUT"

      - name: Beheer scraper-issue
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          EXISTING=$(gh issue list --label scraper-probleem --state open --json number --jq '.[0].number')
          if [ "${{ steps.report.outputs.status }}" = "problemen" ]; then
            if [ -n "$EXISTING" ]; then
              gh issue edit "$EXISTING" --body-file scrape-issue.md
              gh issue comment "$EXISTING" --body "Rapport bijgewerkt door de wekelijkse run."
            else
              gh issue create --title "Scraper: aandachtspunten" \
                --label scraper-probleem --body-file scrape-issue.md
            fi
          else
            if [ -n "$EXISTING" ]; then
              gh issue close "$EXISTING" --comment "Schone run — geen aandachtspunten meer."
            fi
          fi
```

> Het label `scraper-probleem` moet bestaan. Voeg een guard toe of maak het label eenmalig aan: `gh label create scraper-probleem --color B60205 --description "Scraper heeft aandacht nodig" || true` als eerste regel van de issue-stap.

- [ ] **Step 4: Valideer de YAML**

Run: `npx --yes yaml-lint .github/workflows/scrape.yml` (of `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/scrape.yml'))"`)
Expected: geen syntaxfouten.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/scrape.yml
git commit -m "ci(scraper): auto-publiceren op main + één probleem-issue i.p.v. PR"
```

---

## Task 12: Documentatie bijwerken (CLAUDE.md)

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/CLAUDE.md`

- [ ] **Step 1: Werk de scraper-sectie bij**

In de sectie "Content-scraper (pipeline)":
- Documenteer het frontmatterveld `keurNotitie` (afkeurreden bij `status: concept`).
- Documenteer de kwaliteitspoort (`scripts/lib/quality-gate.ts`) met de vier criteria en "bij twijfel → concept".
- Documenteer `SCRAPE_AUTOPUBLISH=true` als de schakelaar voor auto-publiceren.
- Vervang de PR-beschrijving door: workflow commit direct op `main`; opent/actualiseert/sluit één GitHub-issue met label `scraper-probleem`.
- Voeg `npm test` en `npm run scrape-report` toe aan de commando's-tabel.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: hands-off scraper (poort, keurNotitie, auto-publish, issue-flow)"
```

---

## Rollout-checkpoint (spec §5 — GEEN code)

Vóór het aanzetten van auto-publiceren in productie (Task 11 is al gemerged maar draait wekelijks):

1. **Task 1-10** bouwen de poort + fallback met auto-publiceren nog *uit* (default `SCRAPE_AUTOPUBLISH` niet gezet → alles concept).
2. **Eén echte run lokaal** met echte keys, autopublish uit:
   `FIRECRAWL_API_KEY=... ANTHROPIC_API_KEY=... npm run scrape -- --limit 3`
   Beoordeel de output-MDX handmatig. Stel de poort bij (Task 2) als er false positives/negatives zijn. Committeer poort-aanpassingen apart.
3. Pas dán Task 11 mergen/laten draaien met `SCRAPE_AUTOPUBLISH: "true"`.

Dit is een reviewmoment voor Nathaniel, geen implementatietaak.

---

## Self-Review (spec-dekking)

- §1 Kwaliteitspoort → Task 2 (functie + tests), Task 3 (saunaSlugs), Task 5 (inpluggen). Dedup-bescherming behouden in Task 5 stap 3.
- §1 `keurNotitie` → Task 4 (frontmatter), Task 5 (vullen).
- §2 Auto-publiceren op `main` → Task 11 stap 2-3.
- §3 Probleem-issue (één, open/update/close) → Task 10 (rapport) + Task 11 stap 3. Hergebruik `bronnen-report.ts` → Task 9.
- §4 Firecrawl-fallback in verify → Task 7 (export) + Task 8 (inpluggen), robots behouden. Verify-stap krijgt key → Task 11 stap 1.
- §5 Volgorde → Rollout-checkpoint + `SCRAPE_AUTOPUBLISH`-vlag (Task 5).
- §6 Dry-run met afkeur-cases → Task 6.
- Foutafhandeling (bron overslaan, run faalt niet) → bestaande per-bron try/catch in `scrape-events.ts` blijft; Firecrawl-fallback vangt eigen errors (Task 7 `catch`). Volledig mislukte run → workflow faalt hard (bestaand gedrag).
