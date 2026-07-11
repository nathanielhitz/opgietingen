# Design: fotografische hero-header

**Datum:** 2026-07-11 · **Status:** goedgekeurd door Nathaniel

## Doel

De homepage-header levendiger maken met een sfeervolle sauna-foto als achtergrond; de site voelt nu te statisch.

## Besluit

- **Desktop:** liggende foto (man bij HUUM-kachel met stoom, donkere houten sauna).
- **Mobiel:** staande variant van dezelfde scène — voelt als één geheel.
- De derde foto (lege lichte sauna) wordt níet als hero gebruikt; kandidaat voor `/over` of `/voor-saunas` (buiten scope).

## Uitwerking

- Foto's in `public/images/hero/` (bv. `hero-desktop.jpg`, `hero-mobiel.jpg`), aangeleverd door Nathaniel. Bronbestanden zijn zeer groot (4672×7008 / 7008×4672) — verkleinen vóór commit (max ~2400px breed/hoog, geoptimaliseerde JPEG/WebP).
- Hero-sectie op `/` krijgt de foto als achtergrond via `next/image` (`fill`, `priority`, `object-cover`), met art-direction per breakpoint: staand beeld onder `md`, liggend erboven.
- Donkere gradient-overlay (van onder/links) over de foto zodat titel, intro en zoekbalk leesbaar blijven; tekstkleur naar licht (themetokens, geen hex in components).
- Overige pagina's houden vooralsnog de bestaande header; alleen de homepage-hero wijzigt.

## Openstaande voorwaarden

- Nathaniel plaatst de twee bestanden in het repo (of geeft de locatie door).
- Gebruiksrechten van de foto's bevestigen (ogen als HUUM-stockmateriaal); nodig voor commercieel gebruik.

## Buiten scope

- Foto's op andere pagina's, video-headers, carrousels.
