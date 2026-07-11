# Opgietingen.nl Audit and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak Opgietingen.nl sneller scanbaar, betrouwbaar rond Nederlandse datumgrenzen en volledig bruikbaar op mobiel en met toetsenbord, zonder de bestaande merkstijl of architectuur te vervangen.

**Architecture:** Behoud MDX-content en server-side filtering in de App Router. Breid de pure helpers voor datum-, query- en schema-logica test-first uit; laat `AgendaFilters` uitsluitend URL-state beheren en voeg aparte presentatiecomponenten toe voor compacte agendaresultaten en actieve filters.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 4, Node `node:test`, ESLint 9 met `eslint-config-next` 15.

---

## Bestandsstructuur

- Create: `scripts/lib/site-polish.test.ts` — regressietests voor datums, filters en Event-JSON-LD.
- Modify: `src/lib/dates.ts` — kalenderdag in `Europe/Amsterdam` bepalen.
- Modify: `src/lib/filters.ts` — zoekterm, queryvalidatie, foutstatus en filterlabels.
- Modify: `src/lib/schema.ts` — uitsluitend onderbouwde Event-velden publiceren.
- Create: `src/components/AgendaEventCard.tsx` — compacte agenda-specifieke resultaatpresentatie.
- Modify: `src/components/AgendaFilters.tsx` — zoekveld, afzonderlijk verwijderbare filters en inline datumfout.
- Modify: `src/app/agenda/page.tsx` — fout-/lege staat, live resultaataantal en compact resultaatgrid.
- Modify: `src/components/SiteHeader.tsx` — actieve route en toegankelijk mobiel menu.
- Modify: `src/app/layout.tsx` — skiplink en stabiele `main`-target.
- Modify: `src/app/globals.css` — focus-visible, reduced motion en menu-scroll-lock polish.
- Modify: `src/components/HeroHeader.tsx` — compactere hero en zoekterm in het GET-formulier.
- Modify: `src/app/event/[slug]/page.tsx` — wijzigingsdisclaimer bij officiële CTA.
- Create: `src/app/not-found.tsx` — bruikbare 404-route.
- Create: `eslint.config.mjs` — niet-interactieve Next.js lintconfiguratie.
- Modify: `package.json`, `package-lock.json` — lintscript en uitsluitend lint-devDependencies.

### Task 1: Datum-, zoek- en schemakern test-first corrigeren

**Files:**
- Create: `scripts/lib/site-polish.test.ts`
- Modify: `src/lib/dates.ts:89-92`
- Modify: `src/lib/filters.ts:6-62`
- Modify: `src/lib/schema.ts:58-90`

- [ ] **Step 1: Schrijf falende regressietests**

Voeg `scripts/lib/site-polish.test.ts` toe met een volledige fixture en deze contracten:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { OpgietEvent } from "../../src/lib/content";
import { todayISOInTimeZone } from "../../src/lib/dates";
import { filterEvents, parseFilters, validateDateRange } from "../../src/lib/filters";
import { eventSchema } from "../../src/lib/schema";

const event: OpgietEvent = {
  slug: "mystic-avond",
  saunaSlug: "elysium",
  titel: "Mystic Aufguss Nacht",
  type: "thema",
  startDatum: "2026-08-22",
  tijden: "20:00 – 01:00",
  prijsIndicatie: "€ 55",
  ticketUrl: "https://example.com/tickets",
  status: "gepubliceerd",
  body: "Een avond met meerdere opgietingen.",
  sauna: {
    slug: "elysium",
    naam: "Thermen & Beauty Elysium",
    land: "NL",
    provincie: "Zuid-Holland",
    plaats: "Bleiswijk",
    adres: "Voorbeeldweg 1",
    lat: 52,
    lng: 4.5,
    faciliteiten: [],
    website: "https://example.com",
    affiliateUrl: "https://example.com",
    sponsored: false,
    body: "Saunabeschrijving",
  },
};

test("Amsterdamse kalenderdag blijft 11 juli bij UTC-middernacht", () => {
  assert.equal(todayISOInTimeZone(new Date("2026-07-11T22:30:00Z")), "2026-07-12");
  assert.equal(todayISOInTimeZone(new Date("2026-07-11T00:30:00Z")), "2026-07-11");
});

test("parseFilters accepteert q en negeert ongeldige datums", () => {
  assert.deepEqual(parseFilters({ q: "  elysium  ", van: "11-07-2026", type: "fout" }), {
    q: "elysium",
    land: undefined,
    provincie: undefined,
    type: undefined,
    van: undefined,
    tot: undefined,
    toonAfgelopen: false,
  });
});

test("zoeken vindt titel, sauna en plaats zonder hoofdlettergevoeligheid", () => {
  for (const q of ["mystic", "ELYSIUM", "bleiswijk"]) {
    assert.equal(filterEvents([event], { q }, "2026-07-11").length, 1);
  }
  assert.equal(filterEvents([event], { q: "bussloo" }, "2026-07-11").length, 0);
});

test("omgekeerd datumbereik levert een concrete fout", () => {
  assert.equal(validateDateRange({ van: "2026-08-23", tot: "2026-08-22" }), "De einddatum ligt vóór de begindatum.");
});

test("Event-schema verzint geen organizer, Offer of beschikbaarheid", () => {
  const schema = eventSchema(event) as Record<string, unknown>;
  assert.equal("organizer" in schema, false);
  assert.equal("offers" in schema, false);
});
```

- [ ] **Step 2: Draai de nieuwe test en bevestig de rode fase**

Run: `npm test -- --test-name-pattern="Amsterdamse|parseFilters|zoeken|omgekeerd|Event-schema"`

Expected: FAIL omdat `todayISOInTimeZone` en `validateDateRange` nog niet bestaan en de bestaande filters/schema de nieuwe contracten niet volgen.

- [ ] **Step 3: Implementeer de minimale pure helpers**

Pas `dates.ts` aan met:

```ts
const SITE_TIME_ZONE = "Europe/Amsterdam";

export function todayISOInTimeZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function todayISO(): string {
  return todayISOInTimeZone();
}
```

Breid `EventFilters` uit met `q?: string`. Voeg een strikte kalenderdatumcheck toe, trim `q`, negeer ongeldige `van`/`tot`, zoek via één genormaliseerde haystack en voeg toe:

```ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealISODate(value: string | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function validateDateRange(filters: Pick<EventFilters, "van" | "tot">): string | null {
  return filters.van && filters.tot && filters.van > filters.tot
    ? "De einddatum ligt vóór de begindatum."
    : null;
}
```

In `filterEvents`, return een lege lijst wanneer `validateDateRange(f)` niet `null` is en vergelijk `q.toLocaleLowerCase("nl-NL")` met titel, sauna, plaats en provincie. Neem `q` op in `activeFilterCount`.

Vereenvoudig `eventSchema`: verwijder `organizer` en de volledige `offers`-spread; behoud de betrouwbare naam, datums, beschrijving, URL, afbeelding en locatie.

- [ ] **Step 4: Draai kern- en bestaande tests**

Run: `npm test`

Expected: 18 tests PASS, 0 FAIL.

- [ ] **Step 5: Commit de pure kernwijziging**

```bash
git add scripts/lib/site-polish.test.ts src/lib/dates.ts src/lib/filters.ts src/lib/schema.ts
git commit -m "fix: maak agenda zoeken en datumlogica betrouwbaar"
```

### Task 2: Agenda-interactie en actieve filters verbeteren

**Files:**
- Modify: `src/components/AgendaFilters.tsx`
- Modify: `src/app/agenda/page.tsx`

- [ ] **Step 1: Voeg het zoekveld en URL-updatecontract toe**

Lees `q` uit `useSearchParams`. Voeg boven de chips een gelabeld zoekformulier toe dat bij submit `update({ q: searchValue.trim() })` uitvoert. Gebruik een lokale `searchValue` state die bij externe URL-wijzigingen synchroniseert. De input krijgt `type="search"`, `name="q"`, `autoComplete="off"` en minimaal 44 px hoogte.

- [ ] **Step 2: Maak actieve filters afzonderlijk verwijderbaar**

Render voor `q`, `land`, `provincie`, `type`, `van` en `tot` een knop met tekst zoals `Zoeken: elysium ×`. Iedere knop roept `update({ [key]: "" })` aan. Geef de container `aria-label="Actieve filters"`; de resetknop navigeert naar alleen `pathname`.

- [ ] **Step 3: Maak de chiprij mobiel zonder verborgen horizontale status**

Vervang de horizontaal scrollende typerij door `flex flex-wrap gap-2`. Geef alle `Pill`-knoppen `min-h-11`, `aria-pressed={active}` en een zichtbare `focus-visible`-ring.

- [ ] **Step 4: Koppel fout- en resultatastatus server-side**

Bereken in `agenda/page.tsx`:

```ts
const filterError = validateDateRange(filters);
const events = filterError ? [] : filterEvents(getAllEvents(), filters);
```

Geef `AgendaFilters` de prop `error={filterError}` en toon deze met `role="alert"`. Geef het resultaataantal `aria-live="polite"`. Laat de lege staat bij een fout niet ook “Geen events gevonden” tonen. Voeg bij een lege geldige zoekopdracht een `Link href="/agenda"` met “Wis alle filters” toe.

- [ ] **Step 5: Controleer TypeScript en commit**

Run: `npx tsc --noEmit`

Expected: exit 0.

```bash
git add src/components/AgendaFilters.tsx src/app/agenda/page.tsx
git commit -m "feat: verbeter zoeken en actieve agendafilters"
```

### Task 3: Agendaresultaten compacter en scanbaar maken

**Files:**
- Create: `src/components/AgendaEventCard.tsx`
- Modify: `src/app/agenda/page.tsx`

- [ ] **Step 1: Maak een agenda-specifieke resultaatcomponent**

`AgendaEventCard` ontvangt één `OpgietEvent`. Bouw één volledige `Link` met een thumbnail (`CoverImage`), een datumkolom met `formatDateShort`, optioneel `event.tijden`, titel, `sauna.naam`, `sauna.plaats`, type en optionele prijs. Gebruik mobiel `grid-cols-[5.5rem_1fr]` en vanaf `sm` `grid-cols-[8rem_7rem_1fr_auto]`; zet tabular figures op datum/tijd.

- [ ] **Step 2: Vervang uitsluitend de agenda-grid**

In `agenda/page.tsx` vervang je `EventCard` door `AgendaEventCard` en de drie kolommen door één `space-y-3` lijst. Laat homepage, maand- en provinciepagina's de bestaande fotografische `EventCard` behouden.

- [ ] **Step 3: Controleer lange en ontbrekende waarden**

Gebruik `min-w-0`, `break-words` en geen geforceerde vaste hoogte. Render geen tijd-, prijs- of themablok als de bronwaarde ontbreekt. De gehele rij houdt een zichtbare hover-, active- en focus-visible-state.

- [ ] **Step 4: Typecheck en commit**

Run: `npx tsc --noEmit`

Expected: exit 0.

```bash
git add src/components/AgendaEventCard.tsx src/app/agenda/page.tsx
git commit -m "feat: maak agendaresultaten sneller scanbaar"
```

### Task 4: Mobiele navigatie en globale accessibility afwerken

**Files:**
- Modify: `src/components/SiteHeader.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/app/not-found.tsx`

- [ ] **Step 1: Voeg skiplink en main-target toe**

Plaats vóór `SiteHeader` een link `href="#hoofdinhoud"` met class `skip-link`; geef `<main id="hoofdinhoud" tabIndex={-1}>`.

- [ ] **Step 2: Bouw het mobiele menu met focuscontract**

Voeg `menuOpen`, een button-ref en een menu-ref toe. De menuknop heeft `aria-controls="mobiele-navigatie"`, `aria-expanded`, tekst voor screenreaders en een 44×44 px doel. Bij openen gaat focus naar de eerste menulink; Escape sluit en herstelt focus naar de knop. Routewijziging sluit het menu. Terwijl open: voeg `menu-open` aan `document.body.classList` toe en verwijder die in cleanup.

- [ ] **Step 3: Markeer actieve routes**

Gebruik `pathname === href || pathname.startsWith(`${href}/`)` en zet `aria-current="page"` op de actieve desktop- en mobiele link. De mobiele navigatie is een onder de header uitklappend paneel, geen modal en geen extra CTA-duplicaat.

- [ ] **Step 4: Voeg globale focus/reduced-motion CSS toe**

```css
.skip-link { position: fixed; left: 1rem; top: 1rem; z-index: 50; transform: translateY(-200%); }
.skip-link:focus { transform: translateY(0); }
body.menu-open { overflow: hidden; }
:where(a, button, input, select):focus-visible { outline: 2px solid var(--color-ember); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

- [ ] **Step 5: Voeg een bruikbare 404 toe**

Maak `not-found.tsx` met één `h1` (“Deze pagina is niet gevonden”), korte Nederlandse uitleg en links naar `/agenda` en `/saunas`. Gebruik bestaande tokens en geen nieuwe illustratie.

- [ ] **Step 6: Typecheck en commit**

Run: `npx tsc --noEmit`

Expected: exit 0.

```bash
git add src/components/SiteHeader.tsx src/app/layout.tsx src/app/globals.css src/app/not-found.tsx
git commit -m "feat: maak navigatie mobiel en toetsenbordvriendelijk"
```

### Task 5: Homepage, betrouwbaarheid en lintbasis polijsten

**Files:**
- Modify: `src/components/HeroHeader.tsx`
- Modify: `src/app/event/[slug]/page.tsx`
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Maak de hero compacter en voeg zoeken toe**

Verlaag de desktop/mobile padding ongeveer één spacingstap (`pt-28 pb-14`, `sm:pt-32 sm:pb-20`), houd de `h1` en propositie intact en voeg als eerste form-control een zoekinput `name="q"`, label “Zoek op event, sauna of plaats” toe. Het GET-formulier blijft zonder JavaScript werken.

- [ ] **Step 2: Voeg voorzichtige actualiteitsmicrocopy toe**

Plaats onder de event-CTA: “Programma en tijden kunnen wijzigen. Controleer de actuele informatie op de website van de sauna.” Houd de bestaande externe-destinatiemelding en verzin geen laatste-updatetijd.

- [ ] **Step 3: Installeer uitsluitend lint-devDependencies**

Run: `npm install --save-dev eslint@^9 eslint-config-next@^15.5.0`

Expected: `package.json` en `package-lock.json` wijzigen; geen productie-dependency wordt toegevoegd.

- [ ] **Step 4: Voeg flat ESLint-config en niet-interactief script toe**

Maak `eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "next-env.d.ts", "tsconfig.tsbuildinfo"]),
]);
```

Wijzig het script naar `"lint": "eslint ."`.

- [ ] **Step 5: Draai lint, tests en typecheck; los alleen relevante meldingen op**

Run: `npm run lint && npm test && npx tsc --noEmit`

Expected: alle drie exit 0. Pas alleen bestanden binnen deze polish-pass aan wanneer lint een fout vindt; noteer bestaande waarschuwingen die veilig buiten scope blijven.

- [ ] **Step 6: Commit polish en tooling**

```bash
git add src/components/HeroHeader.tsx src/app/event/'[slug]'/page.tsx eslint.config.mjs package.json package-lock.json
git commit -m "chore: rond betrouwbaarheid en lintbasis af"
```

### Task 6: Productiebuild en browservalidatie

**Files:**
- Modify only if verification exposes a scoped regression.

- [ ] **Step 1: Draai volledige geautomatiseerde validatie**

Run: `npm run lint && npm test && npx tsc --noEmit && npm run build`

Expected: exit 0; Next genereert homepage, agenda, maand-, provincie-, event-, sauna-, robots- en sitemaproutes zonder errors.

- [ ] **Step 2: Start de productieversie lokaal**

Run: `npm run start`

Expected: server luistert op `http://localhost:3000`.

- [ ] **Step 3: Controleer kernroutes en URL-state**

Controleer `/`, `/agenda`, een event, een sauna, `/bestaat-niet`, `/robots.txt` en `/sitemap.xml`. Combineer `q`, land, provincie, type, `van` en `tot`; verwijder ieder filter afzonderlijk; gebruik browser terug/vooruit en deel de uiteindelijke URL. Expected: geen reloadsprongen, juiste aantallen, bruikbare lege/foutstaat en echte 404.

- [ ] **Step 4: Controleer toetsenbord en mobiel menu**

Gebruik alleen Tab, Shift+Tab, Enter en Escape. Expected: skiplink zichtbaar bij focus; menu opent/sluit, focus verhuist/herstelt, body scrollt niet achter het open menu en elke control heeft een zichtbare focusring.

- [ ] **Step 5: Controleer alle gevraagde breedtes**

Test 320, 375, 390, 430, 768, 1024, 1280 en 1440 px. Expected: geen horizontale pagina-overflow, afgesneden labels, overlappende sticky header of onbereikbare controls; agenda wisselt logisch tussen compacte kaart en horizontale rij.

- [ ] **Step 6: Controleer console, metadata en structured data**

Expected: geen console-/hydrationerrors; canonicals, unieke titels/descriptions, robots en sitemap blijven intact; Event-JSON-LD bevat geen `organizer`, `offers`, `availability` of fictieve prijs.

- [ ] **Step 7: Leg eventuele verificatiefix vast en controleer eindstatus**

Na een noodzakelijke kleine fix: herhaal de relevante commandoset en commit met `fix: herstel regressie uit polish-validatie`. Controleer daarna `git status --short` en laat uitsluitend bedoelde wijzigingen zien.

## Self-review

- Spec coverage: datum/tijd, zoeken/filters, compacte resultaten, mobiel menu, accessibility, SEO/schema, performance, betrouwbaarheid, 404, lint en volledige validatie hebben ieder een concrete taak.
- Scope: geen database, scraper, productiecontent, routewijziging, auth, tracking of runtime-dependency.
- Type consistency: `q`, `todayISOInTimeZone`, `validateDateRange`, `AgendaEventCard` en de error-prop worden één keer gedefinieerd en later met dezelfde naam gebruikt.
- Placeholder scan: geen open invulmarkeringen of ongedefinieerde vervolgstappen.
