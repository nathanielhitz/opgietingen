# Design: hands-off scraper-pipeline (auto-publiceren)

**Datum:** 2026-07-11 · **Status:** goedgekeurd door Nathaniel

## Doel

De bestaande scraper-pipeline zo afmaken dat het bijhouden van de agenda vrijwel geen handwerk meer kost: gescrapete events die aan kwaliteitseisen voldoen gaan automatisch live; Nathaniel hoort alléén iets als er problemen zijn.

## Context

De pipeline (bronnen.json → `verify-bronnen` → `scrape-events` → concept-MDX → wekelijkse PR) staat, maar heeft nog nooit met echte API-keys gedraaid. De review-flow (concept-MDX in PR's nalopen) is de bottleneck; bovendien staan 9 van de 21 bronnen op `kapot`/`geen-agenda` doordat verificatie kale fetches gebruikt en JS-gerenderde sites niet kan lezen.

## Besluiten (uit brainstorm)

- **Controle:** auto-publiceren + steekproef achteraf. Geen review vooraf.
- **Melding:** alléén bij problemen (twijfelgevallen, kapotte bronnen). Stilte = alles goed.
- **Frequentie:** wekelijks (bestaande cron, maandag 06:00 UTC).

## Onderdelen

### 1. Kwaliteitspoort (in de scrape-stap)

Na extractie wordt elk nieuw event beoordeeld op harde criteria:

- `startDatum` is geldig ISO-formaat (`YYYY-MM-DD`) en ligt in de toekomst (t.o.v. de run-datum);
- `saunaSlug` verwijst naar een bestaand profiel in `content/saunas/`;
- `titel` is aanwezig en niet leeg; `type` is een geldige waarde uit `EVENT_TYPES`;
- het event is herkenbaar opgiet-gerelateerd: trefwoorden (o.a. *opgiet, opgieting, aufguss, löyly, saunaritueel, gietceremonie*) in titel of beschrijving. Dit voorkomt dat een gescrapete "moederdagbrunch" doorglipt.

Uitkomst:

- **Alles gehaald** → event wordt weggeschreven met `status: gepubliceerd`.
- **Iets gemist** → `status: concept`, met de afkeurreden(en) vastgelegd in het frontmatterveld `keurNotitie` zodat het probleem-issue ze kan tonen.

De bestaande dedup op `saunaSlug + startDatum` blijft de bescherming tegen dubbelen bij her-scrapes; reeds bestaande events (ook gepubliceerde) worden nooit overschreven.

### 2. Auto-publiceren i.p.v. PR

De wekelijkse GitHub Action commit de resultaten (nieuwe events + bijgewerkte `bronnen.json`) **direct op `main`**; Vercel deployt automatisch. Concept-events komen mee in de commit (klaar om handmatig te promoveren) maar zijn onzichtbaar op de site — de content-loader filtert ze al.

### 3. Probleem-issue (melding alléén bij problemen)

Na elke run:

- Zijn er twijfelgevallen (concepts) en/of niet-actieve bronnen met een gewijzigde/problematische status, dan opent of actualiseert de workflow **één** GitHub Issue met een leesbaar rapport: welke events niet gepubliceerd zijn en waarom, welke bronnen kapot/onbeslist zijn, en welke actieve bronnen nog een sauna-profiel missen ("profiel aanmaken" blijft bewust handwerk).
- GitHub's eigen notificatiemail is de melding — geen mailserver of extra dienst.
- Een schone run sluit een openstaand scraper-issue automatisch.

Herbruik: `scripts/bronnen-report.ts` levert de bronnensectie van het rapport.

### 4. Firecrawl-fallback in verificatie (dekking omhoog)

`verify-bronnen` krijgt een fallback: als de kale fetch mislukt of geen agendapagina oplevert (JS-gerenderd, bot-blokkade), wordt de pagina via Firecrawl opgehaald (echte browser-rendering) en opnieuw beoordeeld. Robots.txt-naleving blijft gelden. Daarna worden alle bronnen met status `kapot`/`geen-agenda` her-geverifieerd; verwachting is dat een flink deel `actief` wordt.

### 5. Volgorde van invoering

1. Kwaliteitspoort + Firecrawl-verificatie bouwen (auto-publiceren nog uit).
2. Eén **echte run lokaal** met API-keys, alles nog als `concept` — output beoordelen, poort bijstellen.
3. Auto-publiceren + probleem-issue aanzetten in de workflow.

### 6. Testen

`--dry-run` (mock-extractie, geen API-keys) wordt uitgebreid: de mock-set bevat ook events die de poort expres moet afkeuren (datum in verleden, onbekende sauna, niet-opgiet-event, ontbrekend type), zodat poortgedrag zonder API-kosten verifieerbaar is.

## Buiten scope

- Review-UI / admin-keurpagina (YAGNI; alleen relevant als kwaliteit tegenvalt).
- Nieuwsbrief- en handmatige bronnen.
- Automatisch aanmaken van sauna-profielen (blijft handwerk, gesignaleerd via het probleem-issue).
- Hogere scrape-frequentie.

## Foutafhandeling

- Firecrawl/Claude-API-fouten per bron: bron overslaan, opnemen in het probleem-issue; de run faalt niet als één bron faalt.
- Volledig mislukte run (bv. keys ongeldig): workflow faalt hard → GitHub Actions-failuremail.
- Poort bij twijfel altijd naar `concept` — false negatives (te streng) zijn acceptabel, false positives (rommel live) niet.
