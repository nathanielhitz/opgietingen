# Sfeergeluid op de website — ontwerp

Datum: 2026-09-30. Status: ontwerp, goedgekeurd in de brainstorm van 2026-09-30
(keuze uit drie mockups: A, icoon in de header).

## 1. Aanleiding

Nathaniel wil de achtergrondtrack van de social-video's ook op de site als
sfeergeluid. Harde randvoorwaarde: browsers (Chrome, Safari, Firefox) staan geluid
pas toe na een tik of klik van de bezoeker. Het wordt dus een opt-in-knop, nooit
autoplay. De site is SEO-first: er mag niets geladen worden vóór die tik.

## 2. Beslissingen

| Vraag | Besluit | Waarom |
|---|---|---|
| Geluid | Dezelfde track als de social-video's (`background-music.mp3`), in een loop | Eén herkenbaar geluid over site en social; Nathaniels keuze boven een sauna-sfeeropname. |
| Plaatsing | Luidspreker-icoon in de header, links van het menu-icoon, alle publieke pagina's | Rustig, altijd bereikbaar, past bij de kale header (mockup A gekozen boven zwevende knop en hero-knop). |
| Standaard | Uit; keuze onthouden in `localStorage` | Autoplay is niet mogelijk en muziek die ongevraagd start stoort. |
| Bestand | `public/audio/sfeergeluid.mp3`, byte-gelijke kopie van de social-track (al MP3 128 kb/s, 3,1 MB) | Hercoderen op dezelfde bitrate kost alleen kwaliteit; pas geladen na de tik (`preload="none"`), dus geen effect op LCP/CWV. |
| Volume/fades | 35 %, fade-in 2 s, fade-out 0,8 s, via Web Audio `GainNode` | iOS negeert `HTMLMediaElement.volume`; een GainNode werkt overal. Terugval op `volume` als `AudioContext` ontbreekt. |
| Doorlopen | De knop leeft in `SiteHeader` (client-component in de (site)-layout) | Blijft gemonteerd bij client-navigatie, dus de muziek loopt door. Bij een volledige herlaad met "aan": start proberen; blokkeert de browser, dan bij de eerste tik/toets. |
| Beweging | Twee statische iconen (uit: streep, aan: golfjes), geen animatie | Regel: alleen de hero-stoom beweegt. |
| Meting | Vercel Analytics-event `sfeergeluid` met `stand` | Zien of het gebruikt wordt; zelfde patroon als de deelknoppen. |
| Beheerpaneel | Geen knop op `/keystatic` | Valt buiten `SiteChrome`. |

## 3. Onderdelen

- `src/lib/sfeergeluid.ts`: constanten (`SFEERGELUID_SRC`, `SFEERGELUID_OPSLAG`,
  `SFEERGELUID_VOLUME`, fades), `type Stand = "aan" | "uit"`, pure functies
  `leesStand(raw)` (alleen letterlijk `"aan"` telt) en `wissel(stand)`, en
  `maakSpeler()` (browser-only): lazy `Audio` met `loop` en `preload="none"`,
  `AudioContext` + `MediaElementAudioSourceNode` + `GainNode` (één keer aangemaakt),
  `aan()` → `ctx.resume()`, gain 0 → volume in 2 s, `play()`; geeft `false` als
  de browser `play()` weigert; `uit()` → gain naar 0 in 0,8 s, daarna `pause()`.
- `src/components/SfeergeluidKnop.tsx` (`"use client"`): knop met `aria-pressed`
  en label "Sfeergeluid aan"/"Sfeergeluid uit"; leest bij mount de voorkeur;
  bij "aan" start proberen en anders eenmalige `pointerdown`/`keydown`-listeners
  op `document` die starten bij de eerste interactie; klik wisselt stand,
  schrijft `localStorage` (in try/catch) en stuurt het analytics-event.
  Props: `overlay` (zelfde kleurlogica als de menuknop).
- `src/components/SiteHeader.tsx`: de knop in de `<nav>` vóór de menuknop,
  zichtbaar op alle breedtes.
- `public/audio/sfeergeluid.mp3`: kopie van `assets/social/muziek/background-music.mp3` (test bewaakt dat beide gelijk zijn).
- `assets/social/muziek/LICENTIE.md`: vermelding van de sitekopie en de bron
  (YouTube, "no copyright music"; titel en video-URL nog aan te leveren).

## 4. Tests (`npm run test`)

`scripts/lib/sfeergeluid.test.ts`: `leesStand` (`"aan"` → aan; `"uit"`, `null`,
`undefined`, onzin → uit), `wissel`, en een bestandscheck: `public/audio/sfeergeluid.mp3`
is byte-gelijk aan de social-track (sha256), zodat site en video's niet uit elkaar lopen.

## 5. Buiten scope

Sauna-sfeeropname, meerdere tracks of een volumeregelaar, geluid in het beheerpaneel,
autoplay-trucs (muted video als opstap).

## 6. Risico's

| Risico | Maatregel |
|---|---|
| Licentie van de track is niet gedocumenteerd | Bron en voorwaarden in `LICENTIE.md` zodra Nathaniel de video-URL levert; veel "no copyright"-tracks vragen naamsvermelding. |
| `createMediaElementSource` faalt (bv. oude Safari) | Try/catch, terugval op `audio.volume`. |
| Loop-naad hoorbaar | Acceptabel voor een sfeertrack; later eventueel crossfade-loop. |
