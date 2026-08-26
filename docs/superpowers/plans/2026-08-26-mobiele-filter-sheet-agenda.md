# Mobiele filter-sheet agenda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Op mobiel (< `sm`) vervangt een "Filters"-knop + bottom-sheet met drie selects het hoge filterpaneel van `/agenda`; iOS-datumvelden worden overal gefixt.

**Architecture:** `AgendaFilters.tsx` houdt de URL-sync-logica en rendert `DesktopFilterPanel` (`hidden sm:block`) en `MobileFilterBar` + `FilterSheet` (`sm:hidden`). Pure, deterministische helpers (snelkeuze-periodes, Waar-waarde, chip-labels) staan in `src/lib/filter-presets.ts` met node:test-tests in `scripts/lib/`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, native `<dialog>`, node:test via tsx.

Spec: `docs/superpowers/specs/2026-08-26-mobiele-filter-sheet-agenda-design.md`

---

### Task 1: `filter-presets.ts` — pure helpers (TDD)

**Files:**
- Create: `src/lib/filter-presets.ts`
- Test: `scripts/lib/filter-presets.test.ts`

- [ ] Schrijf tests voor `periodeVoorKeuze`, `keuzeVoorPeriode`, `waarValue`/`parseWaar`, `labelVoorDatumbereik` (weekend voor elke weekdag via `weekendRange`, maandgrenzen dec→jan en feb, round-trips).
- [ ] `npm test` → FAIL (module ontbreekt).
- [ ] Implementeer met bestaande `weekendRange`/`addDaysISO`/`parseISO`/`formatDate` uit `src/lib/dates.ts`.
- [ ] `npm test` → PASS. Commit `feat(agenda): snelkeuze-helpers voor mobiele filters`.

### Task 2: Presentatiecomponenten

**Files:**
- Create: `src/components/agenda-filters/DesktopFilterPanel.tsx` (huidige markup, Vanaf/Tot in `grid-cols-2`, iOS-fix `min-w-0 appearance-none [&::-webkit-date-and-time-value]:text-left`)
- Create: `src/components/agenda-filters/MobileFilterBar.tsx` ("Filters (n)"-knop + chips)
- Create: `src/components/agenda-filters/FilterSheet.tsx` (`<dialog>`, Waar/Type/Periode-selects, datumvelden bij `custom`, "Toon N events")
- Create: `src/components/agenda-filters/DateInput.tsx` (gedeeld datumveld met iOS-fix)

- [ ] Bouw de vier componenten; props: `filters`, `provinces`, `update(changes)`, `resetFilters()`, `resultaatAantal`, `vandaag`.
- [ ] Commit `feat(agenda): filter-sheet-componenten`.

### Task 3: `AgendaFilters.tsx` + `page.tsx` koppelen

**Files:**
- Modify: `src/components/AgendaFilters.tsx` (render desktop/mobiel, chip-labels via `labelVoorDatumbereik`, `vandaag` in state via `useEffect`, nieuwe prop `resultaatAantal`)
- Modify: `src/app/agenda/page.tsx:102` (geef `resultaatAantal={events.length}`)

- [ ] Koppel, verwijder oude inline markup.
- [ ] `npm run lint && npm run build && npm test` groen.
- [ ] Commit `feat(agenda): mobiele filter-sheet (C2 + D1) en iOS-datumfix`.

### Task 4: Handmatige check
- [ ] `npm run dev`, DevTools 390px: sheet open/sluit (knop, backdrop, Escape), teller, chips, deeplink `?van=2026-09-01&tot=2026-09-15` → "Kies datums…" met gevulde velden. Desktop ongewijzigd.
