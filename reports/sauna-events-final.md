# Eindrapport — controle ChatGPT-onderzoekslijst tegen opgietingen.nl

**Uitgevoerd:** 2026-07-12 · **Tijdzone:** Europe/Amsterdam
**Bron:** `opgietingen_research_pack_2026/sauna_evenementen_nederland_2026.csv` (91 kandidaten)

## Samenvatting in cijfers

| Metriek | Aantal |
|---|---|
| CSV-kandidaten totaal | 91 (42 `add`, 49 `review`) |
| Bron-clusters live opnieuw geverifieerd | 13 (WebFetch + PDF-render + geocode) |
| **Add-events al aanwezig in repo** | 5 (+ 1 met datumconflict, gecorrigeerd) |
| **Nieuw toegevoegd als `concept`** | 31 events |
| Nieuwe sauna-profielen aangemaakt | 10 |
| Datumcorrectie bestaand event | 1 (Aufguss WM Playoffs) |
| Add-kandidaten op review gezet (jaar niet te bevestigen) | 5 (Sauna Drôme 4, Thermen Maastricht 1) |
| Review-kandidaten (nooit auto-gepubliceerd) | 49 → zie `sauna-events-editorial-review.md` |
| Pre-existing bug gefixt (blokkeerde build) | 1 (`thermen-binnenmaas.mdx` YAML) |

> Alle nieuwe events staan op `status: concept` en zijn dus **onzichtbaar** op de site tot handmatige publicatie (loader filtert concepts). Elk event draagt een `keurNotitie` met de verificatiebron/-datum.

## Toegevoegde events per sauna (31, allemaal concept, 2026)

- **Vitae Wellnessresort Goes** (5): Opgietdag 14 jul, 11 aug, 12 sep, 24 okt, 28 nov
- **Vitae Wellnessresort Roosendaal** (4): Opgietdag 22 aug, 3 okt, 14 nov, 19 dec
- **Sauna Flevo Natuur** (10): Natupop Festival 24-26 jul; Voorrondeweekend So You Can Opgieten 1-2 aug; Finale So You Think You Can Opgieten 15 aug; Showopgietdag Famous Duo's 5 sep; Opgietdag Time Machine 26 sep; Seizoensafsluiting Opgietfeest 17 okt; Halloween 31 okt; Finse Löyly Avond 14 nov; Around the World 28 nov; Kerst/New Year 19 dec
- **Centre du Lac** (3): Gastopgietingen 6 aug, 2 sep, 22 sep
- **Thermae 2000** (2): Opening nieuwe opgietsauna weekend 1 (5-6 sep) + weekend 2 (12-13 sep)
- **Thermen Maarssen** (2): Opgiet- en rituelendag 6 sep; Viking-opgietweekend 21-22 nov
- **Thermen La Mer** (2): La Mer & Friends 22 aug; Diwali Festival of Lights 8 nov
- **SpaWeesp** (1): Voorronde BeWellness Aufguss Challenge 18 jul
- **SpaSense** (1): Opgietweekend 7-8 nov
- **Thermen & Beauty LeeuwerikHoeve** (1): Exclusieve opgietdag met gastopgieters 1 aug

## Verificatiemethode

- Elke bron-URL live opgehaald (WebFetch) en titel + datum + **jaartal 2026** gecontroleerd.
- Flevo Natuur-jaarkalender is een beeld-PDF; via `qlmanage` gerenderd en visueel geverifieerd (alle 10 data kloppen).
- Ontbrekende sauna-profielen: adres + coördinaten opgehaald via OpenStreetMap Nominatim (echte data, niets verzonnen — conform veiligheidsregel 7). Geen afbeeldingen: kaarten vallen terug op de standaard-gradient.

## Al aanwezig (niet opnieuw toegevoegd)

Zwaluwhoeve Opgietweekend 5-6 sep · Veluwse Bron Opgietweekend 12-13 sep · Veluwse Bron Finale BeWellness Aufguss Challenge 2-4 okt · Thermen Soesterberg Herbal Cup 9-11 okt · SpaWell Opgietweekend 28-29 nov · Thermen Berendonck Dag van de Ayurveda 8 aug.

## Datumcorrectie

**Aufguss WM Playoffs** (`aufguss-wm-playoffs-2026-08-01.mdx`, Thermen Bussloo): repo stond op **1-4 aug**, officiële bron bevestigt **26-29 aug 2026**. `startDatum`/`eindDatum` gecorrigeerd. *Let op:* bestandsnaam/slug bevat nog `2026-08-01` (puur een ID) — optioneel later hernoemen.

## Niet toegevoegd — jaar niet te bevestigen (nu review)

- **Sauna Drôme** (Putten): Opgietmarathon Herfst 26 sep, The Lords of Aufguss 17 okt, Happy Aufguss Steam Team 21 nov, Opgietmarathon Winter 11 dec. De evenementenkalender toont titels/data maar zonder expliciet jaartal ("alle data onder voorbehoud"). Bron-domein wél gecorrigeerd in `bronnen.json` (`saunadrome-putten.nl`).
- **Thermen Maastricht**: Opgietweekend 25-26 jul — broncheck gaf jaar 2025 terug; niet bevestigd voor 2026.

## bronnen.json

- 9 nieuwe bronnen geregistreerd (Vitae Goes/Roosendaal, Centre du Lac, Thermen Maarssen, Thermen La Mer, SpaWeesp, SpaSense, LeeuwerikHoeve, Sauna Flevo Natuur).
- 2 bestaande gecorrigeerd: **Sauna Drôme** (domein `saunadrome.nl`→`saunadrome-putten.nl`, provincie Limburg→Gelderland, kapot→actief) en **Thermae 2000** (agendaUrl → evenementen-pagina).

## Uitgevoerde checks

| Commando | Resultaat |
|---|---|
| `npm run test` | ✅ 22/22 pass |
| `npm run lint` | ✅ schoon |
| `npm run build` | ✅ 54/54 pagina's, geen fouten |

## Handmatige vervolgstappen

1. Concept-events reviewen en per stuk `status: gepubliceerd` zetten (evt. tijden/prijs aanvullen).
2. Eigen domeinen SpaWeesp/SpaSense bevestigen (nu best-guess `spaweesp.nl`/`spasense.nl` in profiel + affiliateUrl).
3. Sauna-afbeeldingen toevoegen onder `/images/saunas/` voor de 10 nieuwe profielen.
4. Sauna Drôme + Thermen Maastricht jaartal handmatig bevestigen; daarna events toevoegen.
5. Overweeg het WM Playoffs-bestand te hernoemen naar `-2026-08-26` voor consistentie.

## Niet gecommit/gepusht/gedeployed — conform opdracht.
