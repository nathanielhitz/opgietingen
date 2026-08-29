# Keystatic-beheerpaneel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concepts beoordelen, sauna-profielen en `bronnen.json` bewerken in de browser via Keystatic op `opgietingen.nl/keystatic`, waarbij git de bron van waarheid blijft en elke save een commit op `main` is.

**Architecture:** `keystatic.config.ts` (repo-root) beschrijft vier ingangen die 1-op-1 op de bestaande frontmatter passen: collecties `events`, `saunas`, `gidsen` (MDX met frontmatter, `format.contentField`) en singleton `bronnen` (JSON). Het paneel en zijn API-route komen onder `src/app/keystatic` en `src/app/api/keystatic`. Omdat de root-layout nu header/footer om álles rendert, verhuizen de publieke routes naar een route group `src/app/(site)/` met een eigen layout, zodat het paneel een kale pagina krijgt. Storage is `github` wanneer `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` gezet is, anders `local` (dev zonder GitHub App). Loader, scraper en scripts veranderen niet.

**Tech Stack:** Next.js 15 App Router, `@keystatic/core` 0.6.x + `@keystatic/next` 5.x (peer deps dekken Next ≥14, React 18/19), `node:test` via tsx voor unit-tests, GitHub App voor auth.

**Spec:** [docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md](../specs/2026-08-29-keystatic-beheerpaneel-design.md)

---

## Afwijkingen van de spec (bewust, ontdekt tijdens planning)

1. **`keurNotitie` en `laatstGecontroleerd` zijn niet alleen-lezen.** Keystatic kent geen read-only veld; het alternatief `fields.ignored()` verbergt het veld volledig, maar de keurnotitie is juist de informatie waarop je een concept beoordeelt. Daarom: gewoon tekstveld met een beschrijving die zegt dat je het laat staan.
2. **`eigenProduct` is een tekstveld**, geen checkbox: het bevat de slug van een merch-product (`saunahoed`), zie `src/lib/content.ts:103`.
3. **Route group `(site)`** was niet voorzien in de spec, maar nodig: de root-layout rendert `SiteHeader`/`SiteFooter` om elke route, dus ook om het paneel. Verplaatsing is een `git mv` zonder code-wijzigingen (er zijn geen relatieve imports in `src/app`).
4. **`titel`/`naam` worden `fields.slug`-velden** en het frontmatter-veld `slug` wordt `fields.ignored()`: Keystatic bepaalt de bestandsnaam via `slugField`, en `fields.slug` is het enige veldtype dat de leesbare tekst óók in de frontmatter wegschrijft. Bestaande `slug:`-regels blijven bewaard; nieuwe entries krijgen geen `slug:`-regel, en de loader valt dan terug op de bestandsnaam (`src/lib/content.ts:178`).
5. **Bronnen-`provincie` is een tekstveld** (één bron heeft `""`, en de waarden volgen niet exact `PROVINCES`); bronnen-`land` heeft ook de optie `NL/BE`.

## Bestandsstructuur

| Bestand | Verantwoordelijkheid |
|---|---|
| `keystatic.config.ts` (nieuw, root) | Storage-keuze, ui-branding, de vier schema's. Exporteert ook `bronVelden` voor de dekkingstest. |
| `src/app/layout.tsx` (aanpassen) | Alleen nog `<html>`/`<body>`, fonts, metadata, Analytics. Geen chrome. |
| `src/components/SiteChrome.tsx` (nieuw) | Skip-link + `SiteHeader` + `<main>` + `SiteFooter`. Gebruikt door de site-layout en de 404. |
| `src/app/(site)/layout.tsx` (nieuw) | Rendert `SiteChrome` om alle publieke routes. |
| `src/app/(site)/**` (verhuisd) | Alle publieke pagina's; ongewijzigd. |
| `src/app/not-found.tsx` (aanpassen) | Wikkelt zichzelf in `SiteChrome` (de globale 404 valt buiten de route group). |
| `src/app/keystatic/keystatic.tsx` (nieuw) | `"use client"`, `makePage(config)`. |
| `src/app/keystatic/layout.tsx` (nieuw) | Rendert het paneel; `metadata.robots = noindex`. |
| `src/app/keystatic/[[...params]]/page.tsx` (nieuw) | Lege pagina (Keystatic vereist de route). |
| `src/app/api/keystatic/[...params]/route.ts` (nieuw) | `makeRouteHandler({ config })`. |
| `src/app/robots.ts` (aanpassen) | Disallow `/keystatic`, `/api/keystatic`. |
| `scripts/lib/keystatic-schema.test.ts` (nieuw) | Dekkingstest: elk frontmatter-veld in de content bestaat in het schema. |
| `scripts/lib/beheer-routes.test.ts` (nieuw) | robots bevat de disallows; sitemap bevat geen beheer-URL's. |
| `.env.example`, `CLAUDE.md` (aanpassen) | Env-vars en sectie *Beheer (Keystatic)*. |

---

### Task 1: Packages installeren

**Files:**
- Modify: `package.json`, `package-lock.json`

- [x] **Step 1: Installeer Keystatic**

Run: `npm install @keystatic/core@^0.6.9 @keystatic/next@^5.0.5`
Expected: geen peer-dependency-fouten; `package.json` bevat beide onder `dependencies`.

- [x] **Step 2: Controleer dat de build nog slaagt**

Run: `npm run build`
Expected: `✓ Compiled successfully`, geen fouten.

- [x] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): keystatic toegevoegd voor het beheerpaneel"
```

---

### Task 2: Publieke routes naar route group `(site)`

De root-layout rendert nu header, `<main>` en footer om elke route. Keystatic moet een kale pagina krijgen, dus de chrome verhuist naar een route group.

**Files:**
- Create: `src/components/SiteChrome.tsx`
- Create: `src/app/(site)/layout.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/not-found.tsx`
- Move: publieke route-mappen en `src/app/page.tsx` → `src/app/(site)/`

- [x] **Step 1: Maak `SiteChrome`**

```tsx
// src/components/SiteChrome.tsx
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/*
  De publieke "chrome" van de site: skip-link, header, main en footer.
  Wordt gebruikt door de (site)-layout én door de globale 404 (die buiten de
  route group valt). Het beheerpaneel (/keystatic) gebruikt dit bewust niet.
*/
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#hoofdinhoud" className="skip-link">
        Ga naar de hoofdinhoud
      </a>
      <SiteHeader />
      <main id="hoofdinhoud" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
```

- [x] **Step 2: Versimpel de root-layout**

Vervang in `src/app/layout.tsx` de imports van `SiteHeader`/`SiteFooter` en de body-inhoud:

```tsx
// src/app/layout.tsx — imports: verwijder SiteHeader en SiteFooter, de rest blijft.
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { site } from "@/lib/site";
import "./globals.css";

// ... fonts en metadata ongewijzigd ...

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- [x] **Step 3: Maak de site-layout**

```tsx
// src/app/(site)/layout.tsx
import { SiteChrome } from "@/components/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
```

- [x] **Step 4: Verhuis de publieke routes**

```bash
mkdir -p "src/app/(site)"
git mv src/app/page.tsx "src/app/(site)/page.tsx"
for d in agenda aufguss-kampioenschappen contact cookiebeleid event gids opgietingen opgietweekenden over privacybeleid sauna saunahoed saunas voor-saunas wat-is-een-opgieting; do
  git mv "src/app/$d" "src/app/(site)/$d"
done
```

Blijven in `src/app/`: `layout.tsx`, `globals.css`, `not-found.tsx`, `robots.ts`, `sitemap.ts`, `feed.xml/`, `agenda.ics/`, `uit/` (route handlers, geen layout nodig), `icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx`.

- [x] **Step 5: Controleer op relatieve imports die door de verhuizing breken**

Run: `grep -rn "from \"\.\.\?/" "src/app/(site)"`
Expected: geen uitvoer (er waren er geen; alles gebruikt `@/`). Levert het wél regels op, zet die imports om naar `@/…`.

- [x] **Step 6: Wikkel de globale 404 in de chrome**

Pas `src/app/not-found.tsx` aan: importeer `SiteChrome` en wikkel de bestaande `<div …>` erin.

```tsx
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";

// De globale 404 valt buiten de (site)-route group en krijgt de chrome daarom zelf.
export default function NotFound() {
  return (
    <SiteChrome>
      <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-16 sm:px-6 sm:py-24">
        {/* bestaande inhoud ongewijzigd */}
      </div>
    </SiteChrome>
  );
}
```

- [x] **Step 7: Build, lint en tests**

Run: `npm run build && npm run lint && npm test`
Expected: build slaagt met dezelfde routes als voorheen (controleer in de route-lijst dat `/`, `/agenda`, `/event/[slug]`, `/sauna/[slug]`, `/gids/[slug]`, `/uit/[slug]`, `/robots.txt`, `/sitemap.xml` er staan); lint schoon; alle tests groen.

- [x] **Step 8: Steekproef in de dev-server**

Run: `npm run dev` en open `http://localhost:3000/`, `/agenda`, `/saunas`, en een niet-bestaande URL zoals `/bestaat-niet`.
Expected: header en footer zichtbaar op alle vier; 404-pagina toont de bestaande tekst met header/footer.

- [x] **Step 9: Commit**

```bash
git add -A src/app src/components/SiteChrome.tsx
git commit -m "refactor(app): publieke routes in route group (site), chrome uit de root-layout

Voorbereiding op het beheerpaneel: /keystatic moet zonder header/footer
renderen. Geen functionele wijziging voor bezoekers."
```

---

### Task 3: `keystatic.config.ts` met de vier schema's

**Files:**
- Create: `keystatic.config.ts`

- [x] **Step 1: Schrijf de config**

```ts
// keystatic.config.ts
// Schema's voor het beheerpaneel. Elke ingang is 1-op-1 op de bestaande
// frontmatter/JSON, zodat loader (src/lib/content.ts) en scripts niets merken.
// Spec: docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md
import { config, fields, collection, singleton } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { EVENT_TYPES, PROVINCES } from "./src/lib/site";

// GitHub-mode zodra de GitHub App geconfigureerd is (NEXT_PUBLIC_ zodat de
// keuze ook client-side bekend is); anders local-mode voor `npm run dev`.
const githubAppSlug = process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG;

const alleProvincies = [...PROVINCES.NL, ...PROVINCES.BE].map((p) => ({ label: p, value: p }));

const eventTypeOpties = Object.entries(EVENT_TYPES).map(([value, label]) => ({ label, value }));

const padVeld = (label: string, voorbeeld: string) =>
  fields.text({
    label,
    description: `Pad onder public/, bv. ${voorbeeld}. Geen upload: beelden plaats je in de repo (zie docs/image-prompts.md).`,
  });

/** Velden van één bron in content/bronnen.json. Los geëxporteerd voor de dekkingstest. */
export const bronVelden = {
  id: fields.text({
    label: "Id (= saunaSlug)",
    description: "Koppelt gescrapete events aan het sauna-profiel met dezelfde slug.",
    validation: { isRequired: true },
  }),
  naam: fields.text({ label: "Naam", validation: { isRequired: true } }),
  land: fields.select({
    label: "Land",
    options: [
      { label: "Nederland", value: "NL" },
      { label: "België", value: "BE" },
      { label: "NL/BE (keten)", value: "NL/BE" },
    ],
    defaultValue: "NL",
  }),
  provincie: fields.text({ label: "Provincie" }),
  website: fields.url({ label: "Website" }),
  facebook: fields.url({
    label: "Facebook-pagina",
    description: "Matching-anker voor doorgestuurde posts én bron voor scrape-facebook.",
  }),
  agendaUrl: fields.url({ label: "Agenda-URL", validation: { isRequired: true } }),
  agendaUrlVast: fields.checkbox({
    label: "Agenda-URL vast",
    description: "Aan = verify-bronnen doet geen discovery/herschrijving meer voor deze bron.",
  }),
  type: fields.select({
    label: "Type",
    options: [
      { label: "Website", value: "website" },
      { label: "Handmatig", value: "handmatig" },
      { label: "Nieuwsbrief", value: "nieuwsbrief" },
    ],
    defaultValue: "website",
  }),
  matchToken: fields.text({
    label: "Match-token",
    description: "Alleen voor het mailkanaal: e-mailadres of domein van de afzender als dat afwijkt van de website.",
  }),
  status: fields.select({
    label: "Status",
    options: [
      { label: "actief", value: "actief" },
      { label: "te-verifieren", value: "te-verifieren" },
      { label: "geen-agenda", value: "geen-agenda" },
      { label: "handmatig", value: "handmatig" },
      { label: "aanvullen", value: "aanvullen" },
      { label: "opzetten", value: "opzetten" },
      { label: "kapot", value: "kapot" },
    ],
    defaultValue: "te-verifieren",
  }),
  notities: fields.text({ label: "Notities", multiline: true }),
  laatstGecontroleerd: fields.text({
    label: "Laatst gecontroleerd",
    description: "Wordt door verify-bronnen gezet; hier alleen ter informatie, niet aanpassen.",
  }),
};

export default config({
  storage: githubAppSlug
    ? { kind: "github", repo: "nathanielhitz/opgietingen" }
    : { kind: "local" },

  ui: {
    brand: { name: "Opgietingen.nl · beheer" },
    navigation: {
      Content: ["events", "saunas", "gidsen"],
      Scraper: ["bronnen"],
    },
  },

  collections: {
    events: collection({
      label: "Events",
      path: "content/events/*",
      slugField: "titel",
      format: { contentField: "body" },
      columns: ["titel", "saunaSlug", "startDatum", "status"],
      schema: {
        titel: fields.slug({
          name: { label: "Titel", validation: { isRequired: true } },
          slug: {
            label: "Slug (bestandsnaam)",
            description: "Scraper-conventie: <sauna>-<titel>-<startdatum>. Niet wijzigen bij bestaande events (URL).",
          },
        }),
        slug: fields.ignored(),
        saunaSlug: fields.relationship({
          label: "Sauna",
          collection: "saunas",
          validation: { isRequired: true },
        }),
        type: fields.select({ label: "Type", options: eventTypeOpties, defaultValue: "thema" }),
        startDatum: fields.date({ label: "Startdatum", validation: { isRequired: true } }),
        eindDatum: fields.date({ label: "Einddatum" }),
        tijden: fields.text({ label: "Tijden", description: "Bv. 10:00–22:00" }),
        prijsIndicatie: fields.text({ label: "Prijsindicatie", description: "Bv. Vanaf € 49,50" }),
        ticketUrl: fields.url({
          label: "Ticket-URL",
          description: "Bezoekers gaan hierheen via /uit/<slug>. Gebruik deze link ook om het event zelf te controleren.",
        }),
        afbeelding: padVeld("Afbeelding", "/images/events/naam.jpg"),
        status: fields.select({
          label: "Status",
          description: "Alleen 'gepubliceerd' is zichtbaar op de site. Afwijzen = op concept laten of op afgelopen zetten; niet verwijderen (de scraper maakt het anders opnieuw aan).",
          options: [
            { label: "Concept (onzichtbaar)", value: "concept" },
            { label: "Gepubliceerd", value: "gepubliceerd" },
            { label: "Afgelopen", value: "afgelopen" },
          ],
          defaultValue: "concept",
        }),
        bron: fields.select({
          label: "Bron",
          options: [
            { label: "Scraper", value: "scraper" },
            { label: "Handmatig", value: "handmatig" },
          ],
          defaultValue: "handmatig",
        }),
        keurNotitie: fields.text({
          label: "Keurnotitie (kwaliteitspoort)",
          multiline: true,
          description: "Waarom de scraper dit event als concept liet staan. Laat staan als historie; publiceren doe je via Status.",
        }),
        body: fields.mdx({ label: "Beschrijving / programma" }),
      },
    }),

    saunas: collection({
      label: "Sauna's",
      path: "content/saunas/*",
      slugField: "naam",
      format: { contentField: "body" },
      columns: ["naam", "plaats", "provincie", "roosterGecheckt"],
      schema: {
        naam: fields.slug({
          name: { label: "Naam", validation: { isRequired: true } },
          slug: { label: "Slug (bestandsnaam)", description: "Niet wijzigen bij bestaande sauna's: events koppelen hierop." },
        }),
        slug: fields.ignored(),
        land: fields.select({
          label: "Land",
          options: [
            { label: "Nederland", value: "NL" },
            { label: "België", value: "BE" },
          ],
          defaultValue: "NL",
        }),
        provincie: fields.select({ label: "Provincie", options: alleProvincies, defaultValue: "Gelderland" }),
        plaats: fields.text({ label: "Plaats", validation: { isRequired: true } }),
        adres: fields.text({ label: "Adres", validation: { isRequired: true } }),
        lat: fields.number({ label: "Latitude", validation: { isRequired: true, min: 49, max: 54 } }),
        lng: fields.number({ label: "Longitude", validation: { isRequired: true, min: 2, max: 8 } }),
        faciliteiten: fields.array(fields.text({ label: "Faciliteit" }), {
          label: "Faciliteiten",
          itemLabel: (props) => props.value,
        }),
        website: fields.url({ label: "Website" }),
        affiliateUrl: fields.url({
          label: "Affiliate-URL",
          description: "Doel van /uit/<slug>. Nooit direct vanaf de site linken.",
          validation: { isRequired: true },
        }),
        sponsored: fields.checkbox({ label: "Gesponsord" }),
        afbeelding: padVeld("Afbeelding", "/images/saunas/naam.jpg"),
        logo: padVeld("Logo", "/images/logos/naam.png"),
        logoAchtergrond: fields.select({
          label: "Logo-achtergrond",
          description: "Witte logovarianten hebben 'donker' nodig.",
          options: [
            { label: "Licht", value: "licht" },
            { label: "Donker", value: "donker" },
          ],
          defaultValue: "licht",
        }),
        opgietRooster: fields.array(
          fields.object({
            dag: fields.text({ label: "Dag", description: "Bv. 'za & zo' of 'dagelijks'" }),
            tijden: fields.text({ label: "Tijden", description: "Letterlijk zoals op de sauna-website." }),
          }),
          { label: "Vast opgietrooster", itemLabel: (props) => props.fields.dag.value },
        ),
        roosterGecheckt: fields.date({
          label: "Rooster gecheckt op",
          description: "Wordt door check-roosters bijgewerkt; handmatig zetten na een eigen controle mag.",
        }),
        roosterBron: fields.url({
          label: "Rooster-bron",
          description: "Pagina waar het rooster letterlijk staat, als dat niet de agenda-URL is.",
        }),
        body: fields.mdx({ label: "Beschrijving" }),
      },
    }),

    gidsen: collection({
      label: "Gidsen",
      path: "content/gidsen/*",
      slugField: "titel",
      format: { contentField: "body" },
      columns: ["titel", "bijgewerkt"],
      entryLayout: "content",
      schema: {
        titel: fields.slug({
          name: { label: "Titel", validation: { isRequired: true } },
          slug: { label: "Slug (URL)", description: "Niet wijzigen bij bestaande gidsen." },
        }),
        slug: fields.ignored(),
        samenvatting: fields.text({ label: "Samenvatting", multiline: true, validation: { isRequired: true } }),
        afbeelding: padVeld("Afbeelding", "/images/gidsen/naam.jpg"),
        bijgewerkt: fields.date({ label: "Bijgewerkt op" }),
        eigenProduct: fields.text({
          label: "Eigen product (merch-slug)",
          description: "Slug uit content/merch, bv. 'saunahoed'. Wordt bovenaan uitgelicht.",
        }),
        producten: fields.array(
          fields.object({
            id: fields.text({ label: "Id", description: "Globaal uniek; gebruikt in /uit/product/<id>.", validation: { isRequired: true } }),
            naam: fields.text({ label: "Naam", validation: { isRequired: true } }),
            bolUrl: fields.url({ label: "bol.com-URL", validation: { isRequired: true } }),
            afbeelding: fields.url({ label: "Afbeelding (media.s-bol.com)" }),
            prijsIndicatie: fields.text({ label: "Prijsindicatie" }),
            beschrijving: fields.text({ label: "Beschrijving", multiline: true }),
          }),
          { label: "Affiliate-producten", itemLabel: (props) => props.fields.naam.value },
        ),
        body: fields.mdx({
          label: "Artikel",
          components: {
            Product: block({
              label: "Product",
              schema: { id: fields.text({ label: "Product-id", validation: { isRequired: true } }) },
            }),
            ProductGrid: block({ label: "Alle producten (grid)", schema: {} }),
          },
        }),
      },
    }),
  },

  singletons: {
    bronnen: singleton({
      label: "Scraper-bronnen",
      path: "content/bronnen",
      format: { data: "json" },
      schema: {
        $comment: fields.ignored(),
        laatstBijgewerkt: fields.ignored(),
        bronnen: fields.array(fields.object(bronVelden), {
          label: "Bronnen",
          itemLabel: (props) => `${props.fields.naam.value} · ${props.fields.status.value}`,
        }),
      },
    }),
  },
});
```

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: geen fouten. Faalt `validation` op `fields.slug`'s `name`, verwijder dan die `validation`-optie alleen daar (het veld is dan alsnog verplicht als slugField).

- [x] **Step 3: Commit**

```bash
git add keystatic.config.ts
git commit -m "feat(beheer): keystatic-config met schema's voor events, sauna's, gidsen en bronnen"
```

---

### Task 4: Schema-dekkingstest

Voorkomt dat een frontmatter-veld dat in de content voorkomt maar niet in het schema staat, bij een save stil verdwijnt.

**Files:**
- Create: `scripts/lib/keystatic-schema.test.ts`

- [x] **Step 1: Schrijf de test**

```ts
// scripts/lib/keystatic-schema.test.ts
// Elk veld dat in de content voorkomt moet in het Keystatic-schema staan:
// een veld dat Keystatic niet kent, schrijft het bij een save niet terug.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import keystaticConfig, { bronVelden } from "../../keystatic.config";

const ROOT = process.cwd();

function frontmatterKeys(dir: string): string[] {
  const keys = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    const { data } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of Object.keys(data)) keys.add(k);
  }
  return [...keys].sort();
}

const collecties = keystaticConfig.collections!;

for (const [naam, dir] of [
  ["events", "content/events"],
  ["saunas", "content/saunas"],
  ["gidsen", "content/gidsen"],
] as const) {
  test(`Keystatic-schema '${naam}' dekt alle frontmatter-velden in ${dir}`, () => {
    const schemaKeys = new Set(Object.keys(collecties[naam].schema));
    const ontbrekend = frontmatterKeys(path.join(ROOT, dir)).filter((k) => !schemaKeys.has(k));
    assert.deepEqual(ontbrekend, [], `velden zonder schema: ${ontbrekend.join(", ")}`);
  });
}

test("Keystatic-singleton 'bronnen' dekt alle velden in content/bronnen.json", () => {
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, "content/bronnen.json"), "utf8")) as {
    bronnen: Record<string, unknown>[];
  } & Record<string, unknown>;

  const topSchema = new Set(Object.keys(keystaticConfig.singletons!.bronnen.schema));
  const topOntbrekend = Object.keys(file).filter((k) => !topSchema.has(k));
  assert.deepEqual(topOntbrekend, [], `top-level velden zonder schema: ${topOntbrekend.join(", ")}`);

  const bronSchema = new Set(Object.keys(bronVelden));
  const itemKeys = new Set<string>();
  for (const b of file.bronnen) for (const k of Object.keys(b)) itemKeys.add(k);
  const itemOntbrekend = [...itemKeys].filter((k) => !bronSchema.has(k));
  assert.deepEqual(itemOntbrekend, [], `bron-velden zonder schema: ${itemOntbrekend.join(", ")}`);
});

test("Keystatic-paden wijzen naar de mappen die de loader leest", () => {
  assert.equal(collecties.events.path, "content/events/*");
  assert.equal(collecties.saunas.path, "content/saunas/*");
  assert.equal(collecties.gidsen.path, "content/gidsen/*");
  assert.equal(keystaticConfig.singletons!.bronnen.path, "content/bronnen");
});
```

- [x] **Step 2: Draai de test**

Run: `node --import tsx --test scripts/lib/keystatic-schema.test.ts`
Expected: 5 tests, alle `ok`. Faalt een dekkingstest met een veldnaam, voeg dat veld dan toe aan het schema in `keystatic.config.ts` (als bewerkbaar veld, of `fields.ignored()` als het door een script beheerd wordt) — niet de test versoepelen.

- [x] **Step 3: Volledige testsuite**

Run: `npm test`
Expected: alle tests groen.

- [x] **Step 4: Commit**

```bash
git add scripts/lib/keystatic-schema.test.ts keystatic.config.ts
git commit -m "test(beheer): dekkingstest — elk contentveld bestaat in het Keystatic-schema"
```

---

### Task 5: Paneel- en API-routes

**Files:**
- Create: `src/app/keystatic/keystatic.tsx`
- Create: `src/app/keystatic/layout.tsx`
- Create: `src/app/keystatic/[[...params]]/page.tsx`
- Create: `src/app/api/keystatic/[...params]/route.ts`

- [x] **Step 1: Client-component met het paneel**

```tsx
// src/app/keystatic/keystatic.tsx
"use client";
import { makePage } from "@keystatic/next/ui/app";
import config from "../../../keystatic.config";

export default makePage(config);
```

- [x] **Step 2: Layout met noindex**

```tsx
// src/app/keystatic/layout.tsx
import type { Metadata } from "next";
import KeystaticApp from "./keystatic";

// Beheerpaneel: geen site-chrome, nooit indexeren (ook in robots.ts uitgesloten).
export const metadata: Metadata = {
  title: "Beheer",
  robots: { index: false, follow: false },
};

export default function KeystaticLayout() {
  return <KeystaticApp />;
}
```

- [x] **Step 3: Lege pagina (Keystatic vereist de route)**

```tsx
// src/app/keystatic/[[...params]]/page.tsx
export default function KeystaticPage() {
  return null;
}
```

- [x] **Step 4: API-route**

```ts
// src/app/api/keystatic/[...params]/route.ts
import { makeRouteHandler } from "@keystatic/next/route-handler";
import config from "../../../../../keystatic.config";

export const { POST, GET } = makeRouteHandler({ config });
```

- [x] **Step 5: Build**

Run: `npm run build`
Expected: slaagt; de route-lijst bevat `/keystatic/[[...params]]` en `/api/keystatic/[...params]` (dynamisch, ƒ).

- [x] **Step 6: Paneel openen in local-mode**

Run: `npm run dev`, open `http://127.0.0.1:3000/keystatic`.
Expected: Keystatic-dashboard met brand "Opgietingen.nl · beheer", navigatie *Content* (Events, Sauna's, Gidsen) en *Scraper* (Scraper-bronnen). Geen site-header/footer. Events-lijst toont ~115 items met kolommen titel/sauna/startdatum/status.

- [x] **Step 7: Commit**

```bash
git add src/app/keystatic src/app/api/keystatic
git commit -m "feat(beheer): keystatic-paneel op /keystatic + api-route"
```

---

### Task 6: Robots, sitemap-test

**Files:**
- Modify: `src/app/robots.ts`
- Create: `scripts/lib/beheer-routes.test.ts`

- [x] **Step 1: Schrijf de falende test**

```ts
// scripts/lib/beheer-routes.test.ts
// Het beheerpaneel mag nooit gecrawld of in de sitemap terechtkomen.
import { test } from "node:test";
import assert from "node:assert/strict";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";

test("robots.txt sluit /keystatic en /api/keystatic uit", () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
  assert.ok(disallow.includes("/uit/"), "bestaande /uit/-regel moet blijven");
  assert.ok(disallow.includes("/keystatic"), "/keystatic ontbreekt in disallow");
  assert.ok(disallow.includes("/api/keystatic"), "/api/keystatic ontbreekt in disallow");
});

test("sitemap bevat geen beheer-URL's", () => {
  const urls = sitemap().map((e) => e.url);
  assert.ok(urls.length > 10, "sitemap lijkt leeg");
  assert.deepEqual(urls.filter((u) => u.includes("/keystatic") || u.includes("/api/")), []);
});
```

- [x] **Step 2: Draai de test — moet falen**

Run: `node --import tsx --test scripts/lib/beheer-routes.test.ts`
Expected: eerste test FAIL met "/keystatic ontbreekt in disallow"; tweede test PASS.

- [x] **Step 3: Pas robots.ts aan**

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Affiliate-redirects en het beheerpaneel niet crawlen/indexeren.
      disallow: ["/uit/", "/keystatic", "/api/keystatic"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
```

- [x] **Step 4: Draai de test — moet slagen**

Run: `node --import tsx --test scripts/lib/beheer-routes.test.ts`
Expected: 2 tests `ok`.

- [x] **Step 5: Controleer de gegenereerde robots.txt**

Run: `npm run build && npm run start` en `curl -s http://localhost:3000/robots.txt`
Expected:
```
User-Agent: *
Allow: /
Disallow: /uit/
Disallow: /keystatic
Disallow: /api/keystatic
```

- [x] **Step 6: Commit**

```bash
git add src/app/robots.ts scripts/lib/beheer-routes.test.ts
git commit -m "feat(seo): beheerpaneel uitgesloten in robots.txt, met test op robots en sitemap"
```

---

### Task 7: Round-trip-verificatie in local-mode (go/no-go gidsen)

Keystatic heeft geen publieke writer-API, dus de round-trip loopt via het paneel zelf. Werk op een schone working tree zodat `git diff` alleen Keystatic's wijzigingen toont.

**Files:** geen codewijzigingen; mogelijk `keystatic.config.ts` (bij no-go).

- [x] **Step 1: Schone start**

Run: `git status --short`
Expected: geen uitvoer. Start daarna `npm run dev`.

- [x] **Step 2: Round-trip event**

Open in `/keystatic` → Events het concept `asanti-nationale-saunaweek-asanti-2026-09-14`. Wijzig alleen *Tijden* naar `10:00–22:00`, Save.
Run: `git diff content/events/asanti-nationale-saunaweek-asanti-2026-09-14.mdx`
Expected: diff toont de nieuwe `tijden`-regel; frontmatter-volgorde/quoting mag veranderen; **body-tekst is inhoudelijk identiek** (geen ontbrekende zinnen, geen geëscapete tekens die voorheen niet geëscaped waren, `keurNotitie` nog aanwezig, `slug` nog aanwezig, `bron: scraper` nog aanwezig). Draai `git checkout content/events/` na inspectie.

- [x] **Step 3: Round-trip sauna**

Open Sauna's → `elaisa-wellness`. Wijzig *Rooster gecheckt op* naar vandaag, Save.
Run: `git diff content/saunas/elaisa-wellness.mdx`
Expected: `roosterGecheckt` gewijzigd; `faciliteiten` (6 items) en `opgietRooster` (1 regel met `dag`/`tijden`) compleet; body met drie `##`-kopjes en het `**meerdere opgietingen per dag**`-vet intact. `git checkout content/saunas/`.

- [x] **Step 4: Round-trip gidsen — go/no-go**

Voor **elke** gids in `content/gidsen/` (10 stuks): open, zet *Bijgewerkt op* op vandaag, Save.
Run: `git diff --stat content/gidsen/ && git diff content/gidsen/ | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v 'bijgewerkt' | grep -vE '^[-+]\s*$' | head -80`
Expected (**go**): de overgebleven regels zijn alleen frontmatter-herordening, verwijderde `#`-commentaarregels (gaan verloren — acceptabel) en quoting-verschillen. Elke `<Product id="…" />` en `<ProductGrid />` staat nog op zijn plek, tabellen/lijsten zijn compleet.
**No-go** als een gids een lege body krijgt, componenten verliest, of Keystatic bij openen een parse-fout toont ("HTML tags not supported" e.d.).

- [x] **Step 5a (go): commit de bijgewerkt-datums? Nee — herstel**

Run: `git checkout content/`
Expected: schone tree. De echte eerste saves gebeuren straks via GitHub-mode.

- [x] **Step 5b (no-go): gidsen buiten het paneel**

Verwijder in `keystatic.config.ts` de hele `gidsen: collection({...})` en de `"gidsen"` uit `ui.navigation.Content`. Verwijder in `scripts/lib/keystatic-schema.test.ts` de regel `["gidsen", "content/gidsen"],` en in de paden-test de `gidsen`-assert. Herstel content: `git checkout content/`.
Run: `npm test && npm run build`
Expected: groen.
```bash
git add keystatic.config.ts scripts/lib/keystatic-schema.test.ts
git commit -m "feat(beheer): gidsen buiten het paneel — MDX-round-trip niet schoon (zie plan Task 7)"
```

- [x] **Step 6: Noteer de uitkomst**

Voeg onder de spec-sectie *5. Samenleven met de scraper* één regel toe: `**Uitkomst round-trip (datum):** gidsen go/no-go, met reden.` Commit: `git commit -am "docs(spec): uitkomst round-trip-verificatie vastgelegd"`.

---

### Task 8: Env-voorbeeld en CLAUDE.md

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [x] **Step 1: Env-vars documenteren**

Voeg onderaan `.env.example` toe:

```bash

# Beheerpaneel (Keystatic, /keystatic). Zonder deze vier draait het paneel in
# local-mode (bewerkt bestanden op schijf, jij commit zelf). Met alle vier in
# GitHub-mode: login via GitHub, elke save = commit op main. Aanmaken via
# /keystatic in de dev-server (knop "Create GitHub App"); daarna ook op Vercel.
# KEYSTATIC_GITHUB_CLIENT_ID=
# KEYSTATIC_GITHUB_CLIENT_SECRET=
# KEYSTATIC_SECRET=
# NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=
```

- [x] **Step 2: CLAUDE.md — projectstructuur en nieuwe sectie**

In het blok *Projectstructuur* onder `src/app/`:
```
  app/              # App Router routes (zie hieronder); publieke routes in (site)/ met de site-chrome, /keystatic ernaast
```
Voeg na de sectie *Content-scraper (pipeline)* toe (vóór *Commando's*):

```markdown
## Beheer (Keystatic)

`/keystatic` is het beheerpaneel: concepts beoordelen, sauna-profielen en `content/bronnen.json` bewerken in de browser. Git blijft de bron van waarheid — elke save is een commit op `main` onder het GitHub-account van de ingelogde gebruiker (GitHub-mode), Vercel deployt daarna. Schema's staan in `keystatic.config.ts` en zijn 1-op-1 op de frontmatter; `scripts/lib/keystatic-schema.test.ts` bewaakt dat elk contentveld in het schema staat (een onbekend veld zou bij een save verdwijnen). Toegang = schrijfrecht op de repo. Zonder de `KEYSTATIC_*`-env-vars draait het paneel in local-mode (`npm run dev`, bewerkt bestanden op schijf).

Gebruiksregels:
- **Concepts niet verwijderen.** Dedup werkt op `saunaSlug + startDatum`; een verwijderd concept komt de volgende run terug. Afwijzen = op `concept` laten of op `afgelopen` zetten.
- `keurNotitie` laten staan (historie); publiceren gaat via `status`.
- Slugs van bestaande events/sauna's/gidsen niet wijzigen (URL's en koppelingen).
- Machine-velden (`laatstGecontroleerd`, `roosterGecheckt`) worden door de scripts gezet; handmatig zetten mag na een eigen controle.
- Beelden niet via het paneel: pad invullen, bestand in `public/images/` plaatsen (zie `docs/image-prompts.md`).
- De eerste save op een bestaand bestand geeft een cosmetische frontmatter-diff (volgorde/quoting) en verwijdert `#`-commentaarregels uit de frontmatter; dat is verwacht.

Het paneel staat in `robots.ts` op disallow, niet in de sitemap, en de layout zet `noindex`. Publieke routes staan in `src/app/(site)/` (met `SiteChrome`); het paneel valt daarbuiten en rendert zonder header/footer. Spec: [docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md](docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md).
```

Pas de gidsen-alinea aan als Task 7 op no-go uitkwam ("Gidsen vallen buiten het paneel: …").

- [x] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: beheerpaneel (Keystatic) gedocumenteerd in CLAUDE.md en .env.example"
```

---

### Task 9: GitHub App, Vercel-env en acceptatie (handmatig, door Nathaniel)

**Files:** `.env` (lokaal, gitignored); Vercel-projectinstellingen.

- [x] **Step 1: Push de branch/main**

Run: `git push origin main`
Expected: Vercel-deploy slaagt; `https://opgietingen.nl/keystatic` toont het paneel in local-mode-weergave (kan nog niets opslaan op Vercel — read-only filesystem; dat is verwacht).

- [x] **Step 2: GitHub App aanmaken**

Run lokaal: `npm run dev`, open `http://127.0.0.1:3000/keystatic`. Omdat `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` nog leeg is, draait het paneel local. Zet tijdelijk in `.env`: `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=setup` en herstart; het paneel toont nu de GitHub-login met de knop **Create GitHub App**. Vul als deployed URL `https://opgietingen.nl` in, naam bv. `opgietingen-beheer`. Volg de flow; installeer de app op alleen `nathanielhitz/opgietingen`.
Expected: Keystatic schrijft de vier `KEYSTATIC_*`-regels naar `.env` (vervangt de tijdelijke slug). Herstart de dev-server; je bent ingelogd in GitHub-mode (branch-dropdown zichtbaar).

- [x] **Step 3: Callback-URL's controleren**

Open `https://github.com/settings/apps/<app-slug>` → *Callback URLs*.
Expected: bevat `https://opgietingen.nl/api/keystatic/github/oauth/callback` en `http://127.0.0.1:3000/api/keystatic/github/oauth/callback`. Ontbreekt de productie-URL, voeg toe via *Add Callback URL* en Save.

- [x] **Step 4: Env-vars op Vercel**

Vercel → project → Settings → Environment Variables: voeg de vier vars toe voor **Production** én **Preview** (`KEYSTATIC_GITHUB_CLIENT_SECRET` en `KEYSTATIC_SECRET` als Sensitive). Redeploy (Deployments → ⋯ → Redeploy).
Expected: `https://opgietingen.nl/keystatic` toont *Log in with GitHub*; inloggen lukt met het account dat schrijfrecht heeft.

- [x] **Step 5: Acceptatie — concept publiceren**

In het live paneel: Events → kies één concept dat je inhoudelijk goedkeurt → *Status* op *Gepubliceerd* → Save.
Expected: commit op `main` door jouw GitHub-account met het gewijzigde bestand (`git pull && git log -1 --stat`); Vercel deployt; na ~2 min staat het event op `/agenda`.

- [x] **Step 6: Acceptatie — sauna en bron**

Sauna's → wijzig één veld (bv. een faciliteit toevoegen) → Save. Scraper-bronnen → zet bij één bron *Notities* aan → Save.
Expected: twee commits; `npm run verify-bronnen -- --dry-run` (of `npm run bronnen-report`) leest `bronnen.json` zonder fouten; `npm test` groen na `git pull`.

- [x] **Step 7: Afronden**

Run: `git pull && npm test && npm run build`
Expected: groen. Werk `docs/superpowers/plans/2026-08-29-keystatic-beheerpaneel.md` bij: alle vakjes aangevinkt; commit `docs(plan): keystatic-beheerpaneel afgerond`.

---

## Self-review

- **Spec-dekking:** §3 architectuur → Tasks 3, 5 (+ Task 2 voor de kale pagina); §4 schema's → Task 3 + dekkingstest Task 4; §5 round-trip/go-no-go → Task 7, gebruiksregel → CLAUDE.md Task 8; §6 GitHub App/env/autorisatie → Tasks 8–9; §7 verificatie 1–4 → Tasks 4, 6, 7, 9. SEO-hygiëne (robots/sitemap/noindex) → Tasks 5–6.
- **Placeholders:** geen; elk codeblok is compleet, elk commando heeft een verwachte uitkomst.
- **Consistentie:** `bronVelden` wordt geëxporteerd in Task 3 en geïmporteerd in Task 4; `SiteChrome` uit Task 2 wordt in de 404 en `(site)/layout.tsx` gebruikt; env-var-namen zijn overal gelijk aan wat Keystatic zelf genereert.
- **Bekende onzekerheid:** `validation` op `fields.slug({ name })` — Task 3 Step 2 beschrijft de fallback. Round-trip van gidsen is bewust onbeslist tot Task 7 het meet.
