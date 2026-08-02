# Facebook-doorstuurkanaal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doorgestuurde Facebook-posts (posttekst + paginalink gemaild naar events@opgietingen.nl) automatisch aan de juiste sauna koppelen en door de bestaande mail-pipeline laten verwerken tot concept-events.

**Architecture:** Geen nieuw kanaal; een tweede matching-route in `scrape-mail.ts`. Faalt de bestaande afzender-match en is de afzender een vertrouwde doorstuurder (`MAIL_VERTROUWDE_AFZENDERS`), dan koppelt een nieuwe content-matcher de mail aan een bron via het nieuwe `facebook`-veld in `bronnen.json` (fallback: website-domein). Alles stroomafwaarts (extractie, dedup, kwaliteitspoort, MDX-concept, nooit auto-publiceren) blijft ongewijzigd.

**Tech Stack:** TypeScript (strict), node:test via tsx (`npm run test`), bestaande scraper-pipeline in `scripts/`.

**Spec:** [docs/superpowers/specs/2026-08-02-facebook-doorstuurkanaal-design.md](../specs/2026-08-02-facebook-doorstuurkanaal-design.md)

**Conventie:** alle code, comments, commit messages en logregels in het Nederlands, zoals de rest van de codebase.

---

### Task 1: `facebook`-veld in het Bron-type, bronnen.json en .env.example

**Files:**
- Modify: `scripts/lib/content.ts:26-46` (interface `Bron`)
- Modify: `content/bronnen.json` (`$comment` + bron `thermen-binnenmaas`)
- Modify: `.env.example`

- [ ] **Step 1: Voeg het veld toe aan de `Bron`-interface**

In `scripts/lib/content.ts`, in `interface Bron`, direct onder het `website`-veld (regel 32):

```ts
  website?: string;
  /**
   * URL van de Facebook-pagina van de sauna. Matching-anker voor doorgestuurde
   * social-posts in scrape-mail (en de bronnenlijst voor eventueel later
   * automatisch FB-scrapen, zie de spec van 2026-08-02).
   */
  facebook?: string;
```

- [ ] **Step 2: Werk `content/bronnen.json` bij**

In de `$comment` bovenaan, na de zin over `matchToken`, toevoegen:

```
facebook = URL van de Facebook-pagina (matching-anker voor doorgestuurde posts).
```

De volledige `$comment` wordt dus:

```json
"$comment": "Bronnenlijst voor opgietingen.nl event-scraper. id = saunaSlug (koppelt gescrapete events aan content/saunas/). status: te-verifieren | actief | geen-agenda | handmatig | aanvullen | opzetten | kapot. Alleen 'actief' (type website) wordt gescrapet. matchToken kiest de juiste pagina op multi-locatie-sites. facebook = URL van de Facebook-pagina (matching-anker voor doorgestuurde posts).",
```

Bij de bron met `"id": "thermen-binnenmaas"` een regel toevoegen (na `"website"`):

```json
      "facebook": "https://www.facebook.com/ThermenBinnenmaas",
```

Overige sauna's krijgen het veld gaandeweg wanneer hun pagina bekend is.

- [ ] **Step 3: Voeg het mail-blok toe aan `.env.example`**

Onderaan `.env.example` toevoegen:

```bash

# Nieuwsbrief-/doorstuurkanaal (scripts/scrape-mail.ts) — IMAP-inbox events@opgietingen.nl
# MAIL_IMAP_HOST=
# MAIL_IMAP_USER=
# MAIL_IMAP_PASS=

# Vertrouwde doorstuurders (kommagescheiden e-mailadressen): mails van deze
# afzenders worden op INHOUD aan een sauna gekoppeld (facebook-veld of
# website-domein uit bronnen.json) — voor doorgestuurde Facebook-posts.
# MAIL_VERTROUWDE_AFZENDERS=
```

- [ ] **Step 4: Draai de bestaande tests en de build-check**

Run: `npm run test`
Expected: alle tests PASS (alleen een optioneel veld en JSON/env-templates gewijzigd).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/content.ts content/bronnen.json .env.example
git commit -m "feat(bronnen): facebook-veld als matching-anker voor doorgestuurde posts"
```

---

### Task 2: `facebookPaginanaam` + `matchBronByContent` (TDD)

**Files:**
- Modify: `scripts/lib/content.ts` (nieuwe functies direct onder `matchBronBySender`, na regel 112)
- Test: `scripts/lib/content.test.ts`

- [ ] **Step 1: Schrijf de failing tests**

In `scripts/lib/content.test.ts` de import bovenaan uitbreiden:

```ts
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
```

Onderaan het bestand toevoegen:

```ts
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
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npm run test`
Expected: FAIL — `facebookPaginanaam`/`matchBronByContent` bestaan nog niet (import-error of "is not a function").

- [ ] **Step 3: Implementeer de matchers**

In `scripts/lib/content.ts`, direct onder `matchBronBySender` (na regel 112) toevoegen:

```ts
// Vaste padsegmenten van Facebook zelf; nooit een paginanaam. Voorkomt dat een
// bron met een pages/-URL of een share-link in een mail een valse match geeft.
const GENERIEKE_FB_SEGMENTEN = new Set([
  "pages",
  "groups",
  "events",
  "people",
  "profile.php",
  "share",
  "story.php",
  "permalink.php",
  "photo.php",
  "watch",
  "reel",
  "hashtag",
  "l.php",
  "login",
]);

/**
 * Genormaliseerde paginanaam uit een facebook-URL: het eerste padsegment na
 * facebook.com, lowercase. Werkt voor pagina-URLs én post-URLs, en voor
 * www./m.-varianten (de regex matcht facebook.com als substring van de host).
 */
export function facebookPaginanaam(facebookUrl: string | undefined): string | undefined {
  if (!facebookUrl) return undefined;
  const m = facebookUrl.toLowerCase().match(/facebook\.com\/([a-z0-9._-]+)/);
  const naam = m?.[1];
  return naam && !GENERIEKE_FB_SEGMENTEN.has(naam) ? naam : undefined;
}

/**
 * Koppelt een doorgestuurde mail (bv. een Facebook-post van een sauna) op
 * INHOUD aan een bron — voor mails waarvan de afzender de doorstuurder is en
 * dus niets over de sauna zegt. Match-volgorde:
 *   1. facebook-paginanamen in de tekst versus het `facebook`-veld van de
 *      bronnen (post- en pagina-URLs, www./m.-varianten, hoofdletterongevoelig);
 *   2. fallback: het website-domein van precies één bron komt in de tekst voor
 *      (platform-hosts uitgesloten, zelfde reden als bij matchBronBySender).
 * Uniek of niets: bij twee of meer kandidaten wordt niet gegokt (→ concept
 * met keurNotitie voor handmatige toewijzing, het bestaande vangnet).
 */
export function matchBronByContent(bronnen: Bron[], tekst: string): Bron | undefined {
  const text = tekst.toLowerCase();
  if (!text.trim()) return undefined;

  const paginasInTekst = new Set(
    [...text.matchAll(/facebook\.com\/([a-z0-9._-]+)/g)]
      .map((m) => m[1])
      .filter((naam) => !GENERIEKE_FB_SEGMENTEN.has(naam)),
  );
  if (paginasInTekst.size) {
    const byFacebook = bronnen.filter((b) => {
      const naam = facebookPaginanaam(b.facebook);
      return naam !== undefined && paginasInTekst.has(naam);
    });
    if (byFacebook.length === 1) return byFacebook[0];
    if (byFacebook.length > 1) return undefined; // ambigu → niet gokken
  }

  const byHost = bronnen.filter((b) => {
    if (!b.website) return false;
    try {
      const host = new URL(b.website).hostname.replace(/^www\./, "").toLowerCase();
      return host !== "" && !PLATFORM_HOSTS.has(host) && text.includes(host);
    } catch {
      return false;
    }
  });
  return byHost.length === 1 ? byHost[0] : undefined;
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npm run test`
Expected: PASS (alle tests, inclusief de bestaande).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/content.ts scripts/lib/content.test.ts
git commit -m "feat(scraper): matchBronByContent koppelt doorgestuurde FB-posts op inhoud"
```

---

### Task 3: `isVertrouwdeAfzender` (TDD)

**Files:**
- Modify: `scripts/lib/content.ts` (direct onder `matchBronByContent`)
- Test: `scripts/lib/content.test.ts`

- [ ] **Step 1: Schrijf de failing tests**

Import in `scripts/lib/content.test.ts` uitbreiden met `isVertrouwdeAfzender`. Onderaan toevoegen:

```ts
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
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npm run test`
Expected: FAIL — `isVertrouwdeAfzender` bestaat nog niet.

- [ ] **Step 3: Implementeer**

In `scripts/lib/content.ts`, direct onder `matchBronByContent`:

```ts
/**
 * Staat dit afzenderadres in de kommagescheiden lijst vertrouwde doorstuurders
 * (env MAIL_VERTROUWDE_AFZENDERS)? Vergelijking op het VOLLEDIGE adres,
 * lowercase. Trusted bepaalt alleen of de content-match geprobeerd wordt —
 * nooit de publicatiestatus (een From-header blijft spoofbaar; mail-events
 * blijven altijd concept).
 */
export function isVertrouwdeAfzender(fromAddress: string, lijst: string | undefined): boolean {
  const from = fromAddress.toLowerCase().trim();
  if (!from || !lijst) return false;
  return lijst
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(from);
}
```

- [ ] **Step 4: Draai de tests en zie ze slagen**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/content.ts scripts/lib/content.test.ts
git commit -m "feat(scraper): isVertrouwdeAfzender voor de doorstuur-route"
```

---

### Task 4: Doorstuur-route in scrape-mail.ts + dry-run-mock

**Files:**
- Modify: `scripts/scrape-mail.ts:1-17` (headercomment), `:21-31` (imports), `:50` (const-blok), `:68-97` (mocks), `:136-145` (match-flow)

- [ ] **Step 1: Werk het headercomment en de imports bij**

Headercomment (regel 2-8): na de zin "koppelt elke mail op afzender aan een sauna-bron (→ saunaSlug)," invoegen:

```
  mails van vertrouwde doorstuurders (MAIL_VERTROUWDE_AFZENDERS, voor
  doorgestuurde Facebook-posts) worden bij een gemiste afzender-match op
  INHOUD gekoppeld (facebook-veld/website-domein via matchBronByContent),
```

En in het Env-lijstje (regel 15-16) `MAIL_VERTROUWDE_AFZENDERS` toevoegen:

```
  Env: MAIL_IMAP_HOST/USER/PASS (+ optioneel PORT/TLS/MAILBOX), ANTHROPIC_API_KEY,
       MAIL_VERTROUWDE_AFZENDERS (doorstuur-route), SCRAPE_AUTOPUBLISH=true.
```

Import-blok (regel 21-31) uitbreiden:

```ts
import {
  readBronnen,
  existingEventKeys,
  existingSaunaSlugs,
  isVertrouwdeAfzender,
  matchBronByContent,
  matchBronBySender,
  dedupKey,
  slugify,
  writeEventMdx,
  type Bron,
  type NewEvent,
} from "./lib/content";
```

- [ ] **Step 2: Voeg de env-const toe**

Na `const TODAY = todayISOInTimeZone();` (regel 50):

```ts
// Doorstuur-route: in dry-run een vast mock-adres zodat de route zonder env
// testbaar is; in productie uitsluitend wat de operator expliciet instelt.
const VERTROUWDE_AFZENDERS = DRY_RUN
  ? "doorstuur@voorbeeld.example"
  : process.env.MAIL_VERTROUWDE_AFZENDERS;
```

- [ ] **Step 3: Breid de dry-run-mocks uit**

`mockMail()` (regel 69-84) krijgt een derde bericht:

```ts
    {
      uid: 3,
      from: "doorstuur@voorbeeld.example", // vertrouwde doorstuurder → match op inhoud
      subject: "Fwd: opgietweekend bij Thermen Binnenmaas",
      markdown:
        "Opgietweekend op 11 en 12 april 2027 met gast-Aufgussmeisters!\n" +
        "https://www.facebook.com/ThermenBinnenmaas/posts/pfbid0voorbeeld",
    },
```

`mockOutcome()` (regel 87-97): vervang de uid-conditie door een tabel:

```ts
/** Mock-extractie voor --dry-run: één geldig toekomstig event uit de mail. */
function mockOutcome(mail: MailMessage): ScrapeOutcome {
  const startDatums: Record<number, string> = { 1: "2027-02-14", 2: "2027-03-07", 3: "2027-04-11" };
  const events: ScrapedEvent[] = [
    {
      titel: `Aufguss uit nieuwsbrief (${mail.subject})`,
      type: "thema",
      startDatum: startDatums[mail.uid] ?? "2027-05-01",
      beschrijving: "Opgieting aangekondigd via de nieuwsbrief.",
    },
  ];
  return { events, markdown: mail.markdown, method: "none", warnings: ["dry-run: geen echte extractie"] };
}
```

- [ ] **Step 4: Voeg de content-match toe aan de flow**

Vervang in `main()` (regel 137-145):

```ts
    const bron: Bron | undefined = matchBronBySender(data.bronnen, mail.from);
    // Geen match → afzender-slug als saunaSlug; de poort keurt dit af (onbekende
    // saunaSlug) zodat het als concept blijft staan voor handmatige toewijzing.
    const saunaSlug = bron?.id ?? slugify(mail.from);
    const land: "NL" | "BE" = bron?.land === "BE" ? "BE" : "NL";

    console.log(
      `— ${mail.from} · "${mail.subject}" → ${bron ? `sauna: ${bron.id}` : "GEEN match (concept)"}`,
    );
```

door:

```ts
    let bron: Bron | undefined = matchBronBySender(data.bronnen, mail.from);
    let matchRoute = bron ? `sauna: ${bron.id}` : "GEEN match (concept)";
    // Doorgestuurde post (bv. Facebook) van een vertrouwde doorstuurder: de
    // afzender zegt dan niets over de sauna, dus match op de mailinhoud.
    if (!bron && isVertrouwdeAfzender(mail.from, VERTROUWDE_AFZENDERS)) {
      bron = matchBronByContent(data.bronnen, `${mail.subject}\n${mail.markdown}`);
      if (bron) matchRoute = `sauna: ${bron.id} (op inhoud, doorgestuurd)`;
    }
    // Geen match → afzender-slug als saunaSlug; de poort keurt dit af (onbekende
    // saunaSlug) zodat het als concept blijft staan voor handmatige toewijzing.
    const saunaSlug = bron?.id ?? slugify(mail.from);
    const land: "NL" | "BE" = bron?.land === "BE" ? "BE" : "NL";

    console.log(`— ${mail.from} · "${mail.subject}" → ${matchRoute}`);
```

- [ ] **Step 5: Draai de dry-run en controleer de output**

Run: `npm run scrape-mail -- --dry-run`
Expected in de output:

- mail 1: `→ sauna: thermen-bussloo` (bestaande afzender-route);
- mail 2: `→ GEEN match (concept)` (onbekende afzender, bestaand vangnet);
- mail 3: `→ sauna: thermen-binnenmaas (op inhoud, doorgestuurd)` en daaronder `+ concept — Aufguss uit nieuwsbrief (Fwd: opgietweekend bij Thermen Binnenmaas)`;
- afsluitend `Klaar. 3 nieuw event(s), 0 overgeslagen.`

(Werkt alleen als Task 1 het `facebook`-veld bij `thermen-binnenmaas` heeft gezet — de dry-run leest het echte `bronnen.json`.)

- [ ] **Step 6: Draai alle tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/scrape-mail.ts
git commit -m "feat(scrape-mail): doorstuur-route — content-match voor vertrouwde afzenders"
```

---

### Task 5: CI-secret doorgeven + documentatie

**Files:**
- Modify: `.github/workflows/scrape.yml:56-65` (env van de mail-stap)
- Modify: `CLAUDE.md` (nieuwsbrief-sectie + datamodel-alinea over bronnen.json + env-regel)

- [ ] **Step 1: Geef het secret door in de workflow**

In `.github/workflows/scrape.yml`, in de stap "Scrape nieuwsbrieven", onder `MAIL_IMAP_TLS` toevoegen:

```yaml
          MAIL_VERTROUWDE_AFZENDERS: ${{ secrets.MAIL_VERTROUWDE_AFZENDERS }}
```

- [ ] **Step 2: Werk CLAUDE.md bij**

1. In de sectie **Content-scraper (pipeline)**, alinea "**Bronnen**", in de veldopsomming na `matchToken` toevoegen: `` optioneel `facebook` (URL van de Facebook-pagina; matching-anker voor doorgestuurde posts) ``.

2. In de alinea "**Nieuwsbrief-kanaal (`events@opgietingen.nl`)**", na de zin over `matchBronBySender`, toevoegen:

```markdown
Daarnaast is de inbox het kanaal voor **doorgestuurde Facebook-posts**: sauna's kondigen opgietweekenden vaak (alleen) op Facebook aan, en Facebook is niet direct scrapebaar (login-wall, bot-detectie; een anonieme fetch van een publieke post levert een lege foutpagina op). Workflow: posttekst kopiëren + link naar de post of pagina erbij → mailen naar `events@opgietingen.nl` (regel: **altijd de posttekst meeplakken** — de link is voor de matching, de tekst voor de extractie; een mail met alleen een link levert 0 events op en wordt alleen gelogd). Mails van een vertrouwd doorstuur-adres (env `MAIL_VERTROUWDE_AFZENDERS`, kommagescheiden, volledig adres) worden bij een gemiste afzender-match op **inhoud** gekoppeld via `matchBronByContent`: eerst het `facebook`-veld van de bronnen (paginanaam uit post-/pagina-URLs, www./m.-varianten), dan het website-domein als fallback — uniek of niets, ambigu blijft het bestaande vangnet (concept + keurNotitie). Trusted bepaalt alleen de kóppeling, nooit de publicatiestatus.
```

3. In de regel "**Env / secrets:**" `MAIL_VERTROUWDE_AFZENDERS (doorstuur-route)` toevoegen na `MAIL_IMAP_*`.

- [ ] **Step 3: Controleer de build**

Run: `npm run build`
Expected: build slaagt (er is niets aan de site zelf gewijzigd; dit is de standaard pre-commit-verificatie van dit project).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/scrape.yml CLAUDE.md
git commit -m "docs(scraper): doorstuur-route gedocumenteerd + CI-secret doorgegeven"
```

- [ ] **Step 5: Handmatige naslag voor de operator (geen code)**

Twee acties die alleen Nathaniel kan doen; in de eindrapportage benoemen:

1. GitHub → repo Settings → Secrets and variables → Actions → nieuw secret `MAIL_VERTROUWDE_AFZENDERS` met de doorstuur-adressen (kommagescheiden).
2. Lokaal hetzelfde adres in `.env` zetten (`MAIL_VERTROUWDE_AFZENDERS=...`) voor handmatige `npm run scrape-mail`-runs.

---

## Buiten scope (bewaakt door de spec)

- Geen betaalde scraping-diensten (Apify e.d.) — besluit 2026-08-02; fase B blijft op papier.
- Geen Instagram, geen community-groepen, geen vision-extractie van posters.
- Geen wijziging aan de nooit-auto-publiceren-regel voor mail-events.
