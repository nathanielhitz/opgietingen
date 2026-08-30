# Beheer-dashboard met scrape-run-metrics — ontwerp

**Datum:** 2026-08-30
**Status:** ontwerp goedgekeurd, wacht op implementatieplan
**Deelproject 2 van 3** in het traject "beheer & inzicht" (deelproject 1: [Keystatic-beheerpaneel](2026-08-29-keystatic-beheerpaneel-design.md), live sinds 2026-08-29; deelproject 3: affiliate-kliks naar Supabase, nog te speccen).

## 1. Aanleiding

De wekelijkse scrape-workflow (maandag 06:00 UTC) draait `verify-bronnen`, de website-scraper, de Facebook-scraper, de mail-scraper en de rooster-hercheck. De drie scrapers tellen `written`/`skipped` in lokale variabelen en printen dat naar de console; daarna is het weg. Het enige blijvende spoor is een commit met een generiek bericht en een GitHub-issue met *problemen*. Hoeveel kandidaten er waren, hoeveel er zijn gepubliceerd of als concept zijn blijven staan, welke bron wat leverde en welke extractiemethode (Firecrawl-credits) daarvoor nodig was, is nergens terug te vinden.

Doel: na elke run in één oogopslag zien **wat de laatste run opleverde en wat er te doen is**, met per concept een directe link naar de Keystatic-editor — en ondertussen per bron genoeg vastleggen om later een bronnenoverzicht te bouwen zonder de scrapers opnieuw te raken.

## 2. Beslissingen

| Keuze | Besluit | Verworpen |
|---|---|---|
| Hoofdvraag | **"Wat leverde de laatste run op?"** — actiegericht | Bronprestaties of trend als hoofdingang (komen als vervolgtab / context) |
| Scope van een run-record | **De drie event-scrapers + `verify-bronnen`-statuswijzigingen** | Alleen scrapers (mist kapotte bronnen); alle vijf stappen incl. roosters (roosters blijven in het GitHub-issue) |
| Opslag | **`data/scrape-runs.json` in git**, één record per run, gecommit door de workflow | Afleiden uit git-historie (tellers niet reconstrueerbaar; Vercel cloont shallow); externe store (infra voor 1 record/week) |
| Indeling | **A · Rapport**: samenvatting → kanalen → te beoordelen → fouten → trend; geen client-JS | B · Bronnentabel met filters/sparklines — wordt later `/beheer/bronnen`, de data ervoor wordt vanaf nu al verzameld |
| Toegang | Zelfde regel als `/keystatic`: noindex, robots-disallow, in productie 404 zonder GitHub App (`beheerBeschikbaar()`) | Aparte login (de pagina bevat alleen tellers en bronnamen die al publiek in de repo staan) |

## 3. Datamodel — `data/scrape-runs.json`

Gecommit bestand (`data/` staat alleen voor `clicks.log` in `.gitignore`). Eén record per workflow-run, nieuwste laatst:

```json
{
  "runs": [
    {
      "id": "2026-08-31T06:04:12Z",
      "workflowRun": "17421983320",
      "duurSeconden": 221,
      "autopublish": true,
      "backfill": false,
      "fout": null,
      "bronnen": {
        "gecontroleerd": 41,
        "statusWijzigingen": [
          { "id": "sauna-drome", "van": "actief", "naar": "kapot", "notitie": "DNS-fout" }
        ]
      },
      "kanalen": {
        "website":  { "bronnen": [ { "id": "thermen-bussloo", "kandidaten": 4, "dedup": 2, "verleden": 0, "afgekeurd": 0, "concept": 2, "gepubliceerd": 0, "fout": null, "methode": "statisch" } ] },
        "facebook": { "bronnen": [ { "id": "elysium", "kandidaten": 3, "dedup": 1, "verleden": 0, "afgekeurd": 0, "concept": 2, "gepubliceerd": 0, "fout": null, "methode": "claude", "posts": 6 } ] },
        "mail":     { "mails": 0, "onbekendeAfzenders": 0, "bronnen": [] }
      },
      "events": [
        { "slug": "asanti-nationale-saunaweek-asanti-2026-09-14", "kanaal": "website", "bron": "asanti", "status": "concept", "reden": "opgiet-trefwoord staat niet in de titel" }
      ]
    }
  ]
}
```

- **Per bron dezelfde zeven tellers**: `kandidaten`, `dedup`, `verleden`, `afgekeurd`, `concept`, `gepubliceerd`, plus `fout` (`string | null`: robots-blokkade, fetch-fout, extractie-fout) en `methode` (`"statisch" | "firecrawl" | "claude" | "geen"`). `methode` is de basis voor het volgen van Firecrawl-verbruik en voor de latere bronnentabel. Facebook-bronnen hebben extra `posts` (aantal opgehaalde posts).
- **`events[]`**: de in deze run weggeschreven events — `slug`, `kanaal`, `bron` (= saunaSlug), `status` (`concept | gepubliceerd`), optioneel `reden` (= `keurNotitie`). Dit is de "te beoordelen"-lijst; geen inhoud (die staat in de MDX). Bewuste duplicatie met de git-historie: in de build is die historie niet betrouwbaar bereikbaar.
- **`bronnen`**: wat `verify-bronnen` deze run wijzigde — alleen wijzigingen, niet alle statussen (die staan in `bronnen.json`).
- **Run-niveau `fout`**: `null`, of `"geen metrics"` wanneer geen enkele scraper iets meldde.
- **`backfill: true`** markeert records die uit de git-historie zijn gereconstrueerd (alleen `events[]`; tellers `null`); de UI toont die gedempt.
- **Totalen worden niet opgeslagen** — de loader leidt ze af. Geen twee waarheden.
- **Bewaartermijn**: geen; 52 records/jaar blijft ruim onder 1 MB.

## 4. Schrijfpad

Patroon van `scripts/lib/warnings.ts` (append aan een tijdelijk JSON-bestand, gitignored) plus één afsluitende stap.

### `scripts/lib/metrics.ts` (nieuw)
- `meldBronResultaat(kanaal, { id, kandidaten, dedup, verleden, afgekeurd, concept, gepubliceerd, fout, methode, posts? })`
- `meldEvent({ slug, kanaal, bron, status, reden? })`
- `meldMailStats({ mails, onbekendeAfzenders })`
- `meldBronStatusWijziging({ id, van, naar, notitie })` — vanuit `verify-bronnen`
- Alles appendt aan `scrape-metrics.json` (gitignored). **Alles in try/catch; een metrics-fout logt een `console.warn` en laat nooit een scrape falen.** Bij `--dry-run` wordt niets geschreven. Corrupt bestand → waarschuwing en overschrijven.

### In de drie scrapers
Per bron-iteratie een klein teller-object bijhouden en aan het einde van de iteratie melden; per weggeschreven event `meldEvent`. Bestaande `console.log`-regels en `scrape-warnings` blijven ongewijzigd; metrics komen ernaast. De scrape-logica verandert niet.

### `scripts/run-record.ts` (nieuw, `npm run run-record`)
1. Leest `scrape-metrics.json`, groepeert per kanaal, bouwt het record: `id` = `RUN_GESTART` (env, gezet aan het begin van de workflow; lokaal de huidige tijd), `workflowRun` = `GITHUB_RUN_ID`, `duurSeconden` = nu − start, `autopublish` = `SCRAPE_AUTOPUBLISH === "true"`.
2. Appendt aan `data/scrape-runs.json` (maakt aan als het ontbreekt); **idempotent op `id`** (tweede keer draaien vervangt het record).
3. Verwijdert `scrape-metrics.json`.
4. Zonder metrics-bestand: record met lege kanalen en `fout: "geen metrics"` — een lege run is ook een datapunt.
5. Schrijft een samenvattingsregel naar `$GITHUB_OUTPUT` (`samenvatting=18 kandidaten, 4 gepubliceerd, 9 concept`) voor het commit-bericht.

### Workflow `scrape.yml`
- Eerste stap: `echo "RUN_GESTART=$(date -u +%FT%TZ)" >> "$GITHUB_ENV"`.
- Nieuwe stap `npm run run-record` met `if: always()`, ná de scrapers en vóór de commit-stap.
- Commit-stap: `git add` krijgt `data/scrape-runs.json`; commit-bericht wordt `chore(scraper): run <dd-mm> — <samenvatting>`. Omdat het run-bestand elke week verandert, is er **elke week een commit**, ook bij 0 events; `indexnow` filtert zelf op publieke URL-wijzigingen, dus geen spam.

### Backfill — `scripts/backfill-runs.ts` (eenmalig, lokaal)
Loopt `git log --diff-filter=A` over commits met `chore(scraper)` in het bericht voor `content/events`, leest per commit de toegevoegde MDX-frontmatter (`git show <sha>:<pad>`) en maakt records met `events[]`, `backfill: true`, `id` = commit-datum. Uitkomst wordt handmatig gereviewd en gecommit. Niet in de workflow.

## 5. Loader en pagina

### `src/lib/scrape-runs.ts`
De enige plek die weet waar run-data vandaan komt (later vervangbaar door Supabase zonder de pagina te raken).
- `getScrapeRuns(): ScrapeRun[]` — leest en valideert licht; ontbrekend bestand → `[]` (build crasht nooit); gesorteerd op `id`.
- `getLaatsteRun()`, `runTotalen(run)` (per kanaal en totaal), `weekTrend(runs, weken = 12)` (per run gepubliceerd/concept/kandidaten; backfill telt alleen wat het heeft).
- Pure functies met fixtures testbaar; geen `Date.now()` in renderpaden — er wordt alleen de run-datum getoond, geen "x dagen geleden".

### Route `/beheer` — `src/app/beheer/page.tsx` + `layout.tsx`
Buiten `(site)` (geen site-chrome), naast `/keystatic`. Server component, statisch gebouwd; geen client-JS.
- Layout: `metadata.robots = { index: false, follow: false }`, `title: { absolute: "Beheer" }`, `description: null`, `alternates: { canonical: null }`; guard `if (!beheerBeschikbaar()) notFound()`.
- `BeheerNav` met *Dashboard* (deze pagina) en *Bewerken* (→ `/keystatic`); later *Bronnen*.

Inhoud (indeling A):
1. Eyebrow: run-datum/tijd, duur, autopublish aan/uit. Kop: "18 kandidaten, 4 gepubliceerd, 9 te beoordelen".
2. Vier tegels: kandidaten (met aantal bronnen), gepubliceerd, concept, aandacht (bijschrift: dedup/verleden).
3. Drie kanaalkaarten (website / Facebook / mail): gestapeld staafje gepubliceerd–concept–dedup met cijfers als tekst ernaast.
4. **Te beoordelen**: `events[]` met `status: concept` uit de laatste run — event, sauna (via `getSaunaBySlug`), reden, knop *Open* → `/keystatic/collection/events/item/<slug>`.
5. **Aandacht** (bronfouten én statuswijzigingen; `kapot → actief` is geen fout): bron-regels met `fout != null` uit de drie kanalen + `bronnen.statusWijzigingen`; knop *Bron* → `/keystatic/singleton/bronnen`.
6. **Trend**: 12 kolommen "gepubliceerd per run" als HTML/CSS-staafjes met `title`-tooltip; backfill-kolommen gedempt. Klein: context, geen hoofdvraag.

Geen run-selector/historie (YAGNI; komt met `/beheer/bronnen`).

### Lege en afwijkende toestanden
- Geen `scrape-runs.json` → "Nog geen runs; de eerste komt maandag."
- Laatste run met `fout: "geen metrics"` → rode banner "Run zonder resultaten" met link naar `https://github.com/nathanielhitz/opgietingen/actions/runs/<workflowRun>`.
- Backfill-run als laatste run → tellers als `?`, geen aandacht-lijst, toelichting "gereconstrueerd".

### Robots/sitemap
`/beheer` toevoegen aan `robots.ts`-disallow; `beheer-routes.test.ts` uitbreiden.

## 6. Visueel

- Site-tokens (`bg-cream`, `text-ink`, `ember`, Fraunces/Inter). Light-only, zoals de site.
- Nieuwe tokens in `globals.css`: kanaalkleuren `--color-kanaal-website: #c1592a`, `--color-kanaal-facebook: #2a78d6`, `--color-kanaal-mail: #1baf7a` (CVD-gevalideerd met de dataviz-validator; aqua krijgt altijd een tekstlabel als contrast-relief). Statuskleuren apart van de kanaalkleuren: `--color-ok: #2f7d46`, `--color-warn: #a4690c`, `--color-bad: #b3402b`, elk met een tint voor pills. Status altijd met tekstlabel, nooit alleen kleur.
- Componenten in `src/components/beheer/`: `BeheerNav`, `RunKop`, `Tegels`, `KanaalKaart`, `ConceptTabel`, `FoutenLijst`, `Trend`. Props uit de loader; geen data-toegang in components.
- Mockup (varianten A en B naast elkaar): https://claude.ai/code/artifact/13994baa-08bb-4cbf-ad81-b0b1ccaad955

## 7. Tests en verificatie

- `scripts/lib/metrics.test.ts`: append op tijdelijke map (bestaat niet → aanmaken; twee kanalen → beide aanwezig; corrupt bestand → waarschuwing + overschrijven; nooit throwen).
- `scripts/lib/run-record.test.ts`: record uit fixture-`scrape-metrics.json`; idempotent op `id`; zonder metrics → `fout: "geen metrics"`; samenvattingsregel.
- `scripts/lib/scrape-runs.test.ts`: `runTotalen`, `weekTrend` met backfill-records, ontbrekend bestand → `[]`.
- `scripts/lib/beheer-routes.test.ts`: `/beheer` in disallow, niet in sitemap.
- Dry-runs van de drie scrapers laten geen `scrape-metrics.json` achter.
- Handmatig: `npm run scrape -- --limit 2` gevolgd door `npm run run-record` → record met twee bronnen; `/beheer` toont het in de dev-server; `npm run build` slaagt met én zonder `data/scrape-runs.json`.
- Acceptatie: na de eerstvolgende maandag-run staat een record in `data/scrape-runs.json`, het commit-bericht bevat de samenvatting, en `opgietingen.nl/beheer` toont de run met werkende *Open*-links.

## 8. Buiten scope

`/beheer/bronnen` (vervolgtab; data wordt al verzameld), klik-statistieken (deelproject 3), roostercheck-metrics, historische run-selector, dark mode, chart-library, notificaties.

## 9. Risico

De scrapers krijgen een extra schrijfpunt. Regel: alles in `metrics.ts` zit in try/catch en logt alleen `console.warn`; de corrupt-bestand-test dekt dit pad expliciet. Een metrics-fout mag nooit een scrape-run laten falen.
