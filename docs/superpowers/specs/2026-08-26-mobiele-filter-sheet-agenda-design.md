# Mobiele filter-sheet op `/agenda` — design

**Datum:** 2026-08-26
**Status:** goedgekeurd door Nathaniel, klaar voor implementatieplan

## Probleem

Op iPhone (getest: iPhone 17 Pro, Safari) worden de datumvelden *Vanaf* en *Tot en met* in het filterpaneel van `/agenda` afgekapt. Oorzaak: `<input type="date">` heeft in iOS Safari een intrinsieke minimumbreedte en centreert/klipt zijn waarde; in een 1fr-gridkolom overloopt de tekst.

Daarnaast is het hele filterpaneel op mobiel te hoog (± 430 px: zoekbalk, land-pills, type-pills, provincie-select, twee datumvelden). De meeste bezoekers openen de agenda om te zien wat er komt; het paneel duwt de eerste event-kaart onder de vouw.

## Besluit

Gekozen na visuele vergelijking van varianten (A minimale fix, B compacte dropdowns, C filter-knop + sheet; gesloten stand D1 kaal vs D2 met snelkeuze-chips): **C2 + D1**.

- **Gesloten stand (D1):** alleen zoekbalk + knop "Filters". Met actieve filters: "Filters (n)" plus chip-rij met ✕ per filter.
- **Sheet (C2):** bottom-sheet met drie selects — *Waar*, *Type*, *Periode*. Datumvelden pas zichtbaar na "Kies datums…" (C3).

## Scope

- Alleen onder het `sm`-breakpoint (< 640 px) verandert de UI. Desktop houdt het huidige paneel.
- Op alle breakpoints: iOS-fix voor datumvelden en Vanaf/Tot naast elkaar.
- URL-params blijven `q`, `land`, `provincie`, `type`, `van`, `tot`. Server-side filtering, `/agenda/[maand-jaar]`, provinciepagina's en SEO worden niet geraakt.
- Geen nieuwe dependencies.

## Gedrag

### Gesloten stand
- Zoekformulier zoals nu (label, input, knop "Zoeken").
- Knop **"Filters"** naast/onder de zoekbalk; label wordt **"Filters (n)"** met n = aantal actieve filters exclusief `q` (de zoekterm staat al in het veld). De zoekterm blijft wél als chip verschijnen, zodat hij met ✕ te wissen is.
- Chip-rij (bestaande `activeFilters`) met leesbaardere labels:
  - land → "Nederland" / "België"
  - provincie → provincienaam
  - type → typelabel
  - van/tot → snelkeuze-naam als het bereik exact met een snelkeuze overeenkomt (bv. "Dit weekend"), anders "26 aug – 15 sep" (alleen `van`: "vanaf 26 aug"; alleen `tot`: "t/m 15 sep").
  - q → "Zoeken: “…”" (ongewijzigd)

### Sheet
- Native `<dialog>` (focus-trap, Escape, backdrop gratis), gestyled als bottom-sheet met themetokens (`bg-surface`, `border-sand`, afgeronde bovenhoeken). Klik op backdrop sluit.
- Kop: "Filters" + tekstknop "Wissen" (bestaande `resetFilters`; sluit de sheet niet).
- Drie velden, elk één rij met label erboven:
  1. **Waar** — één `<select>`: `Overal`; `<optgroup label="Nederland">` met eerst "Nederland – alle provincies" en dan de NL-provincies "Gelderland (12)"; idem `<optgroup label="België">`. Optiewaarden: `""`, `NL`, `BE`, `NL:gelderland`, `BE:antwerpen`, …. Schrijft `land` + `provincie` in één `update()`-aanroep.
  2. **Type** — `Alle types` + `EVENT_TYPES`. Schrijft `type`.
  3. **Periode** — `Alles wat komt` · `Dit weekend` · `Komende 30 dagen` · `Deze maand` · `Volgende maand` · `Kies datums…`.
     - Snelkeuze schrijft `van` + `tot` in één `update()`.
     - `Alles wat komt` wist `van` en `tot`.
     - `Kies datums…` toont eronder de twee datumvelden (Vanaf | Tot en met, naast elkaar) en wijzigt de URL niet totdat een datum is ingevuld.
     - De select toont de snelkeuze waarvan van/tot exact overeenkomen; anders `Kies datums…` met velden open (zodat een deeplink `?van=…&tot=…` correct weergeeft). Lokale state `datumsOpen` houdt de velden open zolang de gebruiker `Kies datums…` heeft gekozen, ook als de velden nog leeg zijn.
- Elke wijziging schrijft **direct** naar de URL via de bestaande `update()`; de lijst achter de sheet filtert mee. Er is geen apart concept-/toepassen-state.
- Onderaan knop **"Toon N events"** (N = aantal gefilterde events, prop `resultaatAantal` vanuit `page.tsx`): sluit alleen de sheet. Bij N = 0: "Geen events – pas filters aan" (disabled-look maar wel klikbaar om te sluiten).

### Snelkeuze-definities (`vandaag` = lokale datum, ISO)
- **Dit weekend:** komende vrijdag t/m zondag. Valt vandaag op vr/za/zo, dan vandaag t/m die zondag.
- **Komende 30 dagen:** vandaag t/m vandaag + 30 dagen.
- **Deze maand:** vandaag t/m laatste dag van deze maand.
- **Volgende maand:** 1e t/m laatste dag van volgende maand.

## Code-indeling

- `src/components/AgendaFilters.tsx` — behoudt de URL-sync-logica (`update`, `resetFilters`, refs). Rendert:
  - `<DesktopFilterPanel>` (`hidden sm:block`) — huidige markup, met Vanaf/Tot in één 2-koloms rij en de iOS-datumfix.
  - `<MobileFilterBar>` + `<FilterSheet>` (`sm:hidden`).
  - Nieuwe prop `resultaatAantal: number`.
- `src/components/agenda-filters/DesktopFilterPanel.tsx`, `MobileFilterBar.tsx`, `FilterSheet.tsx` — presentatie; krijgen `filters`, `provinces`, `update`, `resetFilters` als props.
- `src/lib/filter-presets.ts` — pure, deterministische helpers (geen `new Date()` zonder parameter):
  - `periodeVoorKeuze(keuze: PeriodeKeuze, vandaag: string): { van: string; tot: string } | null`
  - `keuzeVoorPeriode(van: string, tot: string, vandaag: string): PeriodeKeuze` (`"alles"` bij leeg, `"custom"` bij geen match)
  - `waarValue(land, provincie)` / `parseWaar(value): { land: string; provincie: string }`
  - `labelVoorDatumbereik(van, tot, vandaag): string`
- Datumfix als Tailwind-klassen op beide datumvelden: `min-w-0 appearance-none [&::-webkit-date-and-time-value]:text-left`.
- Client-side "vandaag": in de client component via `new Date()` (toegestaan: geen SSG-renderpad; de sheet rendert alleen na interactie, de select-waarde wordt bij mount afgeleid — hydratieverschil vermijden door `vandaag` in `useEffect`/state te zetten).

## Testen

- `scripts/lib/filter-presets.test.ts` (node:test): weekendberekening voor elke weekdag, maandgrenzen (incl. december → januari, februari), round-trip `periodeVoorKeuze` → `keuzeVoorPeriode`, `parseWaar(waarValue(...))`, datumlabels.
- Handmatig op iPhone Safari: datumvelden niet afgekapt (desktop én sheet), sheet openen/sluiten via knop, backdrop en Escape, chips verwijderen, deeplink `?van=2026-09-01&tot=2026-09-15` opent met `Kies datums…` en gevulde velden, teller in "Filters (n)" klopt, "Toon N events" klopt met de lijst.
- `npm run build`, `npm run lint`, `npm run test` groen.

## Buiten scope

- Snelkeuze-chips in de gesloten stand (D2) — bewust afgewezen: kaarten boven de vouw wegen zwaarder.
- Wijzigingen aan de kalenderweergave (`?weergave=kalender`) en aan de desktop-interactie.
