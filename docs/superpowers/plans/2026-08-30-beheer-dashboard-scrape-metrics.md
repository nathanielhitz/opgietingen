# Beheer-dashboard met scrape-run-metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na elke wekelijkse scrape-run één record in `data/scrape-runs.json` (per kanaal × bron zeven tellers, weggeschreven events, bronnen-statuswijzigingen) en een pagina `/beheer` die de laatste run toont met directe *Open*-links naar de Keystatic-editor.

**Architecture:** De drie scrapers en `verify-bronnen` melden hun tellers via een nieuw `scripts/lib/metrics.ts` aan een tijdelijk `scrape-metrics.json` (zelfde append-patroon als `warnings.ts`; alles in try/catch, nooit een run laten falen). Na de run vouwt `npm run run-record` dat tot één run-record in `data/scrape-runs.json` (idempotent op `id`), dat de workflow meecommit met een informatief bericht. `src/lib/scrape-runs.ts` is de enige loader; `/beheer` (server component, geen client-JS, buiten `(site)`, zelfde 404/noindex-regel als `/keystatic`) rendert indeling A. Een eenmalig backfill-script reconstrueert oude runs uit de git-historie zodat de trend niet leeg start.

**Tech Stack:** TypeScript (tsx-scripts + Next.js 15 App Router), `node:test`, gray-matter, Tailwind v4 (tokens in `globals.css`), GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-08-30-beheer-dashboard-scrape-metrics-design.md](../specs/2026-08-30-beheer-dashboard-scrape-metrics-design.md)

---

## Bestandsstructuur

| Bestand | Verantwoordelijkheid |
|---|---|
| `src/lib/scrape-runs.ts` (nieuw) | Typen (`ScrapeRun`, `BronResultaat`, …), loader `getScrapeRuns()`, pure helpers `runTotalen`, `weekTrend`, `getLaatsteRun`. Scripts importeren hier de typen. |
| `scripts/lib/metrics.ts` (nieuw) | `maakMetrics({ actief })` → `bron()`, `event()`, `mail()`, `verify()`, `bronStatus()`; appendt aan `scrape-metrics.json`; `leesMetrics()`; `legeTeller()`; `naarMethode()`. |
| `scripts/lib/run-record.ts` (nieuw) | Pure: `bouwRunRecord(metrics, ctx)`, `voegRunToe(runs, record)`, `samenvatting(record)`. |
| `scripts/run-record.ts` (nieuw) | CLI: leest `scrape-metrics.json`, schrijft `data/scrape-runs.json`, zet `samenvatting` in `$GITHUB_OUTPUT`, verwijdert het tijdelijke bestand. |
| `scripts/backfill-runs.ts` (nieuw) | Eenmalig: reconstrueert records uit `chore(scraper)`-commits. |
| `scripts/scrape-events.ts`, `scripts/scrape-facebook.ts`, `scripts/scrape-mail.ts`, `scripts/verify-bronnen.ts` (aanpassen) | Melden tellers; logica ongewijzigd. |
| `.github/workflows/scrape.yml` (aanpassen) | `RUN_GESTART`, stap `run-record`, commit met samenvatting en `data/scrape-runs.json`. |
| `src/app/globals.css` (aanpassen) | Kanaal- en statustokens. |
| `src/components/beheer/*.tsx` (nieuw) | `BeheerNav`, `RunKop`, `Tegels`, `KanaalKaart`, `ConceptTabel`, `FoutenLijst`, `Trend`. |
| `src/app/beheer/layout.tsx`, `page.tsx` (nieuw) | Guard + noindex; compositie. |
| `src/app/robots.ts`, `scripts/lib/beheer-routes.test.ts` (aanpassen) | `/beheer` disallow. |
| Tests (nieuw) | `scripts/lib/metrics.test.ts`, `scripts/lib/run-record.test.ts`, `scripts/lib/scrape-runs.test.ts`. |
| `.gitignore`, `package.json`, `CLAUDE.md` (aanpassen) | `/scrape-metrics.json`, scripts, docs. |

Tellers-definitie (geldt overal): `kandidaten` = door de extractie opgeleverde events; `dedup` = overgeslagen omdat sauna+datum al bestond (incl. "bestand bestaat al"); `verleden` = afgekeurd wegens verstreken datum (niet weggeschreven); `afgekeurd` = weggeschreven als concept omdat de **kwaliteitspoort** faalde (`!verdict.passed`) — een deelverzameling van `concept`; `concept` = weggeschreven met status concept; `gepubliceerd` = weggeschreven met status gepubliceerd. Invariant per bron: `kandidaten = dedup + verleden + concept + gepubliceerd`.

---

### Task 1: Typen en loader-helpers in `src/lib/scrape-runs.ts`

**Files:**
- Create: `src/lib/scrape-runs.ts`
- Test: `scripts/lib/scrape-runs.test.ts`

- [x] **Step 1: Schrijf de falende test**

```ts
// scripts/lib/scrape-runs.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  leesScrapeRuns,
  runTotalen,
  weekTrend,
  type ScrapeRun,
} from "../../src/lib/scrape-runs";

const bron = (id: string, over: Partial<ScrapeRun["kanalen"]["website"]["bronnen"][number]> = {}) => ({
  id, kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0,
  fout: null, methode: "statisch" as const, ...over,
});

const run: ScrapeRun = {
  id: "2026-08-31T06:04:12Z",
  workflowRun: "1",
  duurSeconden: 200,
  autopublish: true,
  backfill: false,
  fout: null,
  bronnen: { gecontroleerd: 41, statusWijzigingen: [{ id: "x", van: "actief", naar: "kapot", notitie: "DNS" }] },
  kanalen: {
    website: { bronnen: [bron("a", { kandidaten: 4, dedup: 2, concept: 2, afgekeurd: 1 }), bron("b", { fout: "robots", methode: "geen" })] },
    facebook: { bronnen: [bron("c", { kandidaten: 3, dedup: 1, concept: 1, gepubliceerd: 1, methode: "claude", posts: 6 })] },
    mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] },
  },
  events: [
    { slug: "a-x-2026-09-01", kanaal: "website", bron: "a", status: "concept", reden: "r" },
    { slug: "a-y-2026-09-02", kanaal: "website", bron: "a", status: "concept" },
    { slug: "c-z-2026-09-03", kanaal: "facebook", bron: "c", status: "concept" },
    { slug: "c-w-2026-09-04", kanaal: "facebook", bron: "c", status: "gepubliceerd" },
  ],
};

test("runTotalen telt over alle kanalen en telt fouten en statuswijzigingen", () => {
  const t = runTotalen(run);
  assert.equal(t.kandidaten, 7);
  assert.equal(t.dedup, 3);
  assert.equal(t.concept, 3);
  assert.equal(t.gepubliceerd, 1);
  assert.equal(t.afgekeurd, 1);
  assert.equal(t.fouten, 2); // 1 bronfout + 1 statuswijziging
  assert.equal(t.bronnen, 3);
  assert.equal(t.perKanaal.facebook.gepubliceerd, 1);
  assert.equal(t.perKanaal.mail.kandidaten, 0);
});

test("runTotalen leidt bij backfill-records concept/gepubliceerd af uit events", () => {
  const b: ScrapeRun = { ...run, backfill: true, kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] }, mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] } } };
  const t = runTotalen(b);
  assert.equal(t.concept, 3);
  assert.equal(t.gepubliceerd, 1);
  assert.equal(t.kandidaten, null);
});

test("weekTrend geeft de laatste n runs, oud → nieuw", () => {
  const runs = [1, 2, 3].map((i) => ({ ...run, id: `2026-08-0${i}T06:00:00Z` }));
  const trend = weekTrend(runs, 2);
  assert.deepEqual(trend.map((p) => p.id), ["2026-08-02T06:00:00Z", "2026-08-03T06:00:00Z"]);
  assert.equal(trend[0].gepubliceerd, 1);
  assert.equal(trend[0].backfill, false);
});

test("leesScrapeRuns geeft [] zonder bestand en sorteert op id", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "runs-"));
  assert.deepEqual(leesScrapeRuns(path.join(tmp, "geen.json")), []);
  const p = path.join(tmp, "runs.json");
  fs.writeFileSync(p, JSON.stringify({ runs: [{ ...run, id: "2026-08-10T00:00:00Z" }, run] }));
  assert.deepEqual(leesScrapeRuns(p).map((r) => r.id), ["2026-08-10T00:00:00Z", "2026-08-31T06:04:12Z"].sort());
  fs.writeFileSync(p, "kapot");
  assert.deepEqual(leesScrapeRuns(p), []);
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [x] **Step 2: Run — moet falen**

Run: `node --import tsx --test scripts/lib/scrape-runs.test.ts`
Expected: FAIL, `Cannot find module '../../src/lib/scrape-runs'`.

- [x] **Step 3: Implementeer de loader**

```ts
// src/lib/scrape-runs.ts
import fs from "node:fs";
import path from "node:path";

/*
  Run-metrics van de wekelijkse scrape (data/scrape-runs.json). Dit is de enige
  plek die weet waar die data vandaan komt — later vervangbaar (bv. Supabase)
  zonder dat /beheer verandert. Spec: docs/superpowers/specs/
  2026-08-30-beheer-dashboard-scrape-metrics-design.md
*/

export type Kanaal = "website" | "facebook" | "mail";
export type Methode = "statisch" | "firecrawl" | "claude" | "geen";
export const KANALEN: Kanaal[] = ["website", "facebook", "mail"];
export const KANAAL_LABEL: Record<Kanaal, string> = { website: "Website", facebook: "Facebook", mail: "Mail" };

/** Tellers van één bron in één kanaal. Invariant: kandidaten = dedup + verleden + concept + gepubliceerd. */
export interface BronResultaat {
  id: string;
  kandidaten: number;
  dedup: number;
  verleden: number;
  /** Deelverzameling van concept: de kwaliteitspoort faalde. */
  afgekeurd: number;
  concept: number;
  gepubliceerd: number;
  fout: string | null;
  methode: Methode;
  /** Alleen facebook: aantal opgehaalde posts. */
  posts?: number;
}

export interface RunEvent {
  slug: string;
  kanaal: Kanaal;
  bron: string;
  status: "concept" | "gepubliceerd";
  reden?: string;
}

export interface BronStatusWijziging {
  id: string;
  van: string;
  naar: string;
  notitie: string;
}

export interface ScrapeRun {
  /** ISO-tijdstip van de start van de workflow; tevens sleutel. */
  id: string;
  workflowRun: string | null;
  duurSeconden: number | null;
  autopublish: boolean;
  /** Gereconstrueerd uit git-historie: alleen events[] is gevuld. */
  backfill: boolean;
  fout: string | null;
  bronnen: { gecontroleerd: number | null; statusWijzigingen: BronStatusWijziging[] };
  kanalen: {
    website: { bronnen: BronResultaat[] };
    facebook: { bronnen: BronResultaat[] };
    mail: { mails: number; onbekendeAfzenders: number; bronnen: BronResultaat[] };
  };
  events: RunEvent[];
}

export interface Totalen {
  kandidaten: number | null;
  dedup: number | null;
  verleden: number | null;
  afgekeurd: number | null;
  concept: number;
  gepubliceerd: number;
}

export interface RunTotalen extends Totalen {
  /** Bronfouten + bronnen-statuswijzigingen. */
  fouten: number;
  /** Aantal bron-regels over alle kanalen. */
  bronnen: number;
  perKanaal: Record<Kanaal, Totalen>;
}

export const SCRAPE_RUNS_PATH = path.join(process.cwd(), "data", "scrape-runs.json");

function leegTotaal(): Totalen {
  return { kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0 };
}

function telKanaal(bronnen: BronResultaat[]): Totalen {
  const t = leegTotaal();
  for (const b of bronnen) {
    t.kandidaten = (t.kandidaten ?? 0) + b.kandidaten;
    t.dedup = (t.dedup ?? 0) + b.dedup;
    t.verleden = (t.verleden ?? 0) + b.verleden;
    t.afgekeurd = (t.afgekeurd ?? 0) + b.afgekeurd;
    t.concept += b.concept;
    t.gepubliceerd += b.gepubliceerd;
  }
  return t;
}

function telEvents(events: RunEvent[], kanaal?: Kanaal): Totalen {
  const sel = kanaal ? events.filter((e) => e.kanaal === kanaal) : events;
  return {
    kandidaten: null, dedup: null, verleden: null, afgekeurd: null,
    concept: sel.filter((e) => e.status === "concept").length,
    gepubliceerd: sel.filter((e) => e.status === "gepubliceerd").length,
  };
}

/** Totalen per run; backfill-records hebben geen tellers en tellen via events[]. */
export function runTotalen(run: ScrapeRun): RunTotalen {
  const perKanaal = {} as Record<Kanaal, Totalen>;
  for (const k of KANALEN) {
    perKanaal[k] = run.backfill ? telEvents(run.events, k) : telKanaal(run.kanalen[k].bronnen);
  }
  const som = (veld: keyof Totalen): number | null =>
    run.backfill && veld !== "concept" && veld !== "gepubliceerd"
      ? null
      : KANALEN.reduce((acc, k) => acc + (perKanaal[k][veld] ?? 0), 0);
  const bronfouten = KANALEN.reduce((acc, k) => acc + run.kanalen[k].bronnen.filter((b) => b.fout).length, 0);
  return {
    kandidaten: som("kandidaten"),
    dedup: som("dedup"),
    verleden: som("verleden"),
    afgekeurd: som("afgekeurd"),
    concept: som("concept") ?? 0,
    gepubliceerd: som("gepubliceerd") ?? 0,
    fouten: bronfouten + run.bronnen.statusWijzigingen.length,
    bronnen: KANALEN.reduce((acc, k) => acc + run.kanalen[k].bronnen.length, 0),
    perKanaal,
  };
}

export interface TrendPunt {
  id: string;
  kandidaten: number | null;
  concept: number;
  gepubliceerd: number;
  backfill: boolean;
}

/** Laatste n runs, oud → nieuw. */
export function weekTrend(runs: ScrapeRun[], n = 12): TrendPunt[] {
  return [...runs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(-n)
    .map((r) => {
      const t = runTotalen(r);
      return { id: r.id, kandidaten: t.kandidaten, concept: t.concept, gepubliceerd: t.gepubliceerd, backfill: r.backfill };
    });
}

/** Leest het run-bestand; ontbrekend of onleesbaar → [] (de build mag hier nooit op breken). */
export function leesScrapeRuns(bestand: string = SCRAPE_RUNS_PATH): ScrapeRun[] {
  if (!fs.existsSync(bestand)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(bestand, "utf8")) as { runs?: unknown };
    if (!Array.isArray(data.runs)) return [];
    return (data.runs as ScrapeRun[])
      .filter((r) => r && typeof r.id === "string" && r.kanalen && Array.isArray(r.events))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export function getScrapeRuns(): ScrapeRun[] {
  return leesScrapeRuns();
}

export function getLaatsteRun(): ScrapeRun | undefined {
  const runs = getScrapeRuns();
  return runs[runs.length - 1];
}
```

- [x] **Step 4: Run — moet slagen**

Run: `node --import tsx --test scripts/lib/scrape-runs.test.ts`
Expected: 4 tests `ok`.

- [x] **Step 5: Commit**

```bash
git add src/lib/scrape-runs.ts scripts/lib/scrape-runs.test.ts
git commit -m "feat(beheer): typen en loader voor scrape-run-metrics"
```

---

### Task 2: `scripts/lib/metrics.ts` — melden tijdens de run

**Files:**
- Create: `scripts/lib/metrics.ts`
- Test: `scripts/lib/metrics.test.ts`
- Modify: `.gitignore`

- [x] **Step 1: Schrijf de falende test**

```ts
// scripts/lib/metrics.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { maakMetrics, leesMetrics, legeTeller, naarMethode, METRICS_BESTAND } from "./metrics";

// maakMetrics schrijft naar process.cwd()/scrape-metrics.json; de tests draaien
// in een lege tijdelijke map zodat ze het echte bestand niet raken.
function withTmpCwd(fn: () => void): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metrics-test-"));
  const orig = process.cwd();
  process.chdir(tmp);
  try { fn(); } finally { process.chdir(orig); fs.rmSync(tmp, { recursive: true, force: true }); }
}

test("legeTeller start op nul met methode 'geen'", () => {
  assert.deepEqual(legeTeller("a"), {
    id: "a", kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0, fout: null, methode: "geen",
  });
});

test("naarMethode vertaalt de extractiemethode van de scraper", () => {
  assert.equal(naarMethode("plain-claude"), "statisch");
  assert.equal(naarMethode("firecrawl-json"), "firecrawl");
  assert.equal(naarMethode("claude-fallback"), "claude");
  assert.equal(naarMethode("none"), "geen");
});

test("meldingen van meerdere scripts komen samen in één bestand", () => {
  withTmpCwd(() => {
    const m1 = maakMetrics({ actief: true });
    m1.verify({ gecontroleerd: 41 });
    m1.bronStatus({ id: "x", van: "actief", naar: "kapot", notitie: "DNS" });
    m1.bron("website", { ...legeTeller("a"), kandidaten: 2, concept: 2, methode: "statisch" });
    m1.event({ slug: "a-1", kanaal: "website", bron: "a", status: "concept", reden: "r" });
    const m2 = maakMetrics({ actief: true }); // volgend script in dezelfde run
    m2.bron("facebook", { ...legeTeller("c"), posts: 3 });
    m2.mail({ mails: 2, onbekendeAfzenders: 1 });
    const data = leesMetrics();
    assert.ok(data);
    assert.equal(data.verify?.gecontroleerd, 41);
    assert.equal(data.bronStatusWijzigingen.length, 1);
    assert.deepEqual(data.bronResultaten.map((b) => [b.kanaal, b.id]), [["website", "a"], ["facebook", "c"]]);
    assert.equal(data.events.length, 1);
    assert.deepEqual(data.mail, { mails: 2, onbekendeAfzenders: 1 });
  });
});

test("inactief (dry-run) schrijft niets", () => {
  withTmpCwd(() => {
    const m = maakMetrics({ actief: false });
    m.bron("website", legeTeller("a"));
    m.event({ slug: "a-1", kanaal: "website", bron: "a", status: "concept" });
    assert.equal(fs.existsSync(METRICS_BESTAND()), false);
    assert.equal(leesMetrics(), null);
  });
});

test("een onleesbaar bestand wordt met een waarschuwing overschreven, nooit gegooid", () => {
  withTmpCwd(() => {
    fs.writeFileSync(METRICS_BESTAND(), "geen json");
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (msg: string) => { warns.push(String(msg)); };
    try {
      maakMetrics({ actief: true }).bron("website", legeTeller("a"));
    } finally { console.warn = orig; }
    assert.equal(warns.length, 1);
    assert.equal(leesMetrics()?.bronResultaten.length, 1);
  });
});

test("een schrijffout wordt geslikt", () => {
  withTmpCwd(() => {
    fs.mkdirSync(METRICS_BESTAND()); // pad is nu een map → writeFileSync faalt
    const orig = console.warn;
    console.warn = () => {};
    try {
      assert.doesNotThrow(() => maakMetrics({ actief: true }).bron("website", legeTeller("a")));
    } finally { console.warn = orig; }
  });
});
```

- [x] **Step 2: Run — moet falen**

Run: `node --import tsx --test scripts/lib/metrics.test.ts`
Expected: FAIL, module `./metrics` niet gevonden.

- [x] **Step 3: Implementeer**

```ts
// scripts/lib/metrics.ts
import fs from "node:fs";
import path from "node:path";
import type { BronResultaat, BronStatusWijziging, Kanaal, Methode, RunEvent } from "../../src/lib/scrape-runs";
import type { ExtractionMethod } from "../../src/lib/scraper";

/*
  Run-metrics tijdens de wekelijkse scrape. Elk script (verify-bronnen, de drie
  scrapers) meldt hier wat het deed; alles wordt geappend aan scrape-metrics.json
  (gitignored), dat `npm run run-record` na de run tot één record vouwt.

  Harde regel: niets hier mag ooit gooien. Een metrics-fout logt een waarschuwing
  en laat de scrape gewoon doorgaan — de metrics zijn bijzaak, de events niet.
*/

export interface MetricsBestand {
  verify?: { gecontroleerd: number };
  bronStatusWijzigingen: BronStatusWijziging[];
  bronResultaten: (BronResultaat & { kanaal: Kanaal })[];
  events: RunEvent[];
  mail?: { mails: number; onbekendeAfzenders: number };
}

/** Pad per aanroep bepaald (niet als module-constante) zodat tests in een tijdelijke cwd werken. */
export const METRICS_BESTAND = () => path.join(process.cwd(), "scrape-metrics.json");

function leeg(): MetricsBestand {
  return { bronStatusWijzigingen: [], bronResultaten: [], events: [] };
}

export function legeTeller(id: string): BronResultaat {
  return { id, kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0, fout: null, methode: "geen" };
}

export function naarMethode(m: ExtractionMethod): Methode {
  switch (m) {
    case "plain-claude": return "statisch";
    case "firecrawl-json": return "firecrawl";
    case "claude-fallback": return "claude";
    default: return "geen";
  }
}

/** Leest het tijdelijke bestand; ontbreekt het of is het onleesbaar → null. */
export function leesMetrics(): MetricsBestand | null {
  const p = METRICS_BESTAND();
  if (!fs.existsSync(p)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<MetricsBestand>;
    return { ...leeg(), ...d };
  } catch {
    return null;
  }
}

function muteer(wijzig: (d: MetricsBestand) => void): void {
  try {
    const p = METRICS_BESTAND();
    let data = leeg();
    if (fs.existsSync(p)) {
      const bestaand = leesMetrics();
      if (bestaand) data = bestaand;
      else console.warn("scrape-metrics.json was onleesbaar (geen geldige JSON) — wordt overschreven.");
    }
    wijzig(data);
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  } catch (err) {
    console.warn(`metrics niet weggeschreven: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface Metrics {
  verify(v: { gecontroleerd: number }): void;
  bronStatus(w: BronStatusWijziging): void;
  bron(kanaal: Kanaal, r: BronResultaat): void;
  event(e: RunEvent): void;
  mail(m: { mails: number; onbekendeAfzenders: number }): void;
}

/** `actief: false` (dry-run) → alle methodes zijn no-ops. */
export function maakMetrics(opts: { actief: boolean }): Metrics {
  if (!opts.actief) {
    const noop = () => {};
    return { verify: noop, bronStatus: noop, bron: noop, event: noop, mail: noop };
  }
  return {
    verify: (v) => muteer((d) => { d.verify = v; }),
    bronStatus: (w) => muteer((d) => { d.bronStatusWijzigingen.push(w); }),
    bron: (kanaal, r) => muteer((d) => { d.bronResultaten.push({ ...r, kanaal }); }),
    event: (e) => muteer((d) => { d.events.push(e); }),
    mail: (m) => muteer((d) => { d.mail = m; }),
  };
}
```

- [x] **Step 4: Run — moet slagen**

Run: `node --import tsx --test scripts/lib/metrics.test.ts`
Expected: 6 tests `ok`.

- [x] **Step 5: gitignore**

Voeg aan `.gitignore` toe, direct onder de regel `/scrape-warnings.json`:
```
# gegenereerde run-metrics (input voor run-record; wordt daarna verwijderd)
/scrape-metrics.json
```

- [x] **Step 6: Commit**

```bash
git add scripts/lib/metrics.ts scripts/lib/metrics.test.ts .gitignore
git commit -m "feat(scraper): metrics-melder voor run-records (append, nooit gooien)"
```

---

### Task 3: Website-scraper meldt tellers

**Files:**
- Modify: `scripts/scrape-events.ts` (import bovenin; lus in `main()` rond regels 120–305)

- [x] **Step 1: Import en metrics-instantie**

Onder `import { appendScrapeWarnings } from "./lib/warnings";`:
```ts
import { maakMetrics, legeTeller, naarMethode } from "./lib/metrics";
import path from "node:path";
```
(`path` is al geïmporteerd op regel 1 — dan die regel niet dubbel toevoegen.)

Direct onder `const AUTO_PUBLISH = …`:
```ts
// Run-metrics voor /beheer; in dry-run niets schrijven.
const metrics = maakMetrics({ actief: !DRY_RUN });
```

- [x] **Step 2: Teller per bron**

In de `for (const bron of targets)`-lus, direct na `console.log(\`— ${bron.naam} …\`)`:
```ts
    const teller = legeTeller(bron.id);
```

Robots-blokkade (`continue` na de robots-melding) — vóór `continue;`:
```ts
      metrics.bron("website", { ...teller, fout: "robots.txt blokkeert de agenda-URL" });
```

Scrape-fout in `catch` — vóór `continue;`:
```ts
      metrics.bron("website", { ...teller, fout: `scrape-fout: ${msg}` });
```

Na `console.log(\`  Extractie: …\`)`:
```ts
    teller.methode = naarMethode(outcome.method);
    teller.kandidaten = outcome.events.length;
    if (outcome.method === "none") teller.fout = `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`;
```

In de dedup-tak, bij `skipped++;` (de eerste, in het `if (existing.has(key) || seen.has(key))`-blok): voeg eronder `teller.dedup++;`.
In de `if (verdict.verleden)`-tak bij `skipped++;`: voeg eronder `teller.verleden++;`.

Na `const path = writeEventMdx(newEvent, DOEL_DIR);` — het `if (path)`-blok wordt:
```ts
      if (path) {
        seen.add(key);
        if (!perTitelDatum.has(tdKey)) perTitelDatum.set(tdKey, bron.id);
        written++;
        if (status === "gepubliceerd") teller.gepubliceerd++;
        else teller.concept++;
        if (!verdict.passed) teller.afgekeurd++;
        metrics.event({
          slug: path.split("/").pop()!.replace(/\.mdx$/, ""),
          kanaal: "website",
          bron: bron.id,
          status,
          ...(keurNotitie ? { reden: keurNotitie } : {}),
        });
        console.log(
          `  + ${status}${keurNotitie ? " (concept: " + keurNotitie + ")" : ""} — ${ev.titel}`,
        );
      } else {
        skipped++;
        teller.dedup++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
```
Let op: de lokale variabele heet `path` (string) en schaduwt de `node:path`-import binnen dat blok — daarom `split("/")` en niet `path.basename`. Alternatief dat netter is: hernoem `const path = writeEventMdx(...)` naar `const mdxPad = writeEventMdx(...)` en gebruik `path.basename(mdxPad, ".mdx")`. Kies het laatste.

Aan het einde van de bron-iteratie, vóór `console.log("");`:
```ts
    metrics.bron("website", teller);
```

- [x] **Step 3: Verifieer met dry-run en typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npm run scrape -- --dry-run --limit 2 && ls scrape-metrics.json`
Expected: typecheck schoon; dry-run-output ongewijzigd; `ls` geeft "No such file" (dry-run schrijft niets).

- [x] **Step 4: Commit**

```bash
git add scripts/scrape-events.ts
git commit -m "feat(scraper): website-scraper meldt run-metrics per bron en per event"
```

---

### Task 4: Facebook-scraper meldt tellers

**Files:**
- Modify: `scripts/scrape-facebook.ts`

- [x] **Step 1: Import en instantie**

Onder `import { appendScrapeWarnings } from "./lib/warnings";`:
```ts
import path from "node:path";
import { maakMetrics, legeTeller, naarMethode } from "./lib/metrics";
```
Onder de `AUTO_PUBLISH`/`DRY_RUN`-constanten:
```ts
const metrics = maakMetrics({ actief: !DRY_RUN });
```

- [x] **Step 2: Teller per bron**

Na `console.log(\`— ${bron.naam} (${bron.facebook})\`)`:
```ts
    const teller = legeTeller(bron.id);
```
Na `const fetched = await fetchFacebookPosts(...)`: `teller.posts = fetched.posts.length;`
In de `catch` van `extractEventsFromText`: `teller.fout = \`extractie-fout: ${msg}\`;`
Als `fetched.warnings.length` én `fetched.posts.length === 0` (de bron gaf niets): na `console.log("  Geen (recente) posts gevonden.")` niets extra — 0 posts is geen fout.

Binnen `if (outcome) {` na de `Extractie:`-log:
```ts
      teller.methode = naarMethode(outcome.method);
      teller.kandidaten = outcome.events.length;
      if (outcome.method === "none") teller.fout = `extractie faalde (${outcome.warnings.join(" | ") || "geen details"})`;
```
Dedup-tak: `teller.dedup++;` onder `skipped++`. Verleden-tak: `teller.verleden++;`.
Het `if (filePath)`-blok:
```ts
        if (filePath) {
          seen.add(key);
          if (!perTitelDatum.has(tdKey)) perTitelDatum.set(tdKey, bron.id);
          written++;
          if (status === "gepubliceerd") teller.gepubliceerd++;
          else teller.concept++;
          if (!verdict.passed) teller.afgekeurd++;
          metrics.event({
            slug: path.basename(filePath, ".mdx"),
            kanaal: "facebook",
            bron: bron.id,
            status,
            ...(keurNotitie ? { reden: keurNotitie } : {}),
          });
          console.log(`  + ${status}${keurNotitie ? " (concept: " + keurNotitie + ")" : ""} — ${ev.titel}`);
        } else {
          skipped++;
          teller.dedup++;
          console.log(`  = bestand bestaat al voor: ${ev.titel}`);
        }
```
Vóór `console.log("");` aan het einde van de bron-iteratie:
```ts
    metrics.bron("facebook", teller);
```

- [x] **Step 3: Verifieer**

Run: `npx tsc --noEmit -p tsconfig.json && npm run scrape-facebook -- --dry-run && ls scrape-metrics.json`
Expected: schoon; dry-run ongewijzigd; geen metrics-bestand.

- [x] **Step 4: Commit**

```bash
git add scripts/scrape-facebook.ts
git commit -m "feat(scraper): facebook-scraper meldt run-metrics"
```

---

### Task 5: Mail-scraper en verify-bronnen melden

**Files:**
- Modify: `scripts/scrape-mail.ts`, `scripts/verify-bronnen.ts`

- [x] **Step 1: Mail-scraper**

Imports (onder de bestaande `./lib/…`-imports):
```ts
import path from "node:path";
import { maakMetrics, legeTeller, naarMethode } from "./lib/metrics";
```
Onder de `DRY_RUN`-constante: `const metrics = maakMetrics({ actief: !DRY_RUN });`

Per mail is de "bron" de gematchte sauna of `"onbekend"`. Na `console.log(\`— ${mail.from} …\`)`:
```ts
    const teller = legeTeller(bron?.id ?? "onbekend");
```
In de `catch` rond `extractEventsFromText`, vóór `continue;`:
```ts
      metrics.bron("mail", { ...teller, fout: `extractie-fout: ${err instanceof Error ? err.message : String(err)}` });
```
Na de `Extractie:`-log:
```ts
    teller.methode = naarMethode(outcome.method);
    teller.kandidaten = outcome.events.length;
    if (outcome.method === "none") teller.fout = "extractie faalde";
```
Dedup-tak: `teller.dedup++;`. Het `if (mdxPad)`-blok:
```ts
      if (mdxPad) {
        seen.add(key);
        written++;
        teller.concept++; // mail publiceert nooit automatisch
        if (!verdict.passed) teller.afgekeurd++;
        metrics.event({
          slug: path.basename(mdxPad, ".mdx"),
          kanaal: "mail",
          bron: bron?.id ?? "onbekend",
          status,
          ...(redenen.length ? { reden: redenen.join("; ") } : {}),
        });
        console.log(`  + ${status}${redenen.length ? " (afgekeurd: " + redenen.join("; ") + ")" : ""} — ${ev.titel}`);
      } else {
        skipped++;
        teller.dedup++;
        console.log(`  = bestand bestaat al voor: ${ev.titel}`);
      }
```
Vóór `console.log("");` aan het einde van de mail-iteratie: `metrics.bron("mail", teller);`

Na de `for (const mail of mails)`-lus (vóór het markeren als gelezen):
```ts
  metrics.mail({ mails: mails.length, onbekendeAfzenders: mails.filter((m) => !matchBronBySender(data.bronnen, m.from)).length });
```
Let op: de twee vroege `return`s (geen IMAP / inbox onbereikbaar) melden niets — run-record laat `mail` dan leeg (`mails: 0`).

- [x] **Step 2: verify-bronnen**

Import: `import { maakMetrics } from "./lib/metrics";` en onder de bestaande constanten `const metrics = maakMetrics({ actief: true });` (verify heeft geen dry-run).

In de lus, direct vóór `bron.status = result.status;`:
```ts
    if (bron.status !== result.status) {
      metrics.bronStatus({ id: bron.id, van: bron.status, naar: result.status, notitie: result.notitie });
    }
```
Na de lus, vóór `writeBronnen(data);`:
```ts
  metrics.verify({ gecontroleerd: todo.length });
```

- [x] **Step 3: Verifieer**

Run: `npx tsc --noEmit -p tsconfig.json && npm run scrape-mail -- --dry-run && ls scrape-metrics.json; npm test`
Expected: schoon; dry-run-output ongewijzigd; geen metrics-bestand; alle tests groen (154 + 10 nieuwe = 164).

- [x] **Step 4: Commit**

```bash
git add scripts/scrape-mail.ts scripts/verify-bronnen.ts
git commit -m "feat(scraper): mail-scraper en verify-bronnen melden run-metrics"
```

---

### Task 6: `run-record` — van tijdelijke metrics naar run-record

**Files:**
- Create: `scripts/lib/run-record.ts`, `scripts/run-record.ts`
- Test: `scripts/lib/run-record.test.ts`
- Modify: `package.json`

- [x] **Step 1: Falende test**

```ts
// scripts/lib/run-record.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwRunRecord, voegRunToe, samenvatting } from "./run-record";
import { legeTeller, type MetricsBestand } from "./metrics";

const ctx = { id: "2026-08-31T06:04:12Z", workflowRun: "123", duurSeconden: 221, autopublish: true };

const metrics: MetricsBestand = {
  verify: { gecontroleerd: 41 },
  bronStatusWijzigingen: [{ id: "x", van: "actief", naar: "kapot", notitie: "DNS" }],
  bronResultaten: [
    { ...legeTeller("a"), kanaal: "website", kandidaten: 4, dedup: 2, concept: 2, afgekeurd: 1, methode: "statisch" },
    { ...legeTeller("c"), kanaal: "facebook", kandidaten: 1, gepubliceerd: 1, methode: "claude", posts: 5 },
    { ...legeTeller("onbekend"), kanaal: "mail", kandidaten: 1, concept: 1, methode: "claude" },
  ],
  events: [
    { slug: "a-1", kanaal: "website", bron: "a", status: "concept", reden: "r" },
    { slug: "a-2", kanaal: "website", bron: "a", status: "concept" },
    { slug: "c-1", kanaal: "facebook", bron: "c", status: "gepubliceerd" },
    { slug: "m-1", kanaal: "mail", bron: "onbekend", status: "concept" },
  ],
  mail: { mails: 2, onbekendeAfzenders: 1 },
};

test("bouwRunRecord groepeert per kanaal en neemt context over", () => {
  const r = bouwRunRecord(metrics, ctx);
  assert.equal(r.id, ctx.id);
  assert.equal(r.workflowRun, "123");
  assert.equal(r.backfill, false);
  assert.equal(r.fout, null);
  assert.equal(r.bronnen.gecontroleerd, 41);
  assert.equal(r.kanalen.website.bronnen.length, 1);
  assert.equal(r.kanalen.facebook.bronnen[0].posts, 5);
  assert.equal(r.kanalen.mail.mails, 2);
  assert.equal(r.events.length, 4);
  assert.equal("kanaal" in r.kanalen.website.bronnen[0], false, "kanaal-veld hoort niet in het record");
});

test("zonder metrics ontstaat een leeg record met fout 'geen metrics'", () => {
  const r = bouwRunRecord(null, ctx);
  assert.equal(r.fout, "geen metrics");
  assert.deepEqual(r.events, []);
  assert.equal(r.kanalen.mail.mails, 0);
  assert.equal(r.bronnen.gecontroleerd, null);
});

test("voegRunToe is idempotent op id en sorteert oud → nieuw", () => {
  const oud = bouwRunRecord(null, { ...ctx, id: "2026-08-24T06:00:00Z" });
  const nieuw = bouwRunRecord(metrics, ctx);
  const runs = voegRunToe([nieuw, oud], { ...nieuw, duurSeconden: 999 });
  assert.deepEqual(runs.map((r) => r.id), ["2026-08-24T06:00:00Z", "2026-08-31T06:04:12Z"]);
  assert.equal(runs[1].duurSeconden, 999);
});

test("samenvatting is de commit-regel", () => {
  assert.equal(samenvatting(bouwRunRecord(metrics, ctx)), "6 kandidaten, 1 gepubliceerd, 3 concept, 1 bronfout");
  assert.equal(samenvatting(bouwRunRecord(null, ctx)), "geen metrics");
});
```

- [x] **Step 2: Run — moet falen**

Run: `node --import tsx --test scripts/lib/run-record.test.ts` → FAIL, module niet gevonden.

- [x] **Step 3: Implementeer de pure laag**

```ts
// scripts/lib/run-record.ts
import { KANALEN, runTotalen, type BronResultaat, type ScrapeRun } from "../../src/lib/scrape-runs";
import type { MetricsBestand } from "./metrics";

export interface RunContext {
  id: string;
  workflowRun: string | null;
  duurSeconden: number | null;
  autopublish: boolean;
}

/** Vouwt de tijdelijke metrics tot één run-record. `null` metrics = niets gemeld → fout "geen metrics". */
export function bouwRunRecord(metrics: MetricsBestand | null, ctx: RunContext): ScrapeRun {
  const perKanaal = (kanaal: string): BronResultaat[] =>
    (metrics?.bronResultaten ?? [])
      .filter((b) => b.kanaal === kanaal)
      .map(({ kanaal: _k, ...rest }) => rest);
  return {
    id: ctx.id,
    workflowRun: ctx.workflowRun,
    duurSeconden: ctx.duurSeconden,
    autopublish: ctx.autopublish,
    backfill: false,
    fout: metrics ? null : "geen metrics",
    bronnen: {
      gecontroleerd: metrics?.verify?.gecontroleerd ?? null,
      statusWijzigingen: metrics?.bronStatusWijzigingen ?? [],
    },
    kanalen: {
      website: { bronnen: perKanaal("website") },
      facebook: { bronnen: perKanaal("facebook") },
      mail: {
        mails: metrics?.mail?.mails ?? 0,
        onbekendeAfzenders: metrics?.mail?.onbekendeAfzenders ?? 0,
        bronnen: perKanaal("mail"),
      },
    },
    events: metrics?.events ?? [],
  };
}

/** Vervangt een bestaand record met dezelfde id (idempotent) en sorteert oud → nieuw. */
export function voegRunToe(runs: ScrapeRun[], record: ScrapeRun): ScrapeRun[] {
  return [...runs.filter((r) => r.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id));
}

/** Eén regel voor het commit-bericht. */
export function samenvatting(run: ScrapeRun): string {
  if (run.fout === "geen metrics") return "geen metrics";
  const t = runTotalen(run);
  const delen = [`${t.kandidaten ?? 0} kandidaten`, `${t.gepubliceerd} gepubliceerd`, `${t.concept} concept`];
  const bronfouten = KANALEN.reduce((acc, k) => acc + run.kanalen[k].bronnen.filter((b) => b.fout).length, 0);
  if (bronfouten) delen.push(`${bronfouten} bronfout${bronfouten === 1 ? "" : "en"}`);
  return delen.join(", ");
}
```

- [x] **Step 4: Run — moet slagen**

Run: `node --import tsx --test scripts/lib/run-record.test.ts` → 4 `ok`.

- [x] **Step 5: CLI-script**

```ts
// scripts/run-record.ts
/*
  Vouwt scrape-metrics.json (gemeld door verify-bronnen en de drie scrapers) tot
  één run-record in data/scrape-runs.json en schrijft een samenvattingsregel
  naar $GITHUB_OUTPUT voor het commit-bericht. Idempotent: nogmaals draaien
  vervangt het record van deze run.

    npm run run-record                # in de workflow (RUN_GESTART, GITHUB_RUN_ID gezet)
    npm run run-record -- --dry-run   # toon het record, schrijf niets
*/
import fs from "node:fs";
import path from "node:path";
import { leesScrapeRuns, SCRAPE_RUNS_PATH } from "../src/lib/scrape-runs";
import { leesMetrics, METRICS_BESTAND } from "./lib/metrics";
import { bouwRunRecord, voegRunToe, samenvatting } from "./lib/run-record";

const DRY_RUN = process.argv.includes("--dry-run");

const gestart = process.env.RUN_GESTART ? new Date(process.env.RUN_GESTART) : null;
const nu = new Date();
const ctx = {
  id: (gestart ?? nu).toISOString().replace(/\.\d{3}Z$/, "Z"),
  workflowRun: process.env.GITHUB_RUN_ID ?? null,
  duurSeconden: gestart ? Math.round((nu.getTime() - gestart.getTime()) / 1000) : null,
  autopublish: process.env.SCRAPE_AUTOPUBLISH === "true",
};

const metrics = leesMetrics();
const record = bouwRunRecord(metrics, ctx);
const regel = samenvatting(record);

if (DRY_RUN) {
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nSamenvatting: ${regel}`);
} else {
  const runs = voegRunToe(leesScrapeRuns(), record);
  fs.mkdirSync(path.dirname(SCRAPE_RUNS_PATH), { recursive: true });
  fs.writeFileSync(SCRAPE_RUNS_PATH, JSON.stringify({ runs }, null, 2) + "\n");
  if (fs.existsSync(METRICS_BESTAND())) fs.rmSync(METRICS_BESTAND());
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `samenvatting=${regel}\n`);
  console.log(`Run-record ${record.id} weggeschreven (${runs.length} runs). ${regel}`);
}
```

`package.json` scripts, onder `"scrape-report"`:
```json
    "run-record": "tsx scripts/run-record.ts",
```

- [x] **Step 6: Handmatige proef**

Run: `npm run run-record -- --dry-run`
Expected: JSON van een record met `"fout": "geen metrics"` (er is geen metrics-bestand) en `Samenvatting: geen metrics`. Geen `data/scrape-runs.json` aangemaakt (`ls data/`).

- [x] **Step 7: Commit**

```bash
git add scripts/lib/run-record.ts scripts/lib/run-record.test.ts scripts/run-record.ts package.json
git commit -m "feat(scraper): run-record vouwt metrics tot data/scrape-runs.json"
```

---

### Task 7: Workflow: starttijd, run-record-stap, informatieve commit

**Files:**
- Modify: `.github/workflows/scrape.yml`

- [x] **Step 1: Starttijd vastleggen**

Direct na de stap `Install dependencies`:
```yaml
      # Starttijd van de run = sleutel van het run-record (data/scrape-runs.json).
      - name: Leg starttijd vast
        run: echo "RUN_GESTART=$(date -u +%FT%TZ)" >> "$GITHUB_ENV"
```

- [x] **Step 2: Run-record-stap**

Direct vóór `- name: Commit resultaten op main`:
```yaml
      # Vouw de metrics van verify-bronnen en de drie scrapers tot één
      # run-record voor /beheer. Altijd, ook na een gefaalde stap: een run die
      # niets opleverde is óók een datapunt.
      - name: Bouw run-record
        id: runrecord
        if: always()
        env:
          SCRAPE_AUTOPUBLISH: "true"
        run: npm run run-record
```

- [x] **Step 3: Commit-stap**

Vervang in de commit-stap:
```yaml
          git add content/events content/bronnen.json content/saunas data/scrape-runs.json
```
en
```yaml
            git commit -m "chore(scraper): run $(date -u +%d-%m) — ${{ steps.runrecord.outputs.samenvatting || 'geen samenvatting' }}"
```
De rest (gecommit-output, push) blijft. Pas de comment boven de stap aan met: `Het run-record verandert elke week, dus er is nu elke run een commit — bewust.`

- [x] **Step 4: Valideer de YAML**

Run: `node -e 'require("js-yaml")' 2>/dev/null || true; npx -y yaml-lint .github/workflows/scrape.yml 2>&1 | tail -2 || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/scrape.yml')); print('YAML ok')"`
Expected: `YAML ok` (of geen fouten van yaml-lint).

- [x] **Step 5: Commit**

```bash
git add .github/workflows/scrape.yml
git commit -m "ci(scraper): run-record na elke run, commit met samenvatting"
```

---

### Task 8: Backfill uit de git-historie

**Files:**
- Create: `scripts/backfill-runs.ts`
- Create (gegenereerd): `data/scrape-runs.json`

- [x] **Step 1: Script**

```ts
// scripts/backfill-runs.ts
/*
  Eenmalige reconstructie van run-records uit de git-historie, zodat de trend op
  /beheer niet leeg start. Per commit met "chore(scraper)" in het bericht worden
  de TOEGEVOEGDE event-bestanden gelezen (status, sauna, keurNotitie). Tellers
  zijn niet reconstrueerbaar → backfill: true, alleen events[] gevuld.

    npx tsx scripts/backfill-runs.ts            # schrijft data/scrape-runs.json (bestaande ids blijven)
    npx tsx scripts/backfill-runs.ts --dry-run  # toont wat het zou toevoegen
*/
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { leesScrapeRuns, SCRAPE_RUNS_PATH, type Kanaal, type RunEvent, type ScrapeRun } from "../src/lib/scrape-runs";
import { voegRunToe } from "./lib/run-record";

const DRY_RUN = process.argv.includes("--dry-run");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

// Blokken: "<sha>|<iso>|<onderwerp>\n<pad>\n<pad>…"
const log = git("log", "--format=%x01%H|%aI|%s", "--name-only", "--diff-filter=A", "--", "content/events");
const blokken = log.split("").filter(Boolean);

function kanaalUit(commitOnderwerp: string): Kanaal {
  if (/facebook/i.test(commitOnderwerp)) return "facebook";
  if (/mail|nieuwsbrief/i.test(commitOnderwerp)) return "mail";
  return "website";
}

const nieuw: ScrapeRun[] = [];
for (const blok of blokken) {
  const [kop, ...regels] = blok.trim().split("\n");
  const [sha, iso, onderwerp] = kop.split("|");
  if (!/chore\(scraper\)/.test(onderwerp)) continue;
  const bestanden = regels.map((r) => r.trim()).filter((r) => r.endsWith(".mdx"));
  const events: RunEvent[] = [];
  for (const bestand of bestanden) {
    let inhoud: string;
    try { inhoud = git("show", `${sha}:${bestand}`); } catch { continue; }
    const { data } = matter(inhoud);
    if (data.bron !== "scraper") continue;
    const status = data.status === "gepubliceerd" ? "gepubliceerd" : "concept";
    events.push({
      slug: path.basename(bestand, ".mdx"),
      kanaal: kanaalUit(onderwerp),
      bron: String(data.saunaSlug ?? "onbekend"),
      status,
      ...(data.keurNotitie ? { reden: String(data.keurNotitie) } : {}),
    });
  }
  nieuw.push({
    id: new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z"),
    workflowRun: null,
    duurSeconden: null,
    autopublish: true,
    backfill: true,
    fout: null,
    bronnen: { gecontroleerd: null, statusWijzigingen: [] },
    kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] }, mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] } },
    events,
  });
}

const bestaand = leesScrapeRuns();
const bestaandeIds = new Set(bestaand.map((r) => r.id));
const toeTeVoegen = nieuw.filter((r) => !bestaandeIds.has(r.id));
let runs = bestaand;
for (const r of toeTeVoegen) runs = voegRunToe(runs, r);

console.log(`${blokken.length} commits met toegevoegde events, ${nieuw.length} scraper-runs, ${toeTeVoegen.length} nieuw.`);
for (const r of toeTeVoegen) console.log(`  ${r.id}  ${r.events.length} events (${r.events.filter((e) => e.status === "gepubliceerd").length} gepubliceerd)`);
if (!DRY_RUN) {
  fs.mkdirSync(path.dirname(SCRAPE_RUNS_PATH), { recursive: true });
  fs.writeFileSync(SCRAPE_RUNS_PATH, JSON.stringify({ runs }, null, 2) + "\n");
  console.log(`→ ${SCRAPE_RUNS_PATH} (${runs.length} runs)`);
}
```

- [x] **Step 2: Dry-run en echte run**

Run: `npx tsx scripts/backfill-runs.ts --dry-run`
Expected: een lijst van scraper-runs (er zijn er minstens 5: de `chore(scraper): wekelijkse run`-commits en de Facebook-postscrape van 27 aug) met event-aantallen; geen bestand geschreven.
Run: `npx tsx scripts/backfill-runs.ts && node -e 'const d=require("./data/scrape-runs.json");console.log(d.runs.length, d.runs.every(r=>r.backfill))'`
Expected: `<n> true`.

- [x] **Step 3: Loader-test tegen het echte bestand**

Run: `npx tsx -e 'import { getScrapeRuns, weekTrend } from "./src/lib/scrape-runs"; const r = getScrapeRuns(); console.log(r.length, weekTrend(r).map(p => p.gepubliceerd))'`
Expected: aantal runs en een array met aantallen (geen NaN, geen crash).

- [x] **Step 4: Commit (script + data)**

```bash
git add scripts/backfill-runs.ts data/scrape-runs.json
git commit -m "feat(beheer): backfill van run-records uit de scraper-commits"
```

---

### Task 9: Thematokens en beheer-componenten

**Files:**
- Modify: `src/app/globals.css` (in het `@theme`-blok)
- Create: `src/components/beheer/BeheerNav.tsx`, `RunKop.tsx`, `Tegels.tsx`, `KanaalKaart.tsx`, `ConceptTabel.tsx`, `FoutenLijst.tsx`, `Trend.tsx`

- [x] **Step 1: Tokens**

In `@theme`, na het *Stoom*-blok:
```css
  /* Beheer: kanaalkleuren (CVD-gevalideerd; aqua altijd met tekstlabel) en statuskleuren */
  --color-kanaal-website: #c1592a;
  --color-kanaal-facebook: #2a78d6;
  --color-kanaal-mail: #1baf7a;
  --color-ok: #2f7d46;
  --color-ok-tint: #e2f0e5;
  --color-warn: #a4690c;
  --color-warn-tint: #f6ead2;
  --color-bad: #b3402b;
  --color-bad-tint: #f7ddd6;
```

- [x] **Step 2: BeheerNav**

```tsx
// src/components/beheer/BeheerNav.tsx
import Link from "next/link";

/** Kop van de beheeromgeving: dashboard hier, bewerken in Keystatic. Geen site-chrome. */
export function BeheerNav({ actief }: { actief: "dashboard" }) {
  const item = (href: string, label: string, isActief: boolean) => (
    <Link
      href={href}
      className={
        isActief
          ? "rounded-full bg-ink px-3 py-1 text-sm font-medium text-cream"
          : "rounded-full px-3 py-1 text-sm font-medium text-ink-soft hover:bg-sand"
      }
    >
      {label}
    </Link>
  );
  return (
    <header className="flex items-center justify-between border-b border-sand pb-4">
      <div className="font-display text-lg text-ink">Opgietingen.nl · beheer</div>
      <nav className="flex gap-1">
        {item("/beheer", "Dashboard", actief === "dashboard")}
        {item("/keystatic", "Bewerken", false)}
      </nav>
    </header>
  );
}
```

- [x] **Step 3: RunKop en Tegels**

```tsx
// src/components/beheer/RunKop.tsx
import type { RunTotalen, ScrapeRun } from "@/lib/scrape-runs";

function formatRunTijd(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

export function RunKop({ run, totalen }: { run: ScrapeRun; totalen: RunTotalen }) {
  const duur = run.duurSeconden != null ? ` · ${Math.floor(run.duurSeconden / 60)}m ${run.duurSeconden % 60}s` : "";
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Laatste run · {formatRunTijd(run.id)}{duur} · autopublish {run.autopublish ? "aan" : "uit"}
        {run.backfill ? " · gereconstrueerd" : ""}
      </p>
      <h1 className="mt-1 font-display text-2xl font-medium text-ink text-balance">
        {totalen.kandidaten ?? "?"} kandidaten, {totalen.gepubliceerd} gepubliceerd, {totalen.concept} te beoordelen
      </h1>
      {run.fout && (
        <div className="mt-3 rounded-lg bg-bad-tint px-4 py-3 text-sm text-bad">
          Run zonder resultaten ({run.fout}).{" "}
          {run.workflowRun && (
            <a className="underline" href={`https://github.com/nathanielhitz/opgietingen/actions/runs/${run.workflowRun}`}>
              Bekijk de workflow
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/components/beheer/Tegels.tsx
import type { RunTotalen } from "@/lib/scrape-runs";

function Tegel({ n, label, detail, kleur }: { n: number | string; label: string; detail: string; kleur?: string }) {
  return (
    <div className="rounded-xl bg-cream px-4 py-3">
      <div className={`font-display text-3xl font-medium tabular-nums ${kleur ?? "text-ink"}`}>{n}</div>
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="text-xs text-ink-faint">{detail}</div>
    </div>
  );
}

export function Tegels({ t }: { t: RunTotalen }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tegel n={t.kandidaten ?? "?"} label="kandidaten" detail={`uit ${t.bronnen} bronnen`} />
      <Tegel n={t.gepubliceerd} label="gepubliceerd" detail="trefwoord in titel" kleur="text-ok" />
      <Tegel n={t.concept} label="concept" detail="handmatig beoordelen" kleur="text-warn" />
      <Tegel n={t.fouten} label="fouten" detail={`${t.dedup ?? "?"} dedup · ${t.verleden ?? "?"} verleden`} kleur="text-bad" />
    </div>
  );
}
```

- [x] **Step 4: KanaalKaart**

```tsx
// src/components/beheer/KanaalKaart.tsx
import { KANAAL_LABEL, type Kanaal, type Totalen } from "@/lib/scrape-runs";

const STIP: Record<Kanaal, string> = {
  website: "bg-kanaal-website",
  facebook: "bg-kanaal-facebook",
  mail: "bg-kanaal-mail",
};

/** Gestapeld staafje gepubliceerd–concept–dedup met de cijfers als tekst (kleur is nooit de enige drager). */
export function KanaalKaart({ kanaal, t, extra }: { kanaal: Kanaal; t: Totalen; extra?: string }) {
  const dedup = t.dedup ?? 0;
  const totaal = t.gepubliceerd + t.concept + dedup;
  const pct = (n: number) => (totaal ? `${(n / totaal) * 100}%` : "0%");
  return (
    <div className="rounded-xl border border-sand px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STIP[kanaal]}`} aria-hidden />
        {KANAAL_LABEL[kanaal]}
      </div>
      <div className="my-2 flex h-2 gap-0.5 overflow-hidden rounded bg-sand" aria-hidden>
        <span className="bg-ok" style={{ width: pct(t.gepubliceerd) }} />
        <span className="bg-warn" style={{ width: pct(t.concept) }} />
        <span className="bg-sand" style={{ width: pct(dedup) }} />
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-ink-soft tabular-nums">
        <span>{t.gepubliceerd} gepubliceerd</span>
        <span>{t.concept} concept</span>
        <span>{dedup} dedup</span>
        {extra && <span>{extra}</span>}
      </div>
    </div>
  );
}
```

- [x] **Step 5: ConceptTabel en FoutenLijst**

```tsx
// src/components/beheer/ConceptTabel.tsx
import type { RunEvent } from "@/lib/scrape-runs";

export interface ConceptRij extends RunEvent {
  saunaNaam: string;
}

export function ConceptTabel({ rijen }: { rijen: ConceptRij[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Te beoordelen ({rijen.length})</h2>
      {rijen.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Niets te beoordelen uit deze run.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-semibold">Event</th>
                <th className="py-2 pr-3 font-semibold">Sauna</th>
                <th className="py-2 pr-3 font-semibold">Reden</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => (
                <tr key={r.slug} className="border-t border-sand align-top">
                  <td className="py-2 pr-3 font-medium text-ink">{r.slug}</td>
                  <td className="py-2 pr-3 text-ink-soft">{r.saunaNaam}</td>
                  <td className="py-2 pr-3 text-ink-soft">{r.reden ?? "—"}</td>
                  <td className="py-2 text-right">
                    <a
                      className="font-medium text-ember underline underline-offset-2"
                      href={`/keystatic/collection/events/item/${r.slug}`}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

```tsx
// src/components/beheer/FoutenLijst.tsx
import { KANAAL_LABEL, type BronStatusWijziging, type Kanaal } from "@/lib/scrape-runs";

export interface FoutRij {
  bronId: string;
  bronNaam: string;
  kanaal: Kanaal | "verify";
  melding: string;
  ernst: "bad" | "warn";
}

export function naarFoutRijen(
  bronfouten: { kanaal: Kanaal; id: string; fout: string }[],
  wijzigingen: BronStatusWijziging[],
  naamVan: (id: string) => string,
): FoutRij[] {
  return [
    ...bronfouten.map((b) => ({ bronId: b.id, bronNaam: naamVan(b.id), kanaal: b.kanaal, melding: b.fout, ernst: "bad" as const })),
    ...wijzigingen.map((w) => ({
      bronId: w.id, bronNaam: naamVan(w.id), kanaal: "verify" as const,
      melding: `${w.van} → ${w.naar}: ${w.notitie}`, ernst: w.naar === "kapot" ? ("bad" as const) : ("warn" as const),
    })),
  ];
}

export function FoutenLijst({ rijen }: { rijen: FoutRij[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Fouten ({rijen.length})</h2>
      {rijen.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Geen bronfouten of statuswijzigingen.</p>
      ) : (
        <ul className="mt-2 divide-y divide-sand text-sm">
          {rijen.map((r, i) => (
            <li key={`${r.bronId}-${i}`} className="flex flex-wrap items-center gap-3 py-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.ernst === "bad" ? "bg-bad-tint text-bad" : "bg-warn-tint text-warn"}`}>
                {r.kanaal === "verify" ? "bron" : KANAAL_LABEL[r.kanaal]}
              </span>
              <span className="font-medium text-ink">{r.bronNaam}</span>
              <span className="text-ink-soft">{r.melding}</span>
              <a className="ml-auto font-medium text-ember underline underline-offset-2" href="/keystatic/singleton/bronnen">
                Bron
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [x] **Step 6: Trend**

```tsx
// src/components/beheer/Trend.tsx
import type { TrendPunt } from "@/lib/scrape-runs";

/** Gepubliceerd per run als CSS-staafjes; backfill gedempt. Context, geen hoofdvraag — daarom klein. */
export function Trend({ punten }: { punten: TrendPunt[] }) {
  const max = Math.max(1, ...punten.map((p) => p.gepubliceerd + p.concept));
  const datum = (iso: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Per run · laatste {punten.length} (gepubliceerd donker, concept licht)
      </h2>
      <div className="mt-2 flex h-14 items-end gap-1" role="img" aria-label="Aantal events per run">
        {punten.map((p) => (
          <div
            key={p.id}
            className={`flex flex-1 flex-col justify-end rounded-t ${p.backfill ? "opacity-50" : ""}`}
            style={{ height: "100%" }}
            title={`${datum(p.id)}: ${p.gepubliceerd} gepubliceerd, ${p.concept} concept${p.backfill ? " (gereconstrueerd)" : ""}`}
          >
            <div className="rounded-t bg-warn-tint" style={{ height: `${(p.concept / max) * 100}%` }} />
            <div className="bg-ok" style={{ height: `${(p.gepubliceerd / max) * 100}%` }} />
          </div>
        ))}
      </div>
      {punten.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
          <span>{datum(punten[0].id)}</span>
          <span>{datum(punten[punten.length - 1].id)}</span>
        </div>
      )}
    </section>
  );
}
```

- [x] **Step 7: Typecheck en commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: schoon.
```bash
git add src/app/globals.css src/components/beheer
git commit -m "feat(beheer): tokens en componenten voor het dashboard"
```

---

### Task 10: Route `/beheer`, robots en test

**Files:**
- Create: `src/app/beheer/layout.tsx`, `src/app/beheer/page.tsx`
- Modify: `src/app/robots.ts`, `scripts/lib/beheer-routes.test.ts`

- [x] **Step 1: Test uitbreiden (falend)**

In `scripts/lib/beheer-routes.test.ts`, in de robots-test na de `/api/keystatic`-assert:
```ts
  assert.ok(disallow.includes("/beheer"), "/beheer ontbreekt in disallow");
```
En in de sitemap-test de filter uitbreiden: `u.includes("/keystatic") || u.includes("/api/") || u.includes("/beheer")`.

Run: `node --import tsx --test scripts/lib/beheer-routes.test.ts` → robots-test FAIL met "/beheer ontbreekt in disallow".

- [x] **Step 2: robots.ts**

`disallow: ["/uit/", "/keystatic", "/api/keystatic", "/beheer"],` en de comment: `// Affiliate-redirects, het beheerpaneel en het beheer-dashboard niet crawlen/indexeren.`

Run de test opnieuw → 2 `ok`.

- [x] **Step 3: Layout**

```tsx
// src/app/beheer/layout.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { beheerBeschikbaar } from "@/lib/beheer";

// Beheer-dashboard: geen site-chrome, nooit indexeren (ook in robots.ts uitgesloten);
// in productie alleen beschikbaar als het beheerpaneel dat ook is (GitHub App).
export const metadata: Metadata = {
  title: { absolute: "Beheer" },
  description: null,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function BeheerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!beheerBeschikbaar()) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</div>;
}
```

- [x] **Step 4: Pagina**

```tsx
// src/app/beheer/page.tsx
import { getSaunaBySlug } from "@/lib/content";
import { getLaatsteRun, getScrapeRuns, runTotalen, weekTrend, KANALEN } from "@/lib/scrape-runs";
import { BeheerNav } from "@/components/beheer/BeheerNav";
import { RunKop } from "@/components/beheer/RunKop";
import { Tegels } from "@/components/beheer/Tegels";
import { KanaalKaart } from "@/components/beheer/KanaalKaart";
import { ConceptTabel } from "@/components/beheer/ConceptTabel";
import { FoutenLijst, naarFoutRijen } from "@/components/beheer/FoutenLijst";
import { Trend } from "@/components/beheer/Trend";

/*
  Dashboard van de wekelijkse scrape: wat leverde de laatste run op en wat is
  er te doen. Leest data/scrape-runs.json via de loader; statisch gebouwd —
  elke run commit een nieuw record en Vercel deployt.
*/
export default function BeheerPagina() {
  const runs = getScrapeRuns();
  const run = getLaatsteRun();

  if (!run) {
    return (
      <>
        <BeheerNav actief="dashboard" />
        <p className="mt-8 text-ink-soft">Nog geen runs; de eerste komt maandag na de scrape-workflow.</p>
      </>
    );
  }

  const totalen = runTotalen(run);
  const naamVan = (id: string) => getSaunaBySlug(id)?.naam ?? id;
  const concepts = run.events
    .filter((e) => e.status === "concept")
    .map((e) => ({ ...e, saunaNaam: naamVan(e.bron) }));
  const bronfouten = KANALEN.flatMap((k) =>
    run.kanalen[k].bronnen.filter((b) => b.fout).map((b) => ({ kanaal: k, id: b.id, fout: b.fout as string })),
  );
  const fouten = naarFoutRijen(bronfouten, run.bronnen.statusWijzigingen, naamVan);

  return (
    <>
      <BeheerNav actief="dashboard" />
      <div className="mt-8 flex flex-col gap-8">
        <RunKop run={run} totalen={totalen} />
        <Tegels t={totalen} />
        <div className="grid gap-3 sm:grid-cols-3">
          <KanaalKaart kanaal="website" t={totalen.perKanaal.website} />
          <KanaalKaart kanaal="facebook" t={totalen.perKanaal.facebook} />
          <KanaalKaart
            kanaal="mail"
            t={totalen.perKanaal.mail}
            extra={`${run.kanalen.mail.mails} mails · ${run.kanalen.mail.onbekendeAfzenders} onbekend`}
          />
        </div>
        <ConceptTabel rijen={concepts} />
        <FoutenLijst rijen={fouten} />
        <Trend punten={weekTrend(runs, 12)} />
      </div>
    </>
  );
}
```

- [x] **Step 5: Build en bekijken**

Run: `npm run build`
Expected: slaagt; route `/beheer` staat in de lijst als statisch (○). Daarna `npm run dev`, open `http://127.0.0.1:3000/beheer`.
Expected: nav, kop met de laatste (backfill-)run "gereconstrueerd", tegels met `?` voor kandidaten (backfill), concept-tabel met *Open*-links, trend met gedempte kolommen. Klik één *Open*-link: Keystatic opent het event. Controleer ook: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/beheer` → 200 en de HTML bevat `noindex`. Stop de dev-server.

- [x] **Step 6: Lege toestand**

Run: `mv data/scrape-runs.json /tmp/sr.json && npm run build 2>&1 | grep -E "beheer|error" ; mv /tmp/sr.json data/scrape-runs.json`
Expected: build slaagt zonder het bestand (pagina toont "Nog geen runs").

- [x] **Step 7: Lint, tests, commit**

Run: `npm run lint && npm test` → schoon; alle tests groen.
```bash
git add src/app/beheer src/app/robots.ts scripts/lib/beheer-routes.test.ts
git commit -m "feat(beheer): dashboard /beheer met laatste run, concepts, fouten en trend"
```

---

### Task 11: Integratieproef en documentatie

**Files:**
- Modify: `CLAUDE.md`

- [x] **Step 1: Integratieproef van het schrijfpad (lokaal, zonder API-keys)**

Simuleer een run met metrics-bestand en verwerk het:
```bash
cat > scrape-metrics.json <<'EOF'
{ "verify": { "gecontroleerd": 3 }, "bronStatusWijzigingen": [], "events": [
  { "slug": "asanti-nationale-saunaweek-asanti-2026-09-14", "kanaal": "website", "bron": "asanti", "status": "concept", "reden": "proef" } ],
  "bronResultaten": [ { "id": "asanti", "kanaal": "website", "kandidaten": 1, "dedup": 0, "verleden": 0, "afgekeurd": 0, "concept": 1, "gepubliceerd": 0, "fout": null, "methode": "statisch" } ] }
EOF
RUN_GESTART=2026-08-30T12:00:00Z npm run run-record
```
Expected: `Run-record 2026-08-30T12:00:00Z weggeschreven (<n> runs). 1 kandidaten, 0 gepubliceerd, 1 concept`; `scrape-metrics.json` is verwijderd. Open `/beheer` in de dev-server: de proef-run is de laatste, met Asanti in "Te beoordelen" en een werkende *Open*-link. Verwijder de proef daarna: `git checkout data/scrape-runs.json`.

- [x] **Step 2: CLAUDE.md**

In *Projectstructuur* onder `data/`: regel toevoegen `  scrape-runs.json  # run-metrics van de wekelijkse scrape (gecommit door de workflow; bron voor /beheer)`. Onder `scripts/`: `  run-record.ts     # vouwt scrape-metrics.json tot een run-record in data/scrape-runs.json` en `  backfill-runs.ts  # eenmalig: run-records uit de scraper-commits reconstrueren`. Onder `src/lib/`: `    scrape-runs.ts  # loader + helpers voor run-metrics (enige plek die data/scrape-runs.json kent)`.

In de tabel *Routes*: `| /beheer | Beheer-dashboard: laatste scrape-run, te beoordelen concepts (→ Keystatic), fouten, trend; noindex |`.

In de sectie *Content-scraper (pipeline)*, na de alinea over **Automatisering**, een alinea:
```markdown
**Run-metrics (`npm run run-record`)** — `verify-bronnen` en de drie scrapers melden via `scripts/lib/metrics.ts` per bron zeven tellers (kandidaten, dedup, verleden, afgekeurd, concept, gepubliceerd + `fout`/`methode`), elk weggeschreven event en de bronnen-statuswijzigingen aan een tijdelijk `scrape-metrics.json`. Alles in try/catch: een metrics-fout mag nooit een scrape laten falen; `--dry-run` schrijft niets. Na de run vouwt `run-record` dat tot één record in `data/scrape-runs.json` (idempotent op de starttijd `RUN_GESTART`), de workflow commit het mee met een samenvattend bericht — dus elke week een commit, ook bij 0 events. `/beheer` leest het bestand via `src/lib/scrape-runs.ts`. Oude runs zijn met `scripts/backfill-runs.ts` uit de git-historie gereconstrueerd (`backfill: true`, alleen events). Spec: [docs/superpowers/specs/2026-08-30-beheer-dashboard-scrape-metrics-design.md](docs/superpowers/specs/2026-08-30-beheer-dashboard-scrape-metrics-design.md).
```

In *Commando's*: `npm run run-record   # vouw scrape-metrics.json tot een run-record (workflow-stap; -- --dry-run toont het record)`.

In de sectie *Beheer (Keystatic)* de eerste zin aanvullen: "… en `/beheer` is het dashboard van de wekelijkse scrape (zie *Run-metrics*)."

- [x] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: run-metrics en /beheer-dashboard gedocumenteerd"
```

- [ ] **Step 4: Acceptatie (na de eerstvolgende maandag-run, door Nathaniel)**

Na de run van maandag 06:00 UTC: `git pull`; het laatste commit-bericht is `chore(scraper): run <dd-mm> — <n> kandidaten, …`; `data/scrape-runs.json` heeft een record met `backfill: false` en gevulde tellers; `opgietingen.nl/beheer` toont die run en de *Open*-links werken. Vink dan dit vakje af en commit het plan.

---

## Self-review

- **Spec-dekking:** §3 datamodel → Task 1 typen + Task 6 record; §4 schrijfpad → Tasks 2–7 (metrics, drie scrapers, verify, run-record, workflow) + backfill Task 8; §5 loader/pagina/lege toestanden/robots → Tasks 1, 9, 10; §6 visueel/tokens/componenten → Task 9; §7 tests → Tasks 1, 2, 6, 10 + dry-run-checks in 3–5 + integratieproef 11; §9 risico → try/catch + tests in Task 2.
- **Placeholders:** geen; elke stap heeft code of een exact commando met verwachting.
- **Type-consistentie:** `BronResultaat`, `RunEvent`, `ScrapeRun`, `Kanaal`, `Methode`, `KANALEN`, `KANAAL_LABEL`, `runTotalen`, `weekTrend`, `leesScrapeRuns`, `SCRAPE_RUNS_PATH` komen uit Task 1 en worden in 2, 6, 8, 9, 10 met dezelfde namen gebruikt; `maakMetrics`/`legeTeller`/`naarMethode`/`leesMetrics`/`METRICS_BESTAND` uit Task 2 in 3–6; `bouwRunRecord`/`voegRunToe`/`samenvatting` uit Task 6 in 8. De invariant `kandidaten = dedup + verleden + concept + gepubliceerd` wordt in alle drie de scrapers gerespecteerd doordat "bestand bestaat al" als dedup telt.
- **Bekende afwijking van de spec:** de spec noemde `meldBronResultaat`/`meldEvent`-functies; het plan gebruikt een `maakMetrics({ actief })`-object zodat dry-run centraal een no-op is in plaats van `if (!DRY_RUN)` op elke aanroepplek. Zelfde gedrag, minder foutkans.
