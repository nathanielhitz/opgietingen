# Stoomanimatie homepage-hero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een CSS-only stoompluim plus ademende gloed vanaf de saunaoven rechtsonder in de homepage-hero, ook op mobiel, verborgen bij `prefers-reduced-motion`.

**Architecture:** Nieuw Server Component `HeroStoom` rendert zes wolk-`span`s (variatie via drie CSS-variabelen) en één gloed-`span` in een `aria-hidden` laag. `HeroHeader` plaatst die laag tussen de `<picture>` en de scrim. Alle stijl en keyframes staan in `globals.css`, alleen `transform`/`opacity` animeren, en bij reduced motion krijgt de laag `display: none`.

**Tech Stack:** Next.js 15 App Router, React 19 (Server Components), Tailwind v4 (thema-tokens in `globals.css`), node:test via tsx.

Spec: `docs/superpowers/specs/2026-09-09-hero-stoom-animatie-design.md`

Conventies: Nederlands in UI, comments en commits; commits eindigen met `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 0: Worktree

Nathaniel draait soms twee sessies in één checkout; feature-werk gaat in een aparte worktree.

- [ ] **Step 1: Maak de worktree**

```bash
git worktree add ../Opgieting.nl-hero-stoom -b feat/hero-stoom main
cd ../Opgieting.nl-hero-stoom && npm install
```

Verwacht: `Preparing worktree (new branch 'feat/hero-stoom')`, daarna een gevulde `node_modules/`.

Alle volgende taken draaien in `../Opgieting.nl-hero-stoom`.

---

### Task 1: `HeroStoom`-component (TDD)

De spec zegt "geen unit-test" voor de CSS; dit is één structurele test op het component (juiste aantallen, `aria-hidden`, geen tekst), zodat een latere refactor de laag niet stilletjes sloopt. Geen CSS-test.

**Files:**
- Create: `src/components/HeroStoom.tsx`
- Test: `scripts/lib/hero-stoom.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
// scripts/lib/hero-stoom.test.ts
// De stoomlaag is decoratief: vaste structuur, geen tekst, onzichtbaar voor
// hulptechnologie. Dit bewaakt de markup waar globals.css op leunt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HeroStoom from "../../src/components/HeroStoom";

test("HeroStoom rendert zes wolken en één gloed in een verborgen laag", () => {
  const html = renderToStaticMarkup(createElement(HeroStoom));
  assert.equal((html.match(/class="stoom-wolk"/g) ?? []).length, 6, "zes wolken verwacht");
  assert.equal((html.match(/class="stoom-gloed"/g) ?? []).length, 1, "één gloed verwacht");
  assert.match(html, /^<div class="hero-stoom[^"]*" aria-hidden="true"/, "laag moet aria-hidden zijn");
  assert.match(html, /pointer-events-none/, "laag mag geen kliks vangen");
  assert.equal(html.replace(/<[^>]+>/g, ""), "", "laag bevat geen tekst");
});

test("elke wolk heeft eigen duur, start en drift", () => {
  const html = renderToStaticMarkup(createElement(HeroStoom));
  const wolken = html.match(/<span class="stoom-wolk" style="[^"]*"><\/span>/g) ?? [];
  assert.equal(wolken.length, 6);
  for (const w of wolken) {
    assert.match(w, /--duur:\d+(\.\d+)?s/);
    assert.match(w, /--start:-?\d+(\.\d+)?s/);
    assert.match(w, /--drift:-\d+%/);
  }
  assert.equal(new Set(wolken).size, 6, "wolken moeten onderling verschillen");
});
```

- [ ] **Step 2: Draai de test; hij moet falen**

Run: `node --import tsx --test scripts/lib/hero-stoom.test.ts`
Verwacht: FAIL met `Cannot find module '../../src/components/HeroStoom'`.

- [ ] **Step 3: Schrijf het component**

```tsx
// src/components/HeroStoom.tsx
import type { CSSProperties } from "react";

// Decoratieve stoomlaag voor de homepage-hero: zes wazige wolken die vanaf de
// saunaoven (rechtsonder in beide herofoto's) opstijgen, plus een ademende
// gloed op de stenen. Puur CSS (keyframes in globals.css); de variatie per
// wolk zit in drie custom properties. Bij prefers-reduced-motion verbergt
// globals.css de hele laag.
const WOLKEN: Array<{ duur: string; start: string; drift: string }> = [
  { duur: "11s", start: "0s", drift: "-30%" },
  { duur: "13s", start: "-2.2s", drift: "-42%" },
  { duur: "10s", start: "-4.1s", drift: "-18%" },
  { duur: "12s", start: "-6.3s", drift: "-36%" },
  { duur: "14s", start: "-8.5s", drift: "-26%" },
  { duur: "11.5s", start: "-10.2s", drift: "-48%" },
];

export default function HeroStoom() {
  return (
    <div className="hero-stoom pointer-events-none absolute inset-0" aria-hidden>
      {WOLKEN.map((w) => (
        <span
          key={w.start}
          className="stoom-wolk"
          style={{ "--duur": w.duur, "--start": w.start, "--drift": w.drift } as CSSProperties}
        />
      ))}
      <span className="stoom-gloed" />
    </div>
  );
}
```

- [ ] **Step 4: Draai de test; hij moet slagen**

Run: `node --import tsx --test scripts/lib/hero-stoom.test.ts`
Verwacht: `# pass 2`, `# fail 0`.

Faalt de eerste `assert.match` op de `aria-hidden`-volgorde, controleer dan de gerenderde string met `console.log(html)`: React zet `aria-hidden="true"` direct na `class`. Pas desnoods de regex aan op de echte attribuutvolgorde, niet het component.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeroStoom.tsx scripts/lib/hero-stoom.test.ts
git commit -m "feat(hero): HeroStoom-component met zes wolken en gloed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Stoomstijl en keyframes in `globals.css`

**Files:**
- Modify: `src/app/globals.css` (voeg toe ná het `.hero-overlay`-blok, onderaan het bestand)

- [ ] **Step 1: Voeg de stijl toe**

Plak dit als laatste blok in `src/app/globals.css`:

```css
/* Stoomlaag in de homepage-hero (HeroStoom). Ligt tussen foto en scrim, dus
   dimt mee waar tekst staat. Verankerd rechtsonder met right/bottom: de hero
   wordt door zijn inhoud gemeten en de foto is object-cover, dus de exacte
   positie van de stenen verschuift per viewport; de oven zit in beide foto's
   rechtsonder. Alleen transform en opacity animeren (composited). */
.stoom-wolk,
.stoom-gloed {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}

.stoom-wolk {
  right: 13%;
  bottom: 10%;
  width: 17%;
  aspect-ratio: 1;
  background: radial-gradient(
    closest-side,
    rgba(255, 244, 234, 0.95),
    rgba(255, 244, 234, 0.4) 45%,
    transparent 100%
  );
  filter: blur(22px);
  opacity: 0;
  animation: stoom-pluim var(--duur, 11s) ease-out var(--start, 0s) infinite;
}

@keyframes stoom-pluim {
  0% {
    transform: translate(0, 0) scale(0.45);
    opacity: 0;
  }
  12% {
    opacity: 0.38;
  }
  60% {
    opacity: 0.18;
  }
  100% {
    transform: translate(var(--drift, -30%), -175%) scale(1.9);
    opacity: 0;
  }
}

/* Ademende gloed op de stenen: trage puls, geen piek. Kleur = --color-ember-soft. */
.stoom-gloed {
  right: 4%;
  bottom: -8%;
  width: 34%;
  aspect-ratio: 1.4;
  background: radial-gradient(
    closest-side,
    rgba(224, 149, 95, 0.85),
    rgba(224, 149, 95, 0.35) 50%,
    transparent 100%
  );
  filter: blur(30px);
  opacity: 0.12;
  animation: stoom-gloed 8s ease-in-out infinite alternate;
}

@keyframes stoom-gloed {
  from {
    opacity: 0.12;
  }
  to {
    opacity: 0.3;
  }
}

/* Staande herofoto (<768px, zelfde grens als de <source> in HeroHeader):
   stenen groter en iets hoger in beeld. */
@media (max-width: 767px) {
  .stoom-wolk {
    right: 6%;
    bottom: 14%;
    width: 30%;
  }
  .stoom-gloed {
    right: -6%;
    bottom: 2%;
    width: 60%;
  }
}

/* De foto bevat al stoom; stilstaande wolken toevoegen heeft geen waarde.
   display: none in plaats van de globale 0,01ms-regel, die een statische
   wolk zou achterlaten. */
@media (prefers-reduced-motion: reduce) {
  .hero-stoom {
    display: none;
  }
}
```

- [ ] **Step 2: Controleer dat de CSS compileert**

Run: `npm run build 2>&1 | tail -5`
Verwacht: build slaagt (geen CSS-parsefout; Tailwind v4 laat gewone CSS en `@keyframes` ongemoeid).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(hero): stoom- en gloedstijl met keyframes, mobiele verankering en reduced-motion

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Plaatsing in `HeroHeader`

**Files:**
- Modify: `src/components/HeroHeader.tsx` (import bovenaan; laag tussen `</picture>` en de scrim, rond regel 50–53)

- [ ] **Step 1: Import toevoegen**

Onder de bestaande imports (`getImageProps`, `Link`, content, site):

```tsx
import HeroStoom from "@/components/HeroStoom";
```

- [ ] **Step 2: Laag plaatsen**

Vervang

```tsx
      </picture>

      {/* Donkere scrim voor leesbaarheid */}
      <div className="hero-overlay absolute inset-0" aria-hidden />
```

door

```tsx
      </picture>

      {/* Stoomlaag ónder de scrim, zodat hij meedimt waar tekst staat */}
      <HeroStoom />

      {/* Donkere scrim voor leesbaarheid */}
      <div className="hero-overlay absolute inset-0" aria-hidden />
```

De sectie heeft al `relative isolate overflow-hidden`; dat houdt de wolken binnen de hero en isoleert de `mix-blend-mode`. Niets anders in het bestand wijzigt.

- [ ] **Step 3: Lint, build en tests**

Run: `npm run lint && npm run build && npm test`
Verwacht: alle drie groen; `npm test` toont `# fail 0` met de twee nieuwe tests erbij.

- [ ] **Step 4: Commit**

```bash
git add src/components/HeroHeader.tsx
git commit -m "feat(hero): stoomanimatie in de homepage-hero

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Handmatige check in de dev-server

**Files:** geen wijzigingen, tenzij de verankering bijgesteld moet worden (dan alleen `right`/`bottom`/`width` in `src/app/globals.css`).

- [ ] **Step 1: Start de dev-server**

Run: `npm run dev` en open `http://localhost:3000`.

- [ ] **Step 2: Desktop (≥ 1024 px breed)**

Controleer, ten minste twintig seconden kijkend:
- Stoom komt uit de hoek van de oven rechtsonder en drijft naar linksboven, richting het raam.
- Kop, intro en zoekbalk blijven volledig leesbaar; er komt geen wolk vóór de tekst (de scrim ligt eroverheen).
- De stenen ademen zacht op en af (± 8 s); geen flits.
- Er staat direct stoom bij het laden, geen lege hero die pas na seconden begint.

Komt de pluim duidelijk naast de oven uit (bijvoorbeeld midden onder), pas dan in `globals.css` alleen `right`/`bottom` van `.stoom-wolk` aan in stappen van 2–3 % en herlaad. Verander geen keyframes.

- [ ] **Step 3: Mobiel-viewport**

DevTools, 390 × 844 (iPhone). Controleer dat de staande foto laadt, dat de wolken uit de stenen rechtsonder komen en dat ze de kop en intro niet raken. Bijstellen: alleen het `@media (max-width: 767px)`-blok.

- [ ] **Step 4: Verminder beweging**

macOS: Systeeminstellingen → Toegankelijkheid → Beeldscherm → "Verminder beweging" aan (of DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`). Herlaad: geen stoom, geen gloed, de hero ziet er uit als vóór deze wijziging. Zet de instelling daarna terug.

- [ ] **Step 5: Vergelijk met de mockup**

Open de mockup (https://claude.ai/code/artifact/64f87b48-42bf-4c1a-8d18-53a4f6f59dc7), variant B. Intensiteit, snelheid en richting moeten overeenkomen; alleen de verankering mag afwijken omdat de echte hero een andere hoogte heeft.

- [ ] **Step 6: Commit eventuele bijstelling**

Alleen als in stap 2 of 3 iets is aangepast:

```bash
git add src/app/globals.css
git commit -m "fix(hero): verankering stoomlaag afgestemd op de echte hero-hoogte

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Documentatie

**Files:**
- Modify: `CLAUDE.md` (sectie *Conventies*, na de regel over kleuren via themetokens)

- [ ] **Step 1: Conventie vastleggen**

Voeg na de regel `- **Kleuren via themetokens** …` toe:

```markdown
- **Animatie: alleen de hero-stoom.** De homepage-hero heeft één decoratieve, CSS-only stoomlaag (`HeroStoom`, stijl in `globals.css`): zes wolken plus een gloed vanaf de oven rechtsonder, alleen `transform`/`opacity`, bij `prefers-reduced-motion` `display: none`. Geen andere animaties op de site; nieuwe beweging eerst overwegen tegen dit ijkpunt. Spec: [docs/superpowers/specs/2026-09-09-hero-stoom-animatie-design.md](docs/superpowers/specs/2026-09-09-hero-stoom-animatie-design.md).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: hero-stoomanimatie als enige animatie vastgelegd in CLAUDE.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Afronden

- [ ] **Step 1: Volledige verificatie op de branch**

Run: `npm run lint && npm run build && npm test`
Verwacht: alles groen. Niet doorgaan als iets rood is.

- [ ] **Step 2: Integratie**

Gebruik de skill `finishing-a-development-branch` om te kiezen tussen mergen naar `main` of een PR. Bij een PR: titel `feat(hero): stoomanimatie in de homepage-hero`, body verwijst naar de spec en de mockup, eindigt met `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Na integratie de worktree opruimen:

```bash
cd ../Opgieting.nl && git worktree remove ../Opgieting.nl-hero-stoom
```
