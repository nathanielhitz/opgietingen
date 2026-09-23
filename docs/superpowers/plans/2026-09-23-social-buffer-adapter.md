# Buffer-adapter (automatisch inplannen van social-posts) — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een script plus wekelijkse GitHub-workflow die de weekplanning van opgietingen.nl leest en elke post via de Buffer-API ingepland in de wachtrij van Facebook, Instagram en TikTok zet, zonder handmatige stap.

**Architecture:** Alles wat publiceert is consument van het bestaande `/social/planning`-contract. Nieuw zijn drie lagen: een dunne GraphQL-client voor Buffer (`scripts/lib/buffer-client.ts`), pure mapping-/selectiefuncties (`scripts/lib/social-buffer.ts`) en een grootboek in de repo tegen dubbele posts (`src/lib/social-buffer-log.ts`, bestand `data/social-buffer.json`). Het CLI-script `scripts/social-buffer.ts` is de dunne schil; `.github/workflows/social.yml` draait het elke maandag en commit het grootboek. De planning krijgt één extra veld (`commit`) voor een versheidscheck.

**Tech Stack:** TypeScript (strict), Node 22, `tsx`, `node:test`, Next.js 15 route-handler (alleen voor het `commit`-veld), Buffer GraphQL-API (`https://api.buffer.com`), GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md](../specs/2026-09-23-social-buffer-adapter-design.md)

**Werkplek:** worktree `/Users/nathaniel/Documents/Opgieting.nl-social-buffer`, branch `feat/social-buffer-adapter` (basis `origin/main`). Gebruik overal absolute paden en controleer vóór elke commit `git branch --show-current` (een andere sessie kan in de hoofdcheckout werken). Dependencies staan al geïnstalleerd (`npm ci` is gedaan).

**Conventies die overal gelden:** Nederlands in code-comments, commit messages en UI-tekst; geen em-streepjes in zichtbare tekst; tests met `node:test` + `node:assert/strict` in `scripts/lib/*.test.ts`; `npm test` draait alles. Scripts importeren `src/lib` via relatieve paden (`../../src/lib/...`), `src/lib`-bestanden onderling via `@/lib/...`.

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `src/lib/dates.ts` | wijzigen | `nlTijdNaarUtc`: NL-datum + "HH:MM" naar UTC-ISO, zomer-/wintertijd via `Intl` |
| `scripts/lib/dates-social.test.ts` | wijzigen | tests voor `nlTijdNaarUtc` |
| `src/lib/social-planning.ts` | wijzigen | veld `commit` in het contract |
| `src/app/social/planning/route.ts` | wijzigen | `VERCEL_GIT_COMMIT_SHA` doorgeven |
| `scripts/lib/social-planning.test.ts` | wijzigen | tests voor `commit` |
| `src/lib/social-buffer-log.ts` | nieuw | grootboek: typen, lezen, schrijven, zoeken, toevoegen |
| `scripts/lib/social-buffer-log.test.ts` | nieuw | tests grootboek |
| `scripts/lib/buffer-client.ts` | nieuw | GraphQL-aanroepen naar Buffer met injecteerbare fetch |
| `scripts/lib/buffer-client.test.ts` | nieuw | tests client (gemockte fetch) |
| `scripts/lib/social-buffer.ts` | nieuw | pure functies: selectie, `dueAt`, mapping per kanaal, kanaalontdekking, versheidscheck, tabel |
| `scripts/lib/social-buffer.test.ts` | nieuw | tests pure functies |
| `scripts/social-buffer.ts` | nieuw | CLI: flags, planning ophalen, flow, grootboek, samenvatting |
| `package.json` | wijzigen | script `social-buffer` |
| `.env.example` | wijzigen | Buffer-variabelen |
| `.github/workflows/social.yml` | nieuw | maandag 07:30 UTC + dispatch; commit grootboek |
| `CLAUDE.md` | wijzigen | structuur, social-kit-paragraaf, commando's, env |
| `docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md` | wijzigen | §7 verwijst naar de nieuwe spec |
| `docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md` | wijzigen | §12: grootboek-helpers staan in `social-buffer-log.ts` |

---

### Task 1: `nlTijdNaarUtc` in `src/lib/dates.ts`

**Files:**
- Modify: `src/lib/dates.ts` (onderaan toevoegen, na `isGeldigeIsoDatum`)
- Test: `scripts/lib/dates-social.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Voeg `nlTijdNaarUtc` toe aan de import bovenin `scripts/lib/dates-social.test.ts`:

```ts
import {
  isoWeek,
  weekendVanIsoWeek,
  volgendeWeekdag,
  eersteVanMaandIn,
  formatDagKort,
  isGeldigeIsoDatum,
  nlTijdNaarUtc,
} from "../../src/lib/dates";
```

En voeg onderaan het bestand toe:

```ts
test("nlTijdNaarUtc: zomertijd (CEST, +02:00)", () => {
  assert.equal(nlTijdNaarUtc("2026-10-02", "12:00"), "2026-10-02T10:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2026-09-28", "17:00"), "2026-09-28T15:00:00.000Z");
});

test("nlTijdNaarUtc: wintertijd (CET, +01:00), ook over de jaargrens", () => {
  assert.equal(nlTijdNaarUtc("2026-11-02", "17:00"), "2026-11-02T16:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2026-12-31", "10:00"), "2026-12-31T09:00:00.000Z");
  assert.equal(nlTijdNaarUtc("2027-01-01", "10:00"), "2027-01-01T09:00:00.000Z");
});

test("nlTijdNaarUtc: ongeldige datum of tijd gooit", () => {
  assert.throws(() => nlTijdNaarUtc("2026-13-01", "12:00"), /Ongeldige datum\/tijd/);
  assert.throws(() => nlTijdNaarUtc("2026-10-02", "12.00"), /Ongeldige datum\/tijd/);
  assert.throws(() => nlTijdNaarUtc("2026-10-02", "25:00"), /Ongeldige datum\/tijd/);
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/dates-social.test.ts`
Expected: FAIL, de module exporteert `nlTijdNaarUtc` niet (`TypeError: ... is not a function` of een import-fout).

- [ ] **Step 3: Implementeer**

Voeg onderaan `src/lib/dates.ts` toe:

```ts
/* ---------- NL-tijd naar UTC (Buffer-adapter) ---------- */

/** Offset van Europe/Amsterdam op een moment, in minuten (+120 zomer, +60 winter). */
function amsterdamOffsetMinuten(moment: Date): number {
  const naam =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", timeZoneName: "longOffset" })
      .formatToParts(moment)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = naam.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Zet een NL-datum plus "HH:MM" (Europe/Amsterdam) om naar een UTC-ISO-string,
 * zomer- en wintertijd via Intl (geen tijdzonebibliotheek). De offset wordt
 * bepaald op het gokmoment "datum+tijd als UTC"; dat is alleen fout in het
 * omschakeluur (02:00-03:00 's nachts), waar de adapter nooit plant.
 */
export function nlTijdNaarUtc(datum: string, tijd: string): string {
  const m = tijd.match(/^(\d{2}):(\d{2})$/);
  const uur = m ? Number(m[1]) : NaN;
  const minuut = m ? Number(m[2]) : NaN;
  if (!isGeldigeIsoDatum(datum) || !m || uur > 23 || minuut > 59) {
    throw new Error(`Ongeldige datum/tijd: ${datum} ${tijd}`);
  }
  const [j, ma, d] = datum.split("-").map(Number);
  const gok = Date.UTC(j, ma - 1, d, uur, minuut);
  return new Date(gok - amsterdamOffsetMinuten(new Date(gok)) * 60_000).toISOString();
}
```

- [ ] **Step 4: Draai de tests**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/dates-social.test.ts`
Expected: PASS, alle tests in het bestand groen.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add src/lib/dates.ts scripts/lib/dates-social.test.ts && git commit -m "feat(dates): nlTijdNaarUtc zet NL-datum en tijd om naar UTC met zomer- en wintertijd

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Veld `commit` in de planning-JSON

**Files:**
- Modify: `src/lib/social-planning.ts`
- Modify: `src/app/social/planning/route.ts`
- Test: `scripts/lib/social-planning.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Voeg onderaan `scripts/lib/social-planning.test.ts` toe:

```ts
test("bouwPlanning: commit is null als er geen deploy-hash is, anders de hash", () => {
  assert.equal(bouwPlanning([], "2026-09-28", "https://opgietingen.nl").commit, null);
  assert.equal(bouwPlanning([], "2026-09-28", "https://opgietingen.nl", "abc1234").commit, "abc1234");
});

test("planningAntwoord: geeft de commit-hash van de deploy door (versheidscheck Buffer-adapter)", () => {
  const met = planningAntwoord({ datumParam: "2026-09-28", origin: "http://localhost:3000", events: [], vandaag: "2026-09-28", commit: "abc1234" });
  assert.ok("commit" in met.body && met.body.commit === "abc1234");
  const zonder = planningAntwoord({ datumParam: "2026-09-28", origin: "http://localhost:3000", events: [], vandaag: "2026-09-28" });
  assert.ok("commit" in zonder.body && zonder.body.commit === null);
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-planning.test.ts`
Expected: FAIL op de twee nieuwe tests (`commit` is `undefined`).

- [ ] **Step 3: Implementeer in `src/lib/social-planning.ts`**

Pas de interface en `bouwPlanning` aan:

```ts
export interface PlanningJson {
  datum: string;
  /** Oorsprong waarop de slide-URL's zijn gebouwd. */
  basis: string;
  /**
   * Commit-hash van de deploy die deze planning maakte (Vercel), null lokaal.
   * De Buffer-adapter vergelijkt hem met de commit op de runner (versheidscheck).
   */
  commit: string | null;
  posts: PlanningPost[];
}

export function bouwPlanning(events: OpgietEvent[], datum: string, basis: string, commit: string | null = null): PlanningJson {
  const oorsprong = basis.replace(/\/$/, "");
  const posts = bouwPosts(events, datum).map((post) => {
    // Record<Kanaal, string> dwingt af dat elk kanaal een caption krijgt (compile-time check).
    const captions: Record<Kanaal, string> = {
      instagram: bouwCaption(post, "instagram"),
      facebook: bouwCaption(post, "facebook"),
      tiktok: bouwCaption(post, "tiktok"),
    };
    return {
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
      captions,
    };
  });
  return { datum, basis: oorsprong, commit, posts };
}
```

(Alleen de signatuur en de `return`-regel veranderen; de body van de `map` is de bestaande code.)

Pas `planningAntwoord` aan: voeg `commit?: string | null` toe aan de opties en geef hem door:

```ts
export function planningAntwoord(opties: {
  datumParam: string | null;
  origin: string;
  events: OpgietEvent[];
  vandaag: string;
  vercelEnv?: string;
  /** VERCEL_GIT_COMMIT_SHA van de draaiende deploy; lokaal weglaten. */
  commit?: string | null;
}): PlanningAntwoord {
  const datum = opties.datumParam ?? opties.vandaag;
  const headers = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };
  if (!isGeldigeIsoDatum(datum)) {
    return { status: 400, body: { fout: `Ongeldige datum "${datum}", verwacht YYYY-MM-DD` }, headers };
  }
  const basis = opties.vercelEnv === "production" ? site.url : opties.origin;
  return { status: 200, body: bouwPlanning(opties.events, datum, basis, opties.commit ?? null), headers };
}
```

- [ ] **Step 4: Geef de hash door in de route**

In `src/app/social/planning/route.ts`:

```ts
export async function GET(request: NextRequest) {
  const antwoord = planningAntwoord({
    datumParam: request.nextUrl.searchParams.get("datum"),
    origin: request.nextUrl.origin,
    events: getAllEvents(),
    vandaag: todayISO(),
    vercelEnv: process.env.VERCEL_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
  return Response.json(antwoord.body, { status: antwoord.status, headers: antwoord.headers });
}
```

- [ ] **Step 5: Draai de tests en de typecheck**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-planning.test.ts && npx tsc --noEmit`
Expected: PASS; `tsc` zonder fouten (niets anders construeert een `PlanningJson`; `social-kit.ts` cast alleen).

- [ ] **Step 6: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add src/lib/social-planning.ts src/app/social/planning/route.ts scripts/lib/social-planning.test.ts && git commit -m "feat(social): commit-hash van de deploy in de planning-JSON voor de versheidscheck

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Grootboek `src/lib/social-buffer-log.ts`

**Files:**
- Create: `src/lib/social-buffer-log.ts`
- Test: `scripts/lib/social-buffer-log.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Maak `scripts/lib/social-buffer-log.test.ts`:

```ts
// scripts/lib/social-buffer-log.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { leesGrootboek, schrijfGrootboek, voegRegelToe, zoekRegel, type GrootboekRegel } from "../../src/lib/social-buffer-log";

const regel: GrootboekRegel = {
  post: "weekend-2026-W40",
  kanaal: "facebook",
  bufferId: "68d2abc",
  dueAt: "2026-10-02T10:00:00.000Z",
  aangemaakt: "2026-09-28T07:31:12.000Z",
  run: "1234567890",
};

function tmpBestand(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "social-buffer-log-")), "social-buffer.json");
}

test("leesGrootboek: ontbrekend bestand is een leeg grootboek", () => {
  assert.deepEqual(leesGrootboek(tmpBestand()), { posts: [] });
});

test("schrijfGrootboek + leesGrootboek: round-trip, bestand eindigt op een newline", () => {
  const bestand = tmpBestand();
  schrijfGrootboek({ posts: [regel] }, bestand);
  assert.deepEqual(leesGrootboek(bestand), { posts: [regel] });
  assert.ok(fs.readFileSync(bestand, "utf8").endsWith("}\n"));
});

test("leesGrootboek: onleesbaar of ongeldig bestand gooit (nooit stilzwijgend overschrijven)", () => {
  const kapot = tmpBestand();
  fs.writeFileSync(kapot, "{ dit is geen json");
  assert.throws(() => leesGrootboek(kapot));
  const zonderLijst = tmpBestand();
  fs.writeFileSync(zonderLijst, JSON.stringify({ posts: "nee" }));
  assert.throws(() => leesGrootboek(zonderLijst), /geen posts-lijst/);
  const ongeldigeRegel = tmpBestand();
  fs.writeFileSync(ongeldigeRegel, JSON.stringify({ posts: [{ post: "x" }] }));
  assert.throws(() => leesGrootboek(ongeldigeRegel), /regel 0 is ongeldig/);
});

test("zoekRegel: vindt op post-id én kanaal", () => {
  const grootboek = { posts: [regel] };
  assert.equal(zoekRegel(grootboek, "weekend-2026-W40", "facebook")?.bufferId, "68d2abc");
  assert.equal(zoekRegel(grootboek, "weekend-2026-W40", "instagram"), undefined);
  assert.equal(zoekRegel(grootboek, "nieuw-2026-W40", "facebook"), undefined);
});

test("voegRegelToe: geen mutatie, geen dubbele combinatie", () => {
  const leeg = { posts: [] as GrootboekRegel[] };
  const een = voegRegelToe(leeg, regel);
  assert.equal(leeg.posts.length, 0, "origineel ongewijzigd");
  assert.equal(een.posts.length, 1);
  const nogEens = voegRegelToe(een, { ...regel, bufferId: "anders" });
  assert.equal(nogEens.posts.length, 1, "bestaande combinatie wint");
  assert.equal(nogEens.posts[0].bufferId, "68d2abc");
  const anderKanaal = voegRegelToe(een, { ...regel, kanaal: "tiktok" });
  assert.equal(anderKanaal.posts.length, 2);
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-buffer-log.test.ts`
Expected: FAIL, module niet gevonden.

- [ ] **Step 3: Implementeer**

Maak `src/lib/social-buffer-log.ts`:

```ts
// src/lib/social-buffer-log.ts
import fs from "node:fs";
import path from "node:path";
import type { Kanaal } from "@/lib/social";

/*
  Grootboek van de Buffer-adapter (data/social-buffer.json): welke planning-post
  op welk kanaal al in Buffer staat. Dit is de enige plek die het bestand kent,
  zodat /beheer het later kan tonen zonder de adapter te raken. Spec:
  docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md §7.
*/

export interface GrootboekRegel {
  /** Post-id uit de planning, bv. weekend-2026-W40. */
  post: string;
  kanaal: Kanaal;
  /** Id van de post in Buffer. */
  bufferId: string;
  /** Ingepland tijdstip, UTC-ISO. */
  dueAt: string;
  /** Moment van de createPost-aanroep, UTC-ISO. */
  aangemaakt: string;
  /** GITHUB_RUN_ID of "lokaal". */
  run: string;
}

export interface Grootboek {
  posts: GrootboekRegel[];
}

export const SOCIAL_BUFFER_LOG_PATH = path.join(process.cwd(), "data", "social-buffer.json");

const KANALEN_SET: ReadonlySet<string> = new Set<Kanaal>(["instagram", "facebook", "tiktok"]);

function isRegel(x: unknown): x is GrootboekRegel {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.post === "string" &&
    typeof r.kanaal === "string" &&
    KANALEN_SET.has(r.kanaal) &&
    typeof r.bufferId === "string" &&
    typeof r.dueAt === "string" &&
    typeof r.aangemaakt === "string" &&
    typeof r.run === "string"
  );
}

/**
 * Leest het grootboek. Ontbrekend bestand = leeg grootboek. Onleesbaar of
 * ongeldig = fout: doorgaan zou elke post opnieuw aanmaken, en overschrijven
 * zou de historie wissen. Herstel met `git checkout data/social-buffer.json`.
 */
export function leesGrootboek(bestand: string = SOCIAL_BUFFER_LOG_PATH): Grootboek {
  if (!fs.existsSync(bestand)) return { posts: [] };
  const data = JSON.parse(fs.readFileSync(bestand, "utf8")) as { posts?: unknown };
  if (!Array.isArray(data.posts)) throw new Error(`${bestand}: geen posts-lijst`);
  const ongeldig = data.posts.findIndex((r) => !isRegel(r));
  if (ongeldig !== -1) throw new Error(`${bestand}: regel ${ongeldig} is ongeldig`);
  return { posts: data.posts as GrootboekRegel[] };
}

export function schrijfGrootboek(grootboek: Grootboek, bestand: string = SOCIAL_BUFFER_LOG_PATH): void {
  fs.mkdirSync(path.dirname(bestand), { recursive: true });
  fs.writeFileSync(bestand, JSON.stringify(grootboek, null, 2) + "\n");
}

/** De regel voor een post-id op een kanaal, of undefined. */
export function zoekRegel(grootboek: Grootboek, post: string, kanaal: Kanaal): GrootboekRegel | undefined {
  return grootboek.posts.find((r) => r.post === post && r.kanaal === kanaal);
}

/** Nieuw grootboek met de regel erbij (geen mutatie); een bestaande combinatie blijft staan. */
export function voegRegelToe(grootboek: Grootboek, regel: GrootboekRegel): Grootboek {
  if (zoekRegel(grootboek, regel.post, regel.kanaal)) return grootboek;
  return { posts: [...grootboek.posts, regel] };
}
```

- [ ] **Step 4: Draai de tests**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-buffer-log.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add src/lib/social-buffer-log.ts scripts/lib/social-buffer-log.test.ts && git commit -m "feat(social): grootboek van in Buffer geplaatste posts (data/social-buffer.json)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Buffer-client `scripts/lib/buffer-client.ts`

**Files:**
- Create: `scripts/lib/buffer-client.ts`
- Test: `scripts/lib/buffer-client.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Maak `scripts/lib/buffer-client.test.ts`:

```ts
// scripts/lib/buffer-client.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUFFER_API_URL, BufferFout, maakBufferClient, type BufferPostInput, type Ophalen } from "./buffer-client";

interface Aanroep { url: string; init: RequestInit; body: { query: string; variables?: Record<string, unknown> } }

/** Mock-fetch die elke aanroep vastlegt en het opgegeven antwoord teruggeeft. */
function mock(antwoord: unknown, status = 200): { ophalen: Ophalen; aanroepen: Aanroep[] } {
  const aanroepen: Aanroep[] = [];
  const ophalen: Ophalen = async (url, init) => {
    aanroepen.push({ url, init, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(antwoord), { status, headers: { "Content-Type": "application/json" } });
  };
  return { ophalen, aanroepen };
}

const input: BufferPostInput = {
  channelId: "ch_fb",
  text: "Tekst",
  assets: [{ image: { url: "https://opgietingen.nl/social/afsluiter?formaat=feed" } }],
  schedulingType: "automatic",
  mode: "customScheduled",
  needsApproval: false,
  dueAt: "2026-10-02T10:00:00.000Z",
};

test("organisaties: POST naar api.buffer.com met Bearer-header en JSON-body", async () => {
  const { ophalen, aanroepen } = mock({ data: { account: { organizations: [{ id: "org1", name: "Opgietingen" }] } } });
  const client = maakBufferClient("sleutel-123", ophalen);
  const orgs = await client.organisaties();
  assert.deepEqual(orgs, [{ id: "org1", name: "Opgietingen" }]);
  assert.equal(aanroepen.length, 1);
  assert.equal(aanroepen[0].url, BUFFER_API_URL);
  assert.equal(aanroepen[0].init.method, "POST");
  const headers = aanroepen[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sleutel-123");
  assert.equal(headers["Content-Type"], "application/json");
  assert.match(aanroepen[0].body.query, /organizations/);
});

test("kanalen: organisatie-id in de query, service en id terug", async () => {
  const { ophalen, aanroepen } = mock({ data: { channels: [{ id: "ch_fb", name: "Opgietingen.nl", service: "facebook" }] } });
  const kanalen = await maakBufferClient("k", ophalen).kanalen("org1");
  assert.deepEqual(kanalen, [{ id: "ch_fb", name: "Opgietingen.nl", service: "facebook" }]);
  assert.match(aanroepen[0].body.query, /organizationId: "org1"/);
});

test("maakPost: input als variabele, id en dueAt terug bij PostActionSuccess", async () => {
  const { ophalen, aanroepen } = mock({ data: { createPost: { post: { id: "post_1", dueAt: "2026-10-02T10:00:00.000Z" } } } });
  const post = await maakBufferClient("k", ophalen).maakPost(input);
  assert.deepEqual(post, { id: "post_1", dueAt: "2026-10-02T10:00:00.000Z" });
  assert.deepEqual(aanroepen[0].body.variables, { input });
  assert.match(aanroepen[0].body.query, /createPost\(input: \$input\)/);
  assert.match(aanroepen[0].body.query, /PostActionSuccess/);
  assert.match(aanroepen[0].body.query, /MutationError/);
});

test("maakPost: MutationError wordt een BufferFout met het bericht", async () => {
  const { ophalen } = mock({ data: { createPost: { message: "Queue limit reached" } } });
  await assert.rejects(maakBufferClient("k", ophalen).maakPost(input), (err: unknown) => {
    assert.ok(err instanceof BufferFout);
    assert.match(err.message, /Queue limit reached/);
    return true;
  });
});

test("HTTP-fout en GraphQL-errors worden een BufferFout met status of bericht", async () => {
  const http = mock({}, 401);
  await assert.rejects(maakBufferClient("k", http.ophalen).organisaties(), /HTTP 401/);
  const graphql = mock({ errors: [{ message: "Cannot query field foo" }] });
  await assert.rejects(maakBufferClient("k", graphql.ophalen).organisaties(), /Cannot query field foo/);
  const leeg = mock({});
  await assert.rejects(maakBufferClient("k", leeg.ophalen).organisaties(), /leeg antwoord/);
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/buffer-client.test.ts`
Expected: FAIL, module niet gevonden.

- [ ] **Step 3: Implementeer**

Maak `scripts/lib/buffer-client.ts`:

```ts
// scripts/lib/buffer-client.ts
/*
  Dunne GraphQL-client voor de Buffer-API (spec §3). Alleen wat de adapter
  nodig heeft: organisaties, kanalen, post aanmaken. fetch is injecteerbaar
  zodat tests niets op het netwerk doen. Bron: https://developers.buffer.com
*/

export const BUFFER_API_URL = "https://api.buffer.com";

export type Ophalen = (url: string, init: RequestInit) => Promise<Response>;

export interface BufferOrganisatie {
  id: string;
  name: string;
}

export interface BufferKanaal {
  id: string;
  name: string;
  /** Netwerknaam zoals Buffer die geeft: facebook, instagram, tiktok, … */
  service: string;
}

export interface BufferAsset {
  image: { url: string };
}

/** Subset van CreatePostInput die wij gebruiken. Enum-waarden gaan als string mee in de variabelen. */
export interface BufferPostInput {
  channelId: string;
  text: string;
  /** Geordend; elke url publiek, direct en https. */
  assets: BufferAsset[];
  schedulingType: "automatic";
  mode: "customScheduled" | "addToQueue";
  needsApproval: false;
  /** UTC-ISO; alleen bij customScheduled. */
  dueAt?: string;
  /** Concept in Buffer; publiceert niet en telt niet mee voor de wachtrijlimiet. */
  saveToDraft?: boolean;
  metadata?: {
    instagram?: { type: string; shouldShareToFeed: boolean };
    tiktok?: { title: string; type: string };
  };
}

export interface BufferPost {
  id: string;
  dueAt: string | null;
}

export class BufferFout extends Error {}

const Q_ORGANISATIES = `query Organisaties { account { organizations { id name } } }`;

const M_MAAK_POST = `mutation MaakPost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

/** Default fetch mét timeout: een hangende API mag de run niet blokkeren. */
const ophalenMetTimeout: Ophalen = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });

export function maakBufferClient(sleutel: string, ophalen: Ophalen = ophalenMetTimeout) {
  async function vraag<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await ophalen(BUFFER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sleutel}` },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });
    if (!res.ok) throw new BufferFout(`Buffer HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new BufferFout(`Buffer GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    if (!json.data) throw new BufferFout("Buffer: leeg antwoord");
    return json.data;
  }

  return {
    async organisaties(): Promise<BufferOrganisatie[]> {
      const d = await vraag<{ account: { organizations: BufferOrganisatie[] } }>(Q_ORGANISATIES);
      return d.account.organizations;
    },
    async kanalen(organizationId: string): Promise<BufferKanaal[]> {
      // Id inline (JSON-gequote string) in plaats van als variabele: de exacte
      // scalar-naam van het input-type staat niet in de docs.
      const query = `query Kanalen { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) { id name service } }`;
      const d = await vraag<{ channels: BufferKanaal[] }>(query);
      return d.channels;
    },
    async maakPost(input: BufferPostInput): Promise<BufferPost> {
      const d = await vraag<{ createPost: { post?: BufferPost; message?: string } }>(M_MAAK_POST, { input });
      if (d.createPost.post) return d.createPost.post;
      throw new BufferFout(`Buffer weigert de post: ${d.createPost.message ?? "onbekende fout"}`);
    },
  };
}

export type BufferClient = ReturnType<typeof maakBufferClient>;
```

- [ ] **Step 4: Draai de tests**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/buffer-client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add scripts/lib/buffer-client.ts scripts/lib/buffer-client.test.ts && git commit -m "feat(social): GraphQL-client voor de Buffer-API met injecteerbare fetch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Selectie en tijdstip (`kiesPosts`, `dueAtVoor`, `tiktokTitel`)

**Files:**
- Create: `scripts/lib/social-buffer.ts`
- Test: `scripts/lib/social-buffer.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Maak `scripts/lib/social-buffer.test.ts`:

```ts
// scripts/lib/social-buffer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlanningPost } from "../../src/lib/social-planning";
import { dueAtVoor, kiesPosts, PLAATSINGSTIJD, tiktokTitel } from "./social-buffer";

/** Minimale planning-post; velden overschrijfbaar per test. */
export function maakPost(o: Partial<PlanningPost> & { id: string; rubriek: PlanningPost["rubriek"]; plaatsingsdag: string }): PlanningPost {
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
  const { gekozen, overgeslagen } = kiesPosts(planning, "2026-09-28", NU);
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
  assert.deepEqual(kiesPosts({ posts: [] }, "2026-09-28", NU), { gekozen: [], overgeslagen: [] });
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
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-buffer.test.ts`
Expected: FAIL, module niet gevonden.

- [ ] **Step 3: Implementeer**

Maak `scripts/lib/social-buffer.ts`:

```ts
// scripts/lib/social-buffer.ts
import type { PlanningJson, PlanningPost } from "../../src/lib/social-planning";
import type { Rubriek } from "../../src/lib/social";
import { nlTijdNaarUtc } from "../../src/lib/dates";

/*
  Pure functies van de Buffer-adapter (spec §5, §6, §8, §9): welke posts,
  op welk tijdstip, met welke createPost-input per kanaal. Geen I/O; het
  script scripts/social-buffer.ts is de schil eromheen.
*/

/** Vaste plaatsingstijden per rubriek, Europe/Amsterdam (spec §5). */
export const PLAATSINGSTIJD: Record<Rubriek, string> = {
  nieuw: "17:00",
  uitgelicht: "19:00",
  weekend: "12:00",
  maand: "10:00",
};

/** Hoeveel later dan "nu" een al verstreken tijdstip wordt gezet. */
export const UITSTEL_MS = 15 * 60_000;

/** TikTok-limiet voor de titel van een fotopost. */
export const TIKTOK_TITEL_MAX = 90;

export interface Keuze {
  post: PlanningPost;
  /** UTC-ISO. */
  dueAt: string;
}

export interface Overgeslagen {
  post: PlanningPost;
  reden: string;
}

/**
 * Plaatsingsdag + rubriektijd (NL) als UTC. Is dat tijdstip niet meer in de
 * toekomst (late herstart), dan nu + 15 minuten, afgerond op de minuut:
 * Buffer wil een toekomstig tijdstip.
 */
export function dueAtVoor(post: Pick<PlanningPost, "rubriek" | "plaatsingsdag">, nu: Date): string {
  const gepland = nlTijdNaarUtc(post.plaatsingsdag, PLAATSINGSTIJD[post.rubriek]);
  if (new Date(gepland).getTime() > nu.getTime()) return gepland;
  const uitgesteld = new Date(nu.getTime() + UITSTEL_MS);
  uitgesteld.setUTCSeconds(0, 0);
  return uitgesteld.toISOString();
}

/**
 * Welke posts naar Buffer gaan: alleen rang 1 (van Uitgelicht de hoogste
 * prioriteit), en geen post waarvan de plaatsingsdag vóór de run-dag ligt.
 * `vandaag` is de NL-datum van de run, `nu` het moment (voor dueAt).
 */
export function kiesPosts(planning: Pick<PlanningJson, "posts">, vandaag: string, nu: Date): { gekozen: Keuze[]; overgeslagen: Overgeslagen[] } {
  const gekozen: Keuze[] = [];
  const overgeslagen: Overgeslagen[] = [];
  for (const post of planning.posts) {
    if (post.rang !== 1) {
      overgeslagen.push({ post, reden: `kandidaat ${post.rang}` });
    } else if (post.plaatsingsdag < vandaag) {
      overgeslagen.push({ post, reden: "plaatsingsdag verstreken" });
    } else {
      gekozen.push({ post, dueAt: dueAtVoor(post, nu) });
    }
  }
  return { gekozen, overgeslagen };
}

/** Titel van een TikTok-fotopost: maximaal 90 tekens, afgekapt op een woordgrens met "…". */
export function tiktokTitel(titel: string): string {
  if (titel.length <= TIKTOK_TITEL_MAX) return titel;
  const kort = titel.slice(0, TIKTOK_TITEL_MAX - 1);
  const spatie = kort.lastIndexOf(" ");
  return `${(spatie > 0 ? kort.slice(0, spatie) : kort).trimEnd()}…`;
}
```

- [ ] **Step 4: Draai de tests**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-buffer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add scripts/lib/social-buffer.ts scripts/lib/social-buffer.test.ts && git commit -m "feat(social): postselectie en plaatsingstijden voor de Buffer-adapter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Mapping per kanaal, kanaalontdekking, versheidscheck en tabel

**Files:**
- Modify: `scripts/lib/social-buffer.ts`
- Test: `scripts/lib/social-buffer.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

Pas de import in `scripts/lib/social-buffer.test.ts` aan:

```ts
import {
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
```

En voeg onderaan toe:

```ts
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
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-buffer.test.ts`
Expected: FAIL, de nieuwe exports bestaan niet.

- [ ] **Step 3: Implementeer**

Pas de imports bovenin `scripts/lib/social-buffer.ts` aan:

```ts
import type { PlanningJson, PlanningPost } from "../../src/lib/social-planning";
import { KANALEN, type Kanaal, type Rubriek } from "../../src/lib/social";
import { nlTijdNaarUtc } from "../../src/lib/dates";
import type { BufferKanaal, BufferPostInput } from "./buffer-client";
```

En voeg onderaan het bestand toe:

```ts
/* ---------- Mapping per kanaal (spec §6) ---------- */

/** Instagram-posttype voor een reeks beelden; na de verificatie met een concept eventueel "carousel". */
export const INSTAGRAM_TYPE = "post";

export interface InputOpties {
  /** true = concept in Buffer (saveToDraft, wachtrijmodus, geen dueAt). */
  concept: boolean;
}

/**
 * createPost-input voor één post op één kanaal. Facebook en Instagram krijgen
 * de feed-slides (4:5), TikTok de story-slides (9:16, fotomodus). Caption per
 * kanaal komt uit de planning.
 */
export function bouwInput(post: PlanningPost, kanaal: Kanaal, kanaalId: string, dueAt: string, opties: InputOpties): BufferPostInput {
  const formaat = kanaal === "tiktok" ? "story" : "feed";
  const input: BufferPostInput = {
    channelId: kanaalId,
    text: post.captions[kanaal],
    assets: post.slides.map((s) => ({ image: { url: s[formaat] } })),
    schedulingType: "automatic",
    needsApproval: false,
    ...(opties.concept ? { mode: "addToQueue" as const, saveToDraft: true } : { mode: "customScheduled" as const, dueAt }),
  };
  if (kanaal === "instagram") input.metadata = { instagram: { type: INSTAGRAM_TYPE, shouldShareToFeed: true } };
  if (kanaal === "tiktok") input.metadata = { tiktok: { title: tiktokTitel(post.titel), type: "post" } };
  return input;
}

/* ---------- Kanaalontdekking (spec §9) ---------- */

export type KanaalIds = Partial<Record<Kanaal, string>>;

export interface Ontdekking {
  ids: KanaalIds;
  /** Kanalen zonder Buffer-koppeling; worden overgeslagen met een waarschuwing. */
  ontbrekend: Kanaal[];
}

/**
 * Per social-kanaal precies één Buffer-kanaal: een override wint; anders het
 * enige kanaal met die service; geen kanaal = ontbrekend; meer dan één = fout
 * met de id's, zodat de override gezet kan worden.
 */
export function ontdekKanalen(kanalen: BufferKanaal[], overrides: KanaalIds = {}): Ontdekking {
  const ids: KanaalIds = {};
  const ontbrekend: Kanaal[] = [];
  for (const kanaal of KANALEN) {
    const override = overrides[kanaal];
    if (override) {
      ids[kanaal] = override;
      continue;
    }
    const gevonden = kanalen.filter((k) => k.service.toLowerCase() === kanaal);
    if (gevonden.length === 1) {
      ids[kanaal] = gevonden[0].id;
    } else if (gevonden.length === 0) {
      ontbrekend.push(kanaal);
    } else {
      const lijst = gevonden.map((k) => `${k.name}=${k.id}`).join(", ");
      throw new Error(`Meer dan één ${kanaal}-kanaal in Buffer (${lijst}); zet BUFFER_KANAAL_${kanaal.toUpperCase()} op de juiste id`);
    }
  }
  return { ids, ontbrekend };
}

/** Kanaal-id-overrides uit de omgeving (BUFFER_KANAAL_FACEBOOK enz.); lege waarden tellen niet. */
export function overridesUitEnv(env: NodeJS.ProcessEnv): KanaalIds {
  const ids: KanaalIds = {};
  for (const kanaal of KANALEN) {
    const waarde = env[`BUFFER_KANAAL_${kanaal.toUpperCase()}`];
    if (waarde) ids[kanaal] = waarde;
  }
  return ids;
}

/* ---------- Versheidscheck (spec §8) ---------- */

/** Komt de deploy die de planning maakte overeen met de commit op de runner? Onbekend als een van beide ontbreekt. */
export function commitKomtOvereen(planningCommit: string | null, runnerCommit: string | undefined): "overeen" | "afwijkend" | "onbekend" {
  if (!planningCommit || !runnerCommit) return "onbekend";
  return planningCommit === runnerCommit ? "overeen" : "afwijkend";
}

/* ---------- Samenvatting (spec §4 stap 7) ---------- */

export type ResultaatStatus = "ingepland" | "concept" | "al in Buffer" | "dry-run" | "kanaal ontbreekt" | "mislukt";

export interface Resultaat {
  post: string;
  kanaal: Kanaal;
  /** UTC-ISO. */
  dueAt: string;
  status: ResultaatStatus;
  detail: string;
}

/** "vr 02-10 12:00" in Europe/Amsterdam. */
export function formatNlTijd(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(/,/g, "");
}

/** Markdown-tabel voor de console en $GITHUB_STEP_SUMMARY. */
export function resultaatTabel(regels: Resultaat[]): string {
  const kop = ["| Post | Kanaal | Plaatsing (NL) | Status | Detail |", "|---|---|---|---|---|"];
  const rijen = regels.map(
    (r) => `| ${r.post} | ${r.kanaal} | ${formatNlTijd(r.dueAt)} | ${r.status} | ${r.detail.replace(/\|/g, "/")} |`,
  );
  return [...kop, ...rijen].join("\n");
}
```

- [ ] **Step 4: Draai de tests en de typecheck**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && node --import tsx --test scripts/lib/social-buffer.test.ts && npx tsc --noEmit`
Expected: PASS (16 tests); `tsc` zonder fouten.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add scripts/lib/social-buffer.ts scripts/lib/social-buffer.test.ts && git commit -m "feat(social): createPost-mapping per kanaal, kanaalontdekking, versheidscheck en resultaattabel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: CLI-script `scripts/social-buffer.ts` + npm-script + `.env.example`

**Files:**
- Create: `scripts/social-buffer.ts`
- Modify: `package.json` (scripts)
- Modify: `.env.example`

- [ ] **Step 1: Schrijf het script**

Maak `scripts/social-buffer.ts`:

```ts
/*
  Buffer-adapter: leest de weekplanning van de site (/social/planning) en zet
  elke post ingepland in Buffer voor Facebook, Instagram en TikTok. Draait
  wekelijks vanuit .github/workflows/social.yml. Spec:
  docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md

    npm run social-buffer                          # inplannen (vereist BUFFER_API_KEY)
    npm run social-buffer -- --concept             # alles als concept in Buffer (verificatie; grootboek blijft ongemoeid)
    npm run social-buffer -- --dry-run             # toon wat er zou gebeuren; geen Buffer-aanroepen, schrijft niets
    npm run social-buffer -- --kanalen             # print de gekoppelde kanalen met id en stop
    npm run social-buffer -- --datum 2026-09-28    # andere referentiedatum (default: vandaag NL-tijd)
    npm run social-buffer -- --basis http://localhost:3000   # alleen zinvol met --dry-run/--kanalen

  Env: BUFFER_API_KEY (zonder: overslaan met exitcode 0), optioneel
       BUFFER_KANAAL_FACEBOOK / _INSTAGRAM / _TIKTOK (kanaal-id-override);
       in CI GITHUB_SHA (versheidscheck), GITHUB_RUN_ID, GITHUB_STEP_SUMMARY, GITHUB_OUTPUT.
*/
import fs from "node:fs";
import { isGeldigeIsoDatum, todayISOInTimeZone } from "../src/lib/dates";
import { KANALEN, type Kanaal } from "../src/lib/social";
import type { PlanningJson } from "../src/lib/social-planning";
import { leesGrootboek, schrijfGrootboek, voegRegelToe, zoekRegel, SOCIAL_BUFFER_LOG_PATH } from "../src/lib/social-buffer-log";
import { maakBufferClient, type BufferClient } from "./lib/buffer-client";
import {
  bouwInput,
  commitKomtOvereen,
  kiesPosts,
  ontdekKanalen,
  overridesUitEnv,
  resultaatTabel,
  type KanaalIds,
  type Resultaat,
} from "./lib/social-buffer";

function flag(naam: string, standaard: string): string {
  const i = process.argv.indexOf(naam);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : standaard;
}

const DATUM = flag("--datum", todayISOInTimeZone());
const BASIS = flag("--basis", "https://opgietingen.nl").replace(/\/$/, "");
const CONCEPT = process.argv.includes("--concept");
const DRY_RUN = process.argv.includes("--dry-run");
const ALLEEN_KANALEN = process.argv.includes("--kanalen");

/** Versheidscheck: zo lang wachten op de Vercel-deploy van de scrape-commit, in stappen van 30 s. */
const WACHT_MAX_MS = 10 * 60_000;
const WACHT_STAP_MS = 30_000;

async function haalPlanning(): Promise<PlanningJson> {
  const url = `${BASIS}/social/planning?datum=${DATUM}`;
  const gestart = Date.now();
  for (;;) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
    const planning = (await res.json()) as PlanningJson;
    const runner = process.env.GITHUB_SHA;
    const check = commitKomtOvereen(planning.commit ?? null, runner);
    if (check === "overeen") return planning;
    if (check === "onbekend") {
      console.log("Versheidscheck overgeslagen (geen commit-hash in de planning of geen GITHUB_SHA).");
      return planning;
    }
    if (Date.now() - gestart >= WACHT_MAX_MS) {
      console.warn(`⚠ Planning komt van deploy ${planning.commit?.slice(0, 7)}, runner staat op ${runner?.slice(0, 7)}; na 10 minuten wachten toch doorgegaan.`);
      return planning;
    }
    console.log(`Deploy nog niet live (planning ${planning.commit?.slice(0, 7)} ≠ runner ${runner?.slice(0, 7)}); opnieuw over 30 s…`);
    await new Promise((r) => setTimeout(r, WACHT_STAP_MS));
  }
}

/** Kanaal-id's via Buffer; bij --dry-run zonder sleutel doen we alsof alle drie bestaan. */
async function bepaalKanalen(client: BufferClient | null): Promise<{ ids: KanaalIds; ontbrekend: Kanaal[] }> {
  const overrides = overridesUitEnv(process.env);
  if (!client) {
    console.log("Geen BUFFER_API_KEY: kanalen niet gecontroleerd (dry-run).");
    const ids: KanaalIds = { ...overrides };
    for (const k of KANALEN) ids[k] ??= "dry-run";
    return { ids, ontbrekend: [] };
  }
  const orgs = await client.organisaties();
  if (orgs.length !== 1) {
    throw new Error(`Verwacht één Buffer-organisatie, gevonden ${orgs.length}: ${orgs.map((o) => `${o.name}=${o.id}`).join(", ")}`);
  }
  const kanalen = await client.kanalen(orgs[0].id);
  if (ALLEEN_KANALEN) {
    for (const k of kanalen) console.log(`${k.service.padEnd(10)} ${k.id}  ${k.name}`);
    process.exit(0);
  }
  return ontdekKanalen(kanalen, overrides);
}

async function main() {
  if (!isGeldigeIsoDatum(DATUM)) throw new Error(`Ongeldige --datum: ${DATUM}`);
  const sleutel = process.env.BUFFER_API_KEY;
  if (!sleutel && !DRY_RUN) {
    console.log("BUFFER_API_KEY ontbreekt — Buffer-adapter overgeslagen.");
    return;
  }
  const client = sleutel ? maakBufferClient(sleutel) : null;

  const { ids, ontbrekend } = await bepaalKanalen(client);
  for (const k of ontbrekend) console.warn(`⚠ Geen ${k}-kanaal in Buffer; ${k} wordt overgeslagen.`);

  const planning = await haalPlanning();
  const { gekozen, overgeslagen } = kiesPosts(planning, todayISOInTimeZone(), new Date());
  for (const o of overgeslagen) console.log(`– ${o.post.id}: ${o.reden}`);
  if (gekozen.length === 0) {
    console.log(`Geen posts om in te plannen voor ${DATUM}.`);
    return;
  }

  const modus = DRY_RUN ? "dry-run" : CONCEPT ? "concept" : "inplannen";
  console.log(`Buffer-adapter ${DATUM} (${modus}): ${gekozen.length} post(s) × ${KANALEN.length} kanalen\n`);

  let grootboek = leesGrootboek();
  const run = process.env.GITHUB_RUN_ID ?? "lokaal";
  const resultaten: Resultaat[] = [];
  let mislukt = 0;

  for (const { post, dueAt } of gekozen) {
    for (const kanaal of KANALEN) {
      const basis = { post: post.id, kanaal, dueAt };
      const kanaalId = ids[kanaal];
      if (!kanaalId) {
        resultaten.push({ ...basis, status: "kanaal ontbreekt", detail: "" });
        continue;
      }
      const bestaand = zoekRegel(grootboek, post.id, kanaal);
      if (!CONCEPT && bestaand) {
        resultaten.push({ ...basis, status: "al in Buffer", detail: bestaand.bufferId });
        continue;
      }
      const input = bouwInput(post, kanaal, kanaalId, dueAt, { concept: CONCEPT });
      if (DRY_RUN || !client) {
        resultaten.push({ ...basis, status: "dry-run", detail: `${input.assets.length} slides, ${input.text.length} tekens` });
        continue;
      }
      try {
        const aangemaakt = await client.maakPost(input);
        if (CONCEPT) {
          resultaten.push({ ...basis, status: "concept", detail: aangemaakt.id });
        } else {
          // Direct wegschrijven: een crash verderop mag een al geplaatste post niet vergeten.
          grootboek = voegRegelToe(grootboek, { post: post.id, kanaal, bufferId: aangemaakt.id, dueAt, aangemaakt: new Date().toISOString(), run });
          schrijfGrootboek(grootboek);
          resultaten.push({ ...basis, status: "ingepland", detail: aangemaakt.id });
        }
      } catch (err) {
        mislukt += 1;
        resultaten.push({ ...basis, status: "mislukt", detail: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  const tabel = resultaatTabel(resultaten);
  console.log(tabel);
  const ingepland = resultaten.filter((r) => r.status === "ingepland").length;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Social-posts ${DATUM} (${modus})\n\n${tabel}\n`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ingepland=${ingepland}\n`);
  if (ingepland > 0) console.log(`\n${ingepland} post(s) ingepland; grootboek: ${SOCIAL_BUFFER_LOG_PATH}`);
  if (CONCEPT) console.log("\nConcepten staan in Buffer ter controle; verwijder ze daar na het nakijken.");
  if (mislukt > 0) {
    console.error(`\n${mislukt} post(s) mislukt`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: npm-script en `.env.example`**

In `package.json` onder `"scripts"`, na `"social-kit"`:

```json
    "social-kit": "tsx scripts/social-kit.ts",
    "social-buffer": "tsx scripts/social-buffer.ts",
    "vind-instagram": "tsx scripts/vind-instagram.ts"
```

Onderaan `.env.example`:

```bash

# Buffer-adapter (scripts/social-buffer.ts): plant de social-posts van de week in
# Buffer voor Facebook, Instagram en TikTok. API-sleutel aanmaken in de Buffer-
# accountinstellingen (alleen de organisatie-eigenaar). Zonder sleutel slaat het
# script zichzelf over. De kanaal-id's worden per run via de API ontdekt; de
# overrides zijn alleen nodig als één organisatie twee kanalen van dezelfde soort heeft.
# BUFFER_API_KEY=
# BUFFER_KANAAL_FACEBOOK=
# BUFFER_KANAAL_INSTAGRAM=
# BUFFER_KANAAL_TIKTOK=
```

- [ ] **Step 3: Typecheck en dry-run tegen de live site**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && npx tsc --noEmit && env -u BUFFER_API_KEY npm run social-buffer -- --dry-run`
Expected: `tsc` zonder fouten. Het script print "Geen BUFFER_API_KEY: kanalen niet gecontroleerd (dry-run).", "Versheidscheck overgeslagen …", de overgeslagen kandidaten (`– uitgelicht-…: kandidaat 2`), en een markdown-tabel met status `dry-run` voor elke gekozen post × drie kanalen (of "Geen posts om in te plannen" als de agenda deze week leeg is). Exitcode 0. Er wordt géén `data/social-buffer.json` aangemaakt: `test ! -f data/social-buffer.json && echo ok`.

- [ ] **Step 4: Dry-run met een oude datum toont de verstreken-regel**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && env -u BUFFER_API_KEY npm run social-buffer -- --dry-run --datum 2026-09-14`
Expected: alle posts van die week staan onder de overgeslagen regels met `plaatsingsdag verstreken`, gevolgd door "Geen posts om in te plannen voor 2026-09-14."

- [ ] **Step 5: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add scripts/social-buffer.ts package.json .env.example && git commit -m "feat(social): social-buffer-script plant de weekposts in Buffer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Workflow `.github/workflows/social.yml`

**Files:**
- Create: `.github/workflows/social.yml`

- [ ] **Step 1: Schrijf de workflow**

```yaml
name: Social-posts inplannen in Buffer

on:
  schedule:
    - cron: "30 7 * * 1"   # elke maandag 07:30 UTC, anderhalf uur na de scrape (06:00 UTC)
  workflow_dispatch:
    inputs:
      datum:
        description: "Referentiedatum YYYY-MM-DD (leeg = vandaag, NL-tijd)"
        required: false
        default: ""
      modus:
        description: "inplannen | concept | dry-run"
        required: false
        default: "inplannen"

permissions:
  contents: write

jobs:
  social:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      # Leest /social/planning van de live site (wacht tot de deploy van deze
      # commit live is) en maakt per post en kanaal een ingeplande Buffer-post.
      # Zonder BUFFER_API_KEY slaat het script zichzelf over.
      - name: Plan social-posts in Buffer
        id: buffer
        env:
          BUFFER_API_KEY: ${{ secrets.BUFFER_API_KEY }}
          BUFFER_KANAAL_FACEBOOK: ${{ secrets.BUFFER_KANAAL_FACEBOOK }}
          BUFFER_KANAAL_INSTAGRAM: ${{ secrets.BUFFER_KANAAL_INSTAGRAM }}
          BUFFER_KANAAL_TIKTOK: ${{ secrets.BUFFER_KANAAL_TIKTOK }}
          DATUM: ${{ github.event.inputs.datum }}
          MODUS: ${{ github.event.inputs.modus || 'inplannen' }}
        run: |
          ARGS=""
          if [ -n "$DATUM" ]; then ARGS="$ARGS --datum $DATUM"; fi
          case "$MODUS" in
            concept) ARGS="$ARGS --concept" ;;
            dry-run) ARGS="$ARGS --dry-run" ;;
          esac
          npm run social-buffer -- $ARGS

      # Het grootboek is het geheugen tegen dubbele posts. Ook committen als het
      # script faalde: al geplaatste posts mogen niet verloren gaan met de runner.
      - name: Commit grootboek op main
        if: always() && (github.event.inputs.modus == '' || github.event.inputs.modus == 'inplannen')
        env:
          INGEPLAND: ${{ steps.buffer.outputs.ingepland || '0' }}
        run: |
          git config user.name "opgietingen-bot"
          git config user.email "bot@opgietingen.nl"
          git add data/social-buffer.json 2>/dev/null || true
          if git diff --cached --quiet; then
            echo "Geen wijzigingen in het grootboek."
          else
            git commit -m "chore(social): week $(date -u +%G-W%V), $INGEPLAND post(s) ingepland in Buffer"
            git pull --rebase origin main
            git push origin HEAD:main
          fi
```

- [ ] **Step 2: Valideer de YAML**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && npx --yes js-yaml .github/workflows/social.yml > /dev/null && echo "yaml ok"`
Expected: `yaml ok` (js-yaml parseert het bestand en print de JSON, die we wegwerpen; een syntaxfout geeft een melding met regelnummer).

- [ ] **Step 3: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add .github/workflows/social.yml && git commit -m "ci(social): wekelijkse workflow die de social-posts in Buffer inplant en het grootboek commit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Documentatie (CLAUDE.md, beide specs) en volledige verificatie

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md` (§7)
- Modify: `docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md` (§12)

- [ ] **Step 1: CLAUDE.md, projectstructuur**

In het structuurblok onder `src/lib/`, na de regel `social*.ts(x)`:

```
    social-buffer-log.ts # grootboek van in Buffer geplaatste posts (enige plek die data/social-buffer.json kent)
```

Onder `scripts/`, na `social-kit.ts`:

```
  social-buffer.ts  # plant de weekposts via de Buffer-API in (Facebook/Instagram/TikTok); wekelijks via social.yml
```

Onder `scripts/lib/`-regel: voeg `buffer-client.ts (Buffer-GraphQL) en social-buffer.ts (selectie, dueAt, mapping per kanaal)` toe aan de opsomming.

Onder `.github/workflows/`, na `scrape.yml`:

```
  social.yml        # wekelijks (ma 07:30 UTC) social-posts inplannen in Buffer → commit grootboek
```

Onder `data/`, na `scrape-runs.json`:

```
  social-buffer.json # grootboek Buffer-adapter: post-id × kanaal → Buffer-post-id (gecommit door social.yml)
```

- [ ] **Step 2: CLAUDE.md, paragraaf Social-kit**

Voeg aan het eind van de paragraaf **Social-kit** toe (vóór "Regels: geen beelden…" of als aparte alinea erna):

```
**Buffer-adapter (`npm run social-buffer`, deelproject 2, spec [docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md](docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md))** — plaatst de posts automatisch: `.github/workflows/social.yml` draait elke maandag 07:30 UTC (anderhalf uur na de scrape), leest `/social/planning` van de live site (wacht tot 10 minuten tot het `commit`-veld gelijk is aan de runner-commit, daarna met waarschuwing door) en maakt per post × kanaal een **ingeplande** Buffer-post via de GraphQL-API (`createPost` met de slide-URL's als `assets`, `customScheduled` + `dueAt`). Alleen `rang === 1` gaat mee (van *Uitgelicht* de hoogste prioriteit). Vaste NL-tijden: nieuw ma 17:00, uitgelicht wo 19:00, weekend vr 12:00, maand de 1e 10:00 (`PLAATSINGSTIJD`); een verstreken tijdstip wordt nu + 15 min, een verstreken plaatsingsdag valt weg. Facebook en Instagram krijgen de feed-slides, TikTok de story-slides (fotomodus, titel ≤ 90 tekens). Kanaal-id's worden per run via de `channels`-query ontdekt (één secret `BUFFER_API_KEY`; `BUFFER_KANAAL_<KANAAL>` alleen bij twee kanalen van dezelfde soort); een niet-gekoppeld kanaal wordt overgeslagen met een waarschuwing. Tegen dubbele posts houdt de adapter een grootboek bij in `data/social-buffer.json` (post-id × kanaal → Buffer-id), dat de workflow commit; een in Buffer verwijderde post komt daardoor niet terug. `--concept` zet alles als concept in Buffer (verificatie; schrijft niets in het grootboek), `--dry-run` toont alleen de tabel, `--kanalen` print de kanalen. Zonder `BUFFER_API_KEY` slaat het script zichzelf over. Instagram-stories en het delen in Facebook-groepen blijven handmatig; `social-kit` blijft als terugvaloptie.
```

- [ ] **Step 3: CLAUDE.md, commando's en env**

In het commandoblok, na de regel van `social-kit`:

```bash
npm run social-buffer   # plan de weekposts in Buffer (BUFFER_API_KEY; -- --concept | --dry-run | --kanalen | --datum)
```

Verder niets: de Buffer-secret en -variabelen staan in de Social-kit-paragraaf van stap 2, niet in de scraper-paragraaf of de Stack-tabel.

- [ ] **Step 4: Spec 2026-09-08, §7**

Voeg direct onder de kop `## 7. Publiceerstap (contract; adapter buiten scope)` toe:

```
> **Bijgewerkt 2026-09-23:** deelproject 2 is ontworpen in
> [2026-09-23-social-buffer-adapter-design.md](2026-09-23-social-buffer-adapter-design.md);
> het script heet `social-buffer`, draait in een eigen workflow `social.yml` en plant
> ingeplande posts (geen concepten), met een grootboek in `data/social-buffer.json`.
> De tekst hieronder is het oorspronkelijke contract.
```

- [ ] **Step 5: Spec 2026-09-23, §12**

Vervang in §12 de regel over `scripts/lib/social-buffer.ts` en `src/lib/social-buffer-log.ts` door:

```
- `scripts/lib/social-buffer.ts`: pure functies `kiesPosts(planning, vandaag, nu)`,
  `dueAtVoor(post, nu)`, `bouwInput(post, kanaal, kanaalId, dueAt, opties)`,
  `tiktokTitel(titel)`, `ontdekKanalen(channels, overrides)`, `overridesUitEnv(env)`,
  `commitKomtOvereen(planningCommit, runnerCommit)`, `resultaatTabel(regels)`.
- `src/lib/social-buffer-log.ts`: typen + `leesGrootboek(pad)`, `schrijfGrootboek`,
  `zoekRegel(grootboek, post, kanaal)`, `voegRegelToe(grootboek, regel)`.
```

- [ ] **Step 6: Volledige verificatie**

Run: `cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && npm test 2>&1 | tail -5 && npm run lint && npm run build 2>&1 | tail -15`
Expected: alle tests groen (`# fail 0`), lint zonder fouten, build slaagt en toont `/social/planning` als dynamische route.

- [ ] **Step 7: Commit**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git add CLAUDE.md docs/superpowers/specs/2026-09-08-social-fundament-en-kit-design.md docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md && git commit -m "docs: Buffer-adapter vastgelegd in CLAUDE.md; specs bijgewerkt na de bouw

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Branch pushen en PR openen

**Files:** geen.

- [ ] **Step 1: Rebase op origin/main en push**

Run:

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && git branch --show-current && git fetch origin && git rebase origin/main && npm test 2>&1 | tail -3 && git push -u origin feat/social-buffer-adapter
```

Expected: rebase zonder conflicten (alleen de wekelijkse scraper-commit kan zijn bijgekomen), tests groen, branch op GitHub.

- [ ] **Step 2: Open de PR**

```bash
cd /Users/nathaniel/Documents/Opgieting.nl-social-buffer && export PATH="/opt/homebrew/bin:$PATH" && gh pr create --base main --head feat/social-buffer-adapter --title "feat(social): Buffer-adapter plant de weekposts automatisch in" --body "$(cat <<'EOF'
## Wat

Deelproject 2 van het social-traject: `npm run social-buffer` leest `/social/planning` van de live site en zet elke post (rang 1) als **ingeplande** post in Buffer voor Facebook, Instagram en TikTok. Nieuwe workflow `social.yml` draait het elke maandag 07:30 UTC en commit het grootboek `data/social-buffer.json` (dedup post-id × kanaal).

Spec: `docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md`. Plan: `docs/superpowers/plans/2026-09-23-social-buffer-adapter.md`.

## Belangrijk vóór het mergen

- [ ] Secret `BUFFER_API_KEY` op GitHub zetten (Buffer-accountinstellingen → API-sleutel).
- [ ] Instagram in Buffer koppelen (Facebook en TikTok staan er al).
- [ ] Lokaal verifiëren met `npm run social-buffer -- --kanalen` en `npm run social-buffer -- --concept`; carrousels per kanaal en PNG op Instagram nakijken (spec §13), concepten daarna in Buffer verwijderen.

## Wijzigingen

- `/social/planning` krijgt een veld `commit` (Vercel-commit-hash) voor de versheidscheck.
- `src/lib/dates.ts`: `nlTijdNaarUtc` (zomer-/wintertijd via Intl).
- Nieuw: `scripts/social-buffer.ts`, `scripts/lib/buffer-client.ts`, `scripts/lib/social-buffer.ts`, `src/lib/social-buffer-log.ts`, `.github/workflows/social.yml`, tests.
- CLAUDE.md en beide specs bijgewerkt.

## Test

`npm test`, `npm run lint`, `npm run build` groen; `npm run social-buffer -- --dry-run` tegen de live site.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR-URL geprint. Mergen doet Nathaniel na de verificatie (repo-conventie: `gh pr merge --rebase --delete-branch`); daarna `git worktree remove ../Opgieting.nl-social-buffer`.

---

## Handmatige verificatie (Nathaniel, na Task 10, vóór het mergen)

Volgorde uit spec §13:

1. Buffer: Instagram-kanaal koppelen.
2. API-sleutel aanmaken; in `.env` van de worktree zetten als `BUFFER_API_KEY=…`.
3. `npm run social-buffer -- --kanalen` → drie regels (`facebook`, `instagram`, `tiktok`) met id.
4. `npm run social-buffer -- --concept` → per kanaal een concept in Buffer. Controleren:
   - Facebook: fotoreeks met alle slides in volgorde, caption compleet met UTM-link.
   - TikTok: fotopost met story-slides en de titel.
   - Instagram: carrousel; accepteert Buffer de PNG's? Zo niet: eerst `INSTAGRAM_TYPE = "carousel"` proberen (één constante in `scripts/lib/social-buffer.ts`, test aanpassen); bij een formaatfout de slide-routes uitbreiden met `?type=jpeg` via `sharp` en de Instagram-mapping daarop zetten (kleine vervolgtaak).
   - Concepten in Buffer verwijderen.
5. Secret `BUFFER_API_KEY` op GitHub zetten; PR mergen.
6. Eerste echte run via *Actions → Social-posts inplannen in Buffer → Run workflow* (modus `inplannen`), wachtrij in Buffer nakijken; daarna loopt het op de cron.
