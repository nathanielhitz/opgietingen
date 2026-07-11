# Fotografische hero-header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De homepage-hero krijgt een sfeervolle sauna-foto als achtergrond (liggend op desktop, staand op mobiel), met een donkere overlay zodat titel, intro en zoekbalk leesbaar blijven.

**Architecture:** De inline hero-`<section>` in `src/app/page.tsx` (regels 26-69) wordt vervangen door een nieuwe server-component `src/components/HeroHeader.tsx`. Die rendert twee `next/image`-lagen met art-direction via breakpoint-classes (staand `<md`, liggend `≥md`), een donkere gradient-overlay uit een nieuwe `hero-overlay`-utility in `globals.css`, en daaroverheen de bestaande eyebrow/titel/intro + GET-zoekformulier in lichte tekstkleuren. De sticky `SiteHeader` en alle andere pagina's blijven ongewijzigd.

**Tech Stack:** Next.js 15 (App Router) + React 19, `next/image` (eerste gebruik in de repo), Tailwind CSS v4 (`@theme` in `globals.css`), Fraunces/Inter via `next/font`.

---

## File Structure

**Nieuw:**
- `src/components/HeroHeader.tsx` — de fotografische hero-sectie (foto's + overlay + tekst + zoekformulier).
- `public/images/hero/hero-desktop.jpg` + `public/images/hero/hero-mobiel.jpg` — geoptimaliseerde foto's (aangeleverd door Nathaniel; Task 1 verkleint ze).

**Gewijzigd:**
- `src/app/globals.css` — `hero-overlay`-utility (donkere scrim) toevoegen.
- `src/app/page.tsx` — inline hero (regels 26-69) vervangen door `<HeroHeader provinces={provinces} />`.

**Ongewijzigd (bewust):** `src/components/SiteHeader.tsx`, alle andere routes, `next.config.ts` (lokale afbeeldingen vereisen geen config).

---

## Voorwaarde vóór start

Nathaniel levert twee bronfoto's aan (zeer groot: 4672×7008 staand / 7008×4672 liggend) en bevestigt de gebruiksrechten (HUUM-stockmateriaal, commercieel gebruik). Task 1 verkleint en plaatst ze. Zonder de bronbestanden kan Task 1 niet af — de rest van het plan (component, overlay, integratie) kan wél alvast, want `next/image` toont dan simpelweg een gebroken bron tot de bestanden er zijn. Coördineer de aanlevering vóór de definitieve visuele verificatie in Task 5.

---

## Task 1: Foto's optimaliseren en plaatsen

**Files:**
- Create: `/Users/nathaniel/Documents/Opgieting.nl/public/images/hero/hero-desktop.jpg`
- Create: `/Users/nathaniel/Documents/Opgieting.nl/public/images/hero/hero-mobiel.jpg`

- [ ] **Step 1: Maak de hero-map**

```bash
mkdir -p /Users/nathaniel/Documents/Opgieting.nl/public/images/hero
```

- [ ] **Step 2: Verklein de bronfoto's (max ~2400px, geoptimaliseerd JPEG)**

Ga uit van door Nathaniel aangeleverde bronbestanden `~/Downloads/hero-liggend.jpg` (liggend) en `~/Downloads/hero-staand.jpg` (staand). Gebruik `sips` (standaard op macOS) — liggend begrenzen op breedte 2400, staand op hoogte 2400:

```bash
sips --resampleWidth 2400 ~/Downloads/hero-liggend.jpg \
  --out /Users/nathaniel/Documents/Opgieting.nl/public/images/hero/hero-desktop.jpg
sips --resampleHeight 2400 ~/Downloads/hero-staand.jpg \
  --out /Users/nathaniel/Documents/Opgieting.nl/public/images/hero/hero-mobiel.jpg
```

- [ ] **Step 3: Controleer afmetingen en bestandsgrootte**

Run:
```bash
sips -g pixelWidth -g pixelHeight \
  /Users/nathaniel/Documents/Opgieting.nl/public/images/hero/hero-desktop.jpg \
  /Users/nathaniel/Documents/Opgieting.nl/public/images/hero/hero-mobiel.jpg
ls -lh /Users/nathaniel/Documents/Opgieting.nl/public/images/hero/
```
Expected: desktop ≤ 2400px breed, mobiel ≤ 2400px hoog; beide bestanden ruim onder ~1 MB (anders extra comprimeren, bv. via een export op ~80% kwaliteit).

- [ ] **Step 4: Commit**

```bash
git add public/images/hero/hero-desktop.jpg public/images/hero/hero-mobiel.jpg
git commit -m "feat(hero): geoptimaliseerde hero-foto's (desktop + mobiel)"
```

---

## Task 2: Donkere overlay-utility in globals.css

De hero-tekst wordt licht en ligt op een foto; een donkere scrim garandeert leesbaarheid. Voeg één utility toe, naast de bestaande `warmth-gradient`.

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/src/app/globals.css`

- [ ] **Step 1: Voeg de `hero-overlay`-utility toe**

Direct na het `.warmth-gradient`-blok (regels 56-61):

```css
/* Donkere scrim over de hero-foto (van onder/links) zodat lichte tekst leesbaar blijft. */
.hero-overlay {
  background-image:
    linear-gradient(to top, rgba(43, 33, 25, 0.85), rgba(43, 33, 25, 0.35) 55%, rgba(43, 33, 25, 0.15)),
    linear-gradient(to right, rgba(43, 33, 25, 0.55), transparent 60%);
}
```

> De kleur `rgba(43, 33, 25, …)` is de `--color-ink` (#2b2119) uit `@theme`, zodat de overlay in dezelfde warme tint valt.

- [ ] **Step 2: Verifieer dat de dev-build de CSS accepteert**

Run: `npm run build`
Expected: build slaagt (geen CSS-parsefouten). De utility is nog nergens gebruikt; dit bevestigt alleen geldige syntax.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(hero): hero-overlay scrim-utility"
```

---

## Task 3: `HeroHeader`-component

Extraheer de hero naar een eigen server-component. Behoud eyebrow/titel/intro en het GET-zoekformulier exact (werkt zonder JS), maar in lichte tekstkleuren op de foto. De `provinces`-lijst wordt als prop meegegeven (page.tsx heeft die al via `getProvincesWithEvents()`).

**Files:**
- Create: `/Users/nathaniel/Documents/Opgieting.nl/src/components/HeroHeader.tsx`

- [ ] **Step 1: Bekijk hoe page.tsx `provinces` en `EVENT_TYPES` gebruikt**

Run: `sed -n '1,70p' /Users/nathaniel/Documents/Opgieting.nl/src/app/page.tsx`
Expected: bevestig de vorm van `provinces` (uit `getProvincesWithEvents()`) en de `EVENT_TYPES`-import uit `@/lib/site` (object: key → label). De component moet dezelfde `<option>`-opbouw gebruiken als de huidige inline `<form>`.

- [ ] **Step 2: Schrijf de component**

Create `src/components/HeroHeader.tsx`:

```tsx
import Image from "next/image";
import { EVENT_TYPES } from "@/lib/site";

// Fotografische homepage-hero: liggende foto ≥md, staande foto <md, donkere
// scrim eroverheen, en het GET-zoekformulier naar /agenda (werkt zonder JS).
export default function HeroHeader({ provinces }: { provinces: string[] }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-wood-dark">
      {/* Foto-lagen: art-direction per breakpoint (staand mobiel, liggend desktop) */}
      <Image
        src="/images/hero/hero-mobiel.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover md:hidden"
      />
      <Image
        src="/images/hero/hero-desktop.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="hidden object-cover md:block"
      />

      {/* Donkere scrim voor leesbaarheid */}
      <div className="hero-overlay absolute inset-0" aria-hidden />

      {/* Inhoud */}
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-wider text-ember-soft">
          Opgietingen · Aufguss · NL &amp; BE
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Vind de mooiste opgietingen bij jou in de buurt
        </h1>
        <p className="mt-4 max-w-xl text-lg text-cream/85">
          Dé agenda voor opgietweekenden, thema-avonden en Aufguss-kampioenschappen in sauna&apos;s
          in Nederland en België.
        </p>

        {/* Zoekbalk: GET-form naar /agenda (werkt zonder JS) */}
        <form
          action="/agenda"
          className="mt-8 flex max-w-2xl flex-col gap-3 rounded-[--radius-card] border border-white/20 bg-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="mb-1 block px-1 text-xs font-medium text-ink-faint">Provincie</span>
            <select
              name="provincie"
              className="w-full rounded-lg border border-sand bg-cream px-3 py-2.5 text-sm text-ink focus:border-ember focus:outline-none"
            >
              <option value="">Alle provincies</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-1 block px-1 text-xs font-medium text-ink-faint">Type</span>
            <select
              name="type"
              className="w-full rounded-lg border border-sand bg-cream px-3 py-2.5 text-sm text-ink focus:border-ember focus:outline-none"
            >
              <option value="">Alle types</option>
              {Object.entries(EVENT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
          >
            Zoek opgietingen
          </button>
        </form>
      </div>
    </section>
  );
}
```

> **Belangrijk:** neem in Step 1 de exacte `<option>`-opbouw over uit de huidige `page.tsx` (regels 41-48 provincie, 52-59 type). Als de bestaande `<select>`-opties afwijken van bovenstaande (bv. andere placeholder-tekst of een gegroepeerde provincielijst per land), spiegel de bestaande markup exact i.p.v. dit voorbeeld — de zoekfunctionaliteit mag niet veranderen.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/HeroHeader.tsx
git commit -m "feat(hero): HeroHeader-component met foto's, scrim en zoekformulier"
```

---

## Task 4: `page.tsx` — inline hero vervangen

**Files:**
- Modify: `/Users/nathaniel/Documents/Opgieting.nl/src/app/page.tsx` (regels 26-69 + import)

- [ ] **Step 1: Importeer de component**

Voeg boven in `src/app/page.tsx` bij de imports toe:

```tsx
import HeroHeader from "@/components/HeroHeader";
```

- [ ] **Step 2: Vervang de inline hero-`<section>`**

Vervang het volledige blok van regel 26 (`{/* Hero — licht, met zoekbalk */}`) t/m regel 69 (`</section>`) door:

```tsx
      <HeroHeader provinces={provinces} />
```

> `provinces` bestaat al in `page.tsx` (regel ~15, uit `getProvincesWithEvents()`). Verwijder na deze wijziging géén andere imports voordat je controleert of ze elders nog gebruikt worden — `EVENT_TYPES` verhuist naar de component, dus als `page.tsx` `EVENT_TYPES` nergens anders gebruikt, verwijder die import om een lint-warning te voorkomen.

- [ ] **Step 3: Controleer op ongebruikte imports**

Run: `npm run lint`
Expected: geen `no-unused-vars`/`no-unused-imports`-fouten. Verwijder de `EVENT_TYPES`-import uit `page.tsx` als lint erover klaagt.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build slaagt; `/` compileert met de nieuwe component.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(hero): homepage gebruikt fotografische HeroHeader"
```

---

## Task 5: Visuele verificatie

**Files:** geen — verificatie.

- [ ] **Step 1: Start de dev-server**

Run: `npm run dev`
Open `http://localhost:3000`.

- [ ] **Step 2: Controleer desktop**

Bij breedte ≥768px (md): de liggende foto (`hero-desktop.jpg`) vult de hero; titel/intro/zoekbalk zijn goed leesbaar op de donkere scrim; de sticky `SiteHeader` (cream/blur) staat er netjes bovenop. Geen horizontale scroll.

- [ ] **Step 3: Controleer mobiel**

Versmal naar <768px (of DevTools device-toolbar): nu toont de staande foto (`hero-mobiel.jpg`); zoekformulier stapelt verticaal; tekst blijft leesbaar.

- [ ] **Step 4: Controleer dat het zoekformulier werkt**

Kies een provincie + type, klik "Zoek opgietingen". Verwacht: navigatie naar `/agenda?provincie=…&type=…` met de juiste filters actief (identiek gedrag aan vóór de wijziging).

- [ ] **Step 5: Controleer overige pagina's ongewijzigd**

Bezoek `/agenda`, `/saunas`, `/over`, `/voor-saunas`: hun (lichte) headers zijn ongewijzigd; alleen de homepage-hero is fotografisch.

- [ ] **Step 6 (optioneel): documenteer de derde foto als buiten scope**

De lege lichte sauna-foto is géén hero (spec-besluit); kandidaat voor `/over` of `/voor-saunas` in een latere sessie. Geen actie nu.

---

## Self-Review (spec-dekking)

- Desktop liggend / mobiel staand → Task 3 (twee `<Image>` met `md:hidden` / `hidden md:block`), Task 5 verificatie.
- Derde foto niet als hero → buiten scope, genoemd in Task 5 stap 6.
- Foto's in `public/images/hero/`, verkleind vóór commit → Task 1.
- `next/image` fill + priority + object-cover, art-direction per breakpoint → Task 3.
- Donkere gradient-overlay + lichte tekst via themetokens (geen hex in components) → Task 2 (`hero-overlay` in globals.css, `--color-ink`), Task 3 (`text-white`, `text-cream/85`, `text-ember-soft`).
- Overige pagina's houden bestaande header → alleen `page.tsx` gewijzigd; Task 5 stap 5 verifieert.
- Openstaande voorwaarden (bestanden + gebruiksrechten) → "Voorwaarde vóór start"-sectie + Task 1.
- Buiten scope (andere pagina's, video, carrousels) → niet in het plan.
