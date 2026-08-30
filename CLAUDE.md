# CLAUDE.md — Opgietingen.nl

Context voor toekomstige sessies. De volledige spec staat in [opgietingen-nl-PRD.md](opgietingen-nl-PRD.md); dit bestand vat de kern samen en legt de conventies van deze codebase vast.

> Beeld-prompts voor sfeerbeelden (event-afbeeldingen e.d.) staan in [docs/image-prompts.md](docs/image-prompts.md) — kant-en-klare ChatGPT-prompts per event-type, afgestemd op het kleurpalet van de site.

## Wat is dit

Opgietingen.nl is dé agenda voor opgiet-evenementen (Aufguss-sessies, opgietweekenden, thema-events, kampioenschappen) in sauna's in **Nederland en België**. Bezoekers vinden snel komende opgietingen, filteren op locatie/datum/type, en klikken door naar de sauna via affiliate-links.

- **Businessmodel:** affiliate-commissie + gesponsorde vermeldingen.
- **SEO-first:** organisch verkeer op regio- en maandpagina's is het primaire groeikanaal.
- **Taal:** NL-only bij launch, maar contentstructuur i18n-ready.

## Stack

| Onderdeel | Keuze |
|-----------|-------|
| Framework | Next.js 15 (App Router) + React 19 |
| Taal | TypeScript (strict) |
| Styling | Tailwind CSS v4 (thema in `src/app/globals.css` via `@theme`) |
| Content | Repo-based: MDX + frontmatter. **Geen database in fase 1.** |
| Content parsing | `gray-matter` (frontmatter) + `next-mdx-remote/rsc` (MDX-body) |
| Fonts | `next/font/google` — Fraunces (display) + Inter (body) |
| Hosting | Vercel (auto-deploy via git push) |
| Kaart | Leaflet + OpenStreetMap (overzichtskaart op `/saunas`; OSM-iframe-embed op detailpagina's) |
| Analytics | Vercel Web Analytics + Speed Insights (in `src/app/(site)/layout.tsx`, dus niet op `/keystatic`) |
| Beheer | Keystatic (git-based CMS op /keystatic; GitHub-mode = commits op main) |

## Projectstructuur

```
content/
  saunas/*.mdx      # sauna-profielen (frontmatter + beschrijving)
  events/*.mdx      # opgiet-events (frontmatter + beschrijving/programma)
  bronnen.json      # scraper-bronnen (agendaUrl per sauna, status)
src/
  app/              # App Router routes: publieke routes in (site)/ met SiteChrome, /keystatic (beheer) ernaast
  components/       # herbruikbare UI (SiteHeader, EventCard, filters, ...)
  lib/
    site.ts         # site-config, EVENT_TYPES, PROVINCES, COUNTRY_LABELS
    content.ts      # content-loader: leest & parseert MDX, joint events↔saunas
    clicks.ts       # affiliate klik-logging (fase 1: append naar data/clicks.log)
    scraper.ts      # scraper-laag: Firecrawl (markdown + extractie) + Claude-fallback
    scrape-runs.ts  # loader + helpers voor run-metrics (enige plek die data/scrape-runs.json kent)
keystatic.config.ts  # schema's van het beheerpaneel (1-op-1 op de frontmatter)
scripts/
  verify-bronnen.ts # verifieert agendaUrl's in bronnen.json (robots, discovery)
  scrape-events.ts  # scrapet actieve bronnen → events via kwaliteitspoort (gepubliceerd/concept)
  scrape-report.ts  # bouwt het probleem-issue-rapport (concepts + bronnen + ontbrekende profielen)
  run-record.ts     # vouwt scrape-metrics.json tot een run-record in data/scrape-runs.json
  backfill-runs.ts  # eenmalig: run-records uit de scraper-commits reconstrueren
  lib/              # net.ts (fetch/robots), content.ts (bronnen/dedup/MDX-write), quality-gate.ts (poort), metrics.ts (run-metrics melden)
.github/workflows/
  scrape.yml        # wekelijkse scrape (cron ma 06:00) → commit op main + scraper-issue
data/
  clicks.log        # klik-log (gitignored)
  scrape-runs.json  # run-metrics van de wekelijkse scrape (gecommit door de workflow; bron voor /beheer)
```

## Datamodel (repo-based content)

**Sauna** (`content/saunas/<slug>.mdx` frontmatter): `slug`, `naam`, `land` (`NL`|`BE`), `provincie`, `plaats`, `adres`, `lat`, `lng`, `faciliteiten[]`, `website`, `affiliateUrl`, `sponsored` (bool), `afbeelding`, `logo` (pad in `public/images/logos/`, fallback-beeld als de foto ontbreekt — geldt via de loader ook voor events zonder eigen afbeelding), `logoAchtergrond` (`licht` (default) | `donker` — witte logovarianten hebben `donker` nodig). MDX-body = beschrijving.

**Event** (`content/events/<slug>.mdx` frontmatter): `slug`, `saunaSlug` (koppelt aan sauna), `titel`, `type` (`opgietweekend`|`thema`|`kampioenschap`|`regulier`), `startDatum` (`YYYY-MM-DD`), `eindDatum`, `tijden`, `prijsIndicatie`, `ticketUrl` (affiliate), `afbeelding`, `status` (`concept`|`gepubliceerd`|`afgelopen`|`afgewezen`). MDX-body = beschrijving/programma.

Optioneel veld `bron: scraper` markeert automatisch gescrapete events. Optioneel veld `keurNotitie` bevat de afkeurreden(en) van de kwaliteitspoort wanneer een gescrapet event als `concept` blijft staan.

**Gids** (`content/gidsen/<slug>.mdx` frontmatter): `slug`, `titel`, `samenvatting`, `afbeelding`, `bijgewerkt`, en `producten[]` — affiliate-producten met `id` (uniek, gebruikt in `/uit/product/[id]`), `naam`, `bolUrl`, `afbeelding`, `prijsIndicatie`, `beschrijving`. `bolUrl` is een **gewone bol.com-productlink** (of, optioneel, een kant-en-klare partner-deeplink); de redirect `/uit/product/[id]` wikkelt een gewone link zelf in het partner-clickformat via `toBolAffiliateUrl` met `BOL_SITE_ID` (env, default `1533193`) en hangt `subid=gids-<slug>` aan voor herkomst-tracking. MDX-body = het artikel; producten plaatsbaar via `<Product id="..." />` of `<ProductGrid />` (geïnjecteerd door `Mdx` wanneer `producten` meekomt). Zonder inline-plaatsing tonen gidsen de producten onderaan. Affiliate-disclosure (`AffiliateDisclosure`) verplicht bij producten; bol.com-afbeeldingen via `**.s-bol.com` remote pattern.

> Events joinen aan sauna's via `saunaSlug`. `concept` en `afgewezen` zijn onzichtbaar (gefilterd in de loader); `afgewezen` = beoordeeld en bewust niet op de site (geen opgieting) — het bestand blijft staan als dedup-anker en valt buiten het weekrapport. Gescrapete events komen binnen als `concept` en worden pas zichtbaar na handmatige review + `status: gepubliceerd`.

## Routes (PRD §6)

| Route | Doel |
|-------|------|
| `/` | Home: highlights + komende events + zoekbalk |
| `/agenda` | Volledige agenda — lijst + filters (land, provincie, datum, type); `?weergave=kalender&maand=<maand-jaar>` toont de maandkalender |
| `/agenda/[maand-jaar]` | SEO: events per maand (bv. `november-2026`) |
| `/opgietingen/[provincie]` | SEO: events per regio (bv. `gelderland`) |
| `/event/[slug]` | Event-detail + `Event` structured data |
| `/saunas` | Overzicht sauna's (lijst; kaart volgt) |
| `/sauna/[slug]` | Sauna-profiel + `LocalBusiness` structured data |
| `/gids` | SEO: overzicht gidsartikelen (`ItemList`) |
| `/gids/[slug]` | Gidsartikel + `Article` structured data + bol.com affiliate-producten |
| `/uit/[slug]` | Affiliate-redirect (event/sauna) met klik-logging |
| `/uit/product/[id]` | Affiliate-redirect (bol.com-product) met klik-logging + subid |
| `/keystatic` | Beheerpaneel (Keystatic); noindex + robots-disallow, niet in sitemap |
| `/beheer` | Beheer-dashboard: laatste scrape-run, te beoordelen concepts (→ Keystatic), aandacht, trend; noindex |
| `/over`, `/contact`, `/voor-saunas` | Statische pagina's (B2B-pitch) |

Nieuwsbrief-opt-in is **uitgesteld** naar een latere sessie.

## Conventies

- **Taal:** UI-teksten, commit messages, comments en content zijn in het **Nederlands**.
- **Server Components default.** Alleen filters/interactie zijn client components (`"use client"`).
- **Filters via URL search params** (`?land=NL&provincie=...&type=...&van=...&tot=...`) zodat filterstatus deelbaar/SEO-vriendelijk is en geen client-state nodig heeft.
- **Datums** als ISO-strings (`YYYY-MM-DD`) in frontmatter; formatteren met `Intl.DateTimeFormat("nl-NL")` in `src/lib/dates.ts`.
- **Geen `Date.now()`/`new Date()` in SSG-render paden** waar determinisme telt — gebruik helpers en behandel "vandaag" bewust.
- **Kleuren via themetokens** (`bg-cream`, `text-ink`, `text-ember`, ...), niet via hex in components. Tokens staan in `globals.css`.
- **Affiliate-links altijd via `/uit/[event-of-sauna-slug]`** zodat kliks meetbaar zijn — nooit direct naar de sauna linken vanaf CTA's.
- **SEO:** elke route exporteert `metadata`/`generateMetadata`; detailpagina's renderen JSON-LD structured data; `sitemap.ts` genereert `/sitemap.xml`.

## Content-scraper (pipeline)

Automatische aanvulling van de agenda: haalt opgiet-events op van sauna-websites en zet ze als **concept** in `content/events/`.

**Bronnen** — `content/bronnen.json`: per bron een `id` (= `saunaSlug`, koppelt gescrapete events aan een profiel in `content/saunas/`), `naam`, `land`, `provincie`, `website`, `agendaUrl`, `type` (`website` | `handmatig` | `nieuwsbrief`), optioneel `matchToken`, optioneel `facebook` (URL van de Facebook-pagina; matching-anker voor doorgestuurde posts én fetch-bron voor `scrape-facebook`), `agendaUrlVast` (true = handmatig gecureerde URL: verify checkt alleen bereikbaarheid/inhoud en doet geen discovery/herschrijving — gebruik dit wanneer de discovery een verkeerde pagina blijft kiezen), `status` en `notities`. Alleen bronnen met `status: actief` én `type: website` worden gescrapet. Actieve bronnen hebben een bijbehorend sauna-profiel; niet-actieve bronnen zijn registry-only tot ze gecureerd worden.

Statusbetekenis:
- `actief` — werkende, scrapebare agendapagina gevonden.
- `geen-agenda` — host bereikbaar, maar geen aparte agendapagina op statische HTML (vaak JS-gerenderd) — handmatig controleren.
- `handmatig` — niet-scrapebaar (bv. Facebook/login-wall); handmatige check. Wordt door `verify-bronnen` nooit aangepast.
- `aanvullen` — placeholder, bron nog in te vullen.
- `opzetten` — toekomstig kanaal (bv. nieuwsbrief-forward), nog op te zetten.
- `kapot` — host onbereikbaar (DNS/timeout) / URL ongeldig.

`verify-bronnen` slaat `handmatig`/`aanvullen`/`opzetten` en niet-website-types over.

**Verifiëren** (`npm run verify-bronnen`) — fetcht elke `agendaUrl` (redirects, correcte robots.txt-naleving incl. `*`/`$`-wildcards; robots geldt ook voor de directe fetches), zoekt via sitemap + homepage-links de juiste agendapagina als het pad afwijkt (scoring in `scripts/lib/discovery.ts`: trefwoorden, blog/nieuws/zakelijk uitgesloten, ondiepe sectiepagina's verkozen, incumbent-bonus voor de huidige URL en penalty voor jaartallen in het pad zodat campagnepagina's een werkende agenda-URL niet verdringen), en schrijft de juiste status + URL + notitie terug (curatienotities blijven staan bij een herbevestiging; bij `geen-agenda` blijft de opgegeven URL behouden). Bronnen met `agendaUrlVast: true` worden nooit herschreven. Als de kale fetch geen agendapagina oplevert (JS-gerenderd), volgt een **Firecrawl-fallback** (echte browser-rendering; robots blijft gelden) via `firecrawlFetchMarkdown` — vereist `FIRECRAWL_API_KEY`. `-- --all` her-verifieert alles (behalve `handmatig`). `npm run bronnen-report` print een markdown-statusrapport.

**Scrapen** (`npm run scrape`) — per actieve bron:
1. **Fetch + extractie via `src/lib/scraper.ts`** (de enige, vervangbare fetch-laag), goedkoopste route eerst omdat Firecrawl-credits de schaarse resource zijn: **(a)** kale fetch (gratis) — levert die ≥ `MIN_STATIC_TEXT_CHARS` statische tekst op, dan extraheert `claude-haiku-4-5` daaruit direct en wordt Firecrawl overgeslagen (ook bij 0 events: liever een false negative dan credits verbranden); **(b)** JS-shell of kale route faalt → Firecrawl haalt de pagina als markdown op én doet structured extraction met het event-datamodel als JSON-schema; **(c)** valt dat tegen → Claude-extractie op de Firecrawl-markdown.
2. **Dedup** tegen bestaande events op `saunaSlug + startDatum` (bestaande events worden nooit overschreven). Daarnaast de **afwijs-index** (`existingAfwijsIndex`, sleutel `saunaSlug + slugify(titel)`, zonder datum): een titel die bij die sauna al eens in Keystatic op `afgewezen` is gezet wordt overgeslagen zonder bestand — de index zelf is het anker — en telt als `dedup` (+ deelteller `afgewezen`, zichtbaar op `/beheer`). Dit is de leerstap van het systeem: één afwijzing volstaat voor alle latere edities van dezelfde niet-opgieting. Bewust exacte titelmatch per sauna, geen fuzzy matching. Geldt voor alle drie de kanalen. Daarnaast een **cross-sauna-check** op `slugify(titel) + startDatum` (`existingTitelDatumIndex`): keten-sauna's kondigen elkaars events aan, en omdat elke aankondiger een eigen `saunaSlug` heeft ziet de gewone dedup dat niet — zo stond de BeWellness Aufguss Challenge-finale van 2026-10-02 vijf keer live. Bij een hit onder een ándere sauna wordt het event nooit automatisch gepubliceerd, maar als `concept` weggeschreven met een notitie die de eerste vindplaats noemt. De index groeit tijdens de run mee, zodat twee sauna's die in dezelfde run hetzelfde event aankondigen elkaar ook opvangen.
3. **Kwaliteitspoort** (`scripts/lib/quality-gate.ts`): elk event wordt beoordeeld op harde criteria — geldige toekomstige ISO-datum, bestaande `saunaSlug`, niet-lege `titel`, geldig `type`, en een opgiet-trefwoord (opgiet/aufguss/löyly/saunaritueel/gietceremonie) in titel of beschrijving. Bij twijfel afkeuren (false negatives acceptabel, false positives niet).
4. **Schrijft** nieuwe events als MDX met `bron: scraper` — behalve wanneer de poort `verleden: true` teruggeeft: een afgelopen datum wordt elke run opnieuw afgekeurd, dus zo'n concept is geen bruikbaar dedup-anker maar een bestand dat voorgoed in het weekrapport blijft staan. Die worden overgeslagen. Status: **`gepubliceerd`** als het event door de poort komt, `SCRAPE_AUTOPUBLISH=true` staat én het opgiet-trefwoord in de **titel** staat (alleen in de beschrijving = concept met notitie: een modelgegenereerde beschrijving kan het woord terloops bevatten terwijl het event een brunch is); anders **`concept`**, met de afkeurreden(en) in `keurNotitie`. De MDX-body wordt ge-escaped tegen MDX-syntax (`<`, `{`, `}`): één gescrapete "<12 jaar" zou anders de hele build breken en `{…}` zou als JS worden uitgevoerd tijdens de build. Bij het wegschrijven normaliseert `writeEventMdx` em-streepjes (—) uit de zichtbare tekst (`normalizeProseDashes` voor titel/beschrijving → komma of koppelteken; `normalizeRangeDashes` voor tijden/prijs → half streepje `–`), omdat die 'AI-achtig' lezen. Dit is het enige schrijfpunt, dus zowel de website- als de nieuwsbrief-scraper zijn gedekt.

Flags: `-- --limit N` (eerste N bronnen), `-- --dry-run` (mock-extractie incl. afkeur-cases; test poort + dedup + MDX zonder API-keys). Env `SCRAPE_AUTOPUBLISH=true` schakelt auto-publiceren aan (uit = alles blijft `concept`, voor de rollout-fase).

**Nieuwsbrief-kanaal (`events@opgietingen.nl`)** — tweede fetch-laag naast de website-scraper, met identieke verwerking (extractie → dedup → poort → MDX), op één punt na: **mail-events publiceren nooit automatisch** (altijd `concept`), omdat een From-header spoofbaar is en er geen DKIM/DMARC-verificatie in deze laag zit. `npm run scrape-mail` leest **ongelezen** mails uit een gedeelde IMAP-inbox (`scripts/lib/mail.ts`), extraheert events uit de mailinhoud via Claude (`extractEventsFromText` in `src/lib/scraper.ts` — geen Firecrawl, de mail levert de inhoud al), en koppelt elke mail op **afzender → sauna** (`matchBronBySender`: `matchToken` alleen als die op een adres/domein lijkt, anders het `website`-domein — platform-hosts zoals facebook.com en ambigue keten-domeinen zoals thermae.com matchen bewust niet). Ticket-URL's uit mail worden alleen geaccepteerd als ze naar het domein van de bron wijzen. Onbekende afzenders blijven `concept` met het afzender-domein in `keurNotitie` voor handmatige toewijzing. Verwerkte mails worden pas **ná** succesvolle verwerking als gelezen (`\Seen`) gemarkeerd (markeren bij het ophalen zou mailverlies betekenen bij een extractie-crash); dedup op `saunaSlug + startDatum` blijft de tweede vangnet. Env: `MAIL_IMAP_HOST`/`MAIL_IMAP_USER`/`MAIL_IMAP_PASS` (+ optioneel `MAIL_IMAP_PORT`/`MAIL_IMAP_TLS`/`MAIL_IMAP_MAILBOX`). Zonder `MAIL_IMAP_HOST` slaat de stap zichzelf netjes over. De wekelijkse workflow draait dit als stap 3.

**Facebook-doorstuurkanaal (via dezelfde inbox)** — sauna's kondigen opgietweekenden vaak (alleen) op Facebook aan, en Facebook is niet direct scrapebaar (login-wall, bot-detectie; een anonieme fetch van een publieke post levert een lege foutpagina op). De workflow is: posttekst kopiëren + link naar de post of pagina erbij, mailen naar `events@opgietingen.nl` (regel: **altijd de posttekst meeplakken** — de link is voor de matching, de tekst voor de extractie; een mail met alleen een link levert 0 events op en wordt alleen gelogd). Mails van een vertrouwd doorstuur-adres (env `MAIL_VERTROUWDE_AFZENDERS`, kommagescheiden, volledig adres) worden bij een gemiste afzender-match op **inhoud** gekoppeld via `matchBronByContent`: eerst het `facebook`-veld van de bronnen (paginanaam uit post-/pagina-URLs, www./m.-varianten, met domeingrens-checks tegen lookalike-domeinen), dan het website-domein als fallback — uniek of niets, ambigu blijft het bestaande vangnet (concept + keurNotitie). Trusted bepaalt alleen de kóppeling, nooit de publicatiestatus. Zie de [spec](docs/superpowers/specs/2026-08-02-facebook-doorstuurkanaal-design.md).

**Facebook-postscraper** (`npm run scrape-facebook`) — gratis, geautomatiseerde tegenhanger van het doorstuurkanaal hierboven: haalt voor elke bron met een `facebook`-veld de recente foto-posts op via `gallery-dl` (`src/lib/facebook.ts`, geen login/API-key nodig — publieke pagina's zijn zo bereikbaar) en verwerkt de caption-tekst door dezelfde `extractEventsFromText`-route als het nieuwsbriefkanaal. In tegenstelling tot het mailkanaal geldt hier **dezelfde publicatieregel als de website-scraper** (poort + opgiet-trefwoord in de titel + `SCRAPE_AUTOPUBLISH=true` → gepubliceerd): de `facebook`-URL komt uit onze eigen gecureerde `bronnen.json`, niet uit een spoofbare afzender. Beperkingen: alleen posts **met een foto** worden gezien (gallery-dl haalt de `/photos`-tab op), posts ouder dan 60 dagen worden overgeslagen, en een Facebook-layoutwijziging laat die ene bron falen met een waarschuwing zonder de rest van de run te raken. Vereist `gallery-dl` op de runner (`pip install gallery-dl`); geen nieuwe secrets. Instagram blijft bewust buiten scope. Zie de [spec](docs/superpowers/specs/2026-08-26-facebook-postscraper-design.md).

**Env / secrets:** `FIRECRAWL_API_KEY` (fetch + primaire extractie + verify-fallback), `ANTHROPIC_API_KEY` (extractie-fallback + nieuwsbrief-extractie), `MAIL_IMAP_*` (nieuwsbrief-inbox), `MAIL_VERTROUWDE_AFZENDERS` (doorstuur-route). Lokaal via `.env`/export; in CI via GitHub Actions secrets.

**Rooster-hercheck** (`npm run check-roosters`) — de vaste opgietroosters op sauna-profielen (`opgietRooster` + `roosterGecheckt`) verouderen; dit script hercontroleert roosters ouder dan `--max-dagen` (default 60) tegen de sauna-website (kale fetch, geen Firecrawl; optionele frontmatter `roosterBron` wijst de pagina aan waar het rooster letterlijk staat als dat niet de agenda-URL is). Drie uitkomsten: **bevestigd** (→ `roosterGecheckt` = vandaag, minimale diff), **afwijkend** (→ probleem in `rooster-check.json`, komt in het weekissue) en **niet-gevonden** (rooster staat niet op de controle-pagina; geen vals alarm — zulke profielen verschijnen na 90 dagen via de staleness-check in het rapport voor een handmatige check). `-- --dry-run` toont alleen wat verouderd is; `-- --sauna <slug>` hercontroleert één profiel ongeacht hoe vers `roosterGecheckt` is (nodig omdat een eenmaal gemelde afwijking anders uit beeld verdwijnt tot het profiel na `--max-dagen` vanzelf weer aan de beurt is) en laat `rooster-check.json` met rust.

**Rooster-vinder** (`npm run vind-roosters`) — tegenhanger van de hercheck: zoekt een rooster voor profielen die er nog **géén** hebben (zonder rooster heeft een provinciepagina zonder events niets te tonen). Zelfde fetch-route (kale fetch, robots, `roosterBron` > agendaUrl > website), maar schrijft **nooit** in de profielen: een nieuw rooster opvoeren is een grotere claim dan een bestaand rooster bevestigen. De voorstellen komen met een letterlijk broncitaat in `rooster-voorstellen.json` (gitignored) voor handmatige overname. `-- --sauna <slug>` en `-- --dry-run` werken als bij de hercheck. Bewust géén onderdeel van de wekelijkse workflow: de uitkomst vereist een menselijk oordeel.

**IndexNow** (`npm run indexnow`) — meldt de in de laatste commit gewijzigde publieke URL's aan bij IndexNow (Bing/Yandex c.s.); Google doet niet mee, daar blijft `sitemap.xml` het kanaal. Bewust alleen wijzigingen, niet de hele sitemap: die herhaald inleveren is spam-gedrag. Concept-events vallen af (onzichtbaar), en de lijstpagina's die door een wijziging meeveranderen (home, `/agenda`, de maand- en provinciepagina) worden meegestuurd. De sleutel staat publiek in `public/<key>.txt` — dat hoort zo bij IndexNow en bewijst domeineigenaarschap; geen secret nodig. `-- --since <ref>` verruimt het bereik, `-- --dry-run` toont de lijst. Draait in de workflow alleen ná een échte commit.

**Automatisering (hands-off):** `.github/workflows/scrape.yml` draait elke maandag 06:00 UTC (+ handmatig via `workflow_dispatch`): eerst `verify-bronnen -- --all`, dan `scrape` met `SCRAPE_AUTOPUBLISH=true`, dan `scrape-facebook`, dan `scrape-mail`, dan `check-roosters`. De resultaten (nieuwe events + bijgewerkte `bronnen.json`) worden **direct op `main` gecommit** (Vercel deployt automatisch); daarna meldt `indexnow` de gewijzigde URL's aan; concept-events komen mee maar zijn onzichtbaar (loader filtert ze). Daarna bouwt `npm run scrape-report` een rapport en beheert de workflow **één** GitHub-issue met label `scraper-probleem`: bij twijfelgevallen/kapotte bronnen/ontbrekende profielen wordt het geopend of geactualiseerd (GitHub's notificatiemail = de melding); een schone run sluit het. Geen review vooraf; steekproef achteraf.

> Model: de fallback-extractie gebruikt bewust `claude-haiku-4-5` (snel/goedkoop). Wijzig via `FALLBACK_MODEL` in `src/lib/scraper.ts`.

**Run-metrics (`npm run run-record`)** — `verify-bronnen` en de drie scrapers melden via `scripts/lib/metrics.ts` per bron zeven tellers (kandidaten, dedup, verleden, afgekeurd, concept, gepubliceerd + `fout`/`methode`; invariant: kandidaten = dedup + verleden + concept + gepubliceerd), elk weggeschreven event en de bronnen-statuswijzigingen aan een tijdelijk `scrape-metrics.json`. Alles in try/catch: een metrics-fout mag nooit een scrape laten falen; `--dry-run` schrijft niets. Na de run vouwt `run-record` dat tot één record in `data/scrape-runs.json` (idempotent op de starttijd `RUN_GESTART`; stopt bij een corrupte of gedeeltelijk onleesbare historie in plaats van te overschrijven), en de workflow commit het mee met een samenvattend bericht — dus elke week een commit, ook bij 0 events. `/beheer` leest het bestand via `src/lib/scrape-runs.ts`. Oude runs zijn met `scripts/backfill-runs.ts` uit de git-historie gereconstrueerd (`backfill: true`, alleen events; alle kanalen tellen daar als website; runs zonder events hebben geen record). `methode` `firecrawl` én `claude` betekenen beide een Firecrawl-fetch (alleen `statisch` is gratis). Spec: [docs/superpowers/specs/2026-08-30-beheer-dashboard-scrape-metrics-design.md](docs/superpowers/specs/2026-08-30-beheer-dashboard-scrape-metrics-design.md).

## Beheer (Keystatic)

`/keystatic` is het beheerpaneel: concepts beoordelen, sauna-profielen, gidsen en `content/bronnen.json` bewerken in de browser. Git blijft de bron van waarheid: in GitHub-mode is elke save een commit op `main` onder het GitHub-account van de ingelogde gebruiker, waarna Vercel deployt. Schema's staan in `keystatic.config.ts` en zijn 1-op-1 op de frontmatter/JSON; `scripts/lib/keystatic-schema.test.ts` bewaakt twee richtingen — elk contentveld staat in het schema (een onbekend veld zou bij een save verdwijnen) én elke entry haalt de schema-validatie via het Keystatic-reader-pad (wat daar faalt, kan in het paneel niet worden opgeslagen). Toegang = schrijfrecht op de repo. Zonder de `KEYSTATIC_*`-env-vars (zie `.env.example`) draait het paneel in local-mode en bewerkt het bestanden op schijf. Local-mode is onbeveiligd en bestaat daarom alleen in development: in productie zonder `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` geven `/keystatic` en `/api/keystatic` 404 (`src/lib/beheer.ts`, test `scripts/lib/beheer.test.ts`). Zet op Vercel altijd alle vier de `KEYSTATIC_*`-variabelen tegelijk en deploy daarna opnieuw (de `NEXT_PUBLIC_`-waarde wordt bij de build ingebakken). `/beheer` is het dashboard van de wekelijkse scrape (zie *Run-metrics*); het volgt dezelfde 404/noindex-regel. Let op: de guard wordt bij de build geëvalueerd, dus de `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` moet in de Vercel-buildomgeving staan.

Gebruiksregels:
- **Concepts niet verwijderen.** Dedup werkt op `saunaSlug + startDatum`; een verwijderd concept komt de volgende run terug. Afwijzen = status op `afgewezen` (onzichtbaar, valt uit het weekrapport, en de scrapers slaan dezelfde titel bij die sauna voortaan over via de afwijs-index). Let op: `afgelopen` maakt een event níet onzichtbaar — de "afgelopen"-weergave hangt aan de datum.
- `keurNotitie` laten staan (historie); publiceren gaat via `status`. Keystatic kent geen alleen-lezen veld, dus dit is een afspraak, geen slot.
- Slugs van bestaande events/sauna's/gidsen niet wijzigen (URL's en koppelingen).
- Machine-velden (`laatstGecontroleerd`, `roosterGecheckt`, `laatstBijgewerkt`) worden door de scripts gezet; `laatstBijgewerkt` en `$comment` zijn in het paneel onzichtbaar (`fields.ignored`).
- Beelden niet via het paneel: pad invullen, bestand in `public/images/` plaatsen (zie `docs/image-prompts.md`).
- Product-ids in gidsen zijn globaal uniek over álle gidsen heen (ze vormen `/uit/product/<id>`).
- MDX-valkuilen: het paneel opent geen body met HTML-tags, `{…}`-expressies of een ongeëscapete `<` (bv. `<12 jaar`), en footnotes (`[^1]`) raken verminkt. De scraper escapet `<`/`{`/`}` al (`escapeMdxText`); handmatige bodies moeten dat ook.

Eerste save van een bestaand bestand geeft een eenmalige, cosmetische diff: frontmatter in schemavolgorde en herquotet, datums ongequote (YAML-Date; de loader en scripts, incl. `indexnow`, lezen dat via `toISODate`), `-`-lijsten worden `*`, defaults worden gematerialiseerd (`logoAchtergrond: licht`, `bron: handmatig`, `agendaUrlVast: false`, `producten: []`), lege strings in `bronnen.json` verdwijnen als sleutel, `#`-commentaar in frontmatter gaat verloren, en een kale URL in een body wordt een markdown-link. Vanaf de tweede save is de diff minimaal.

Het paneel staat in `robots.ts` op disallow, niet in de sitemap, en de layout zet `noindex` (test: `scripts/lib/beheer-routes.test.ts`). Publieke routes staan in `src/app/(site)/` met `SiteChrome` (skip-link, header, main, footer) en daar staan ook Vercel Analytics en Speed Insights; het paneel valt daarbuiten en wordt niet gemeten. Spec: [docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md](docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md).

## Commando's

```bash
npm run dev             # dev-server (http://localhost:3000)
npm run build           # productie-build (verifieer hiermee vóór commit)
npm run start           # productie-server
npm run lint            # eslint
npm run test            # unit-tests (node:test via tsx) — o.a. de kwaliteitspoort
npm run verify-bronnen  # controleer/actualiseer agendaUrl's in bronnen.json
npm run bronnen-report  # markdown-statusrapport van alle bronnen
npm run scrape          # scrape actieve bronnen → events via poort (API-keys nodig)
npm run scrape -- --dry-run   # test de pipeline + poort zonder API-keys
npm run scrape-mail     # verwerk ongelezen nieuwsbrieven uit de inbox (IMAP + ANTHROPIC_API_KEY)
npm run scrape-mail -- --dry-run  # mock-inbox; test matching + poort zonder keys
npm run scrape-facebook # scrape Facebook-postaankondigingen (gallery-dl, gratis) → poort
npm run scrape-facebook -- --dry-run  # mock-extractie; test poort + dedup zonder gallery-dl/keys
npm run check-roosters  # hercontroleer verouderde opgietroosters (ANTHROPIC_API_KEY)
npm run vind-roosters   # zoek roosters voor profielen zónder rooster → voorstellen ter review
npm run indexnow        # meld gewijzigde URL's aan bij IndexNow (Bing c.s.)
npm run fetch-logos     # haal logo's op voor sauna-profielen zonder beeld (geen keys nodig)
npm run scrape-report   # bouw scrape-issue.md + print problemen/schoon
npm run run-record  # vouw scrape-metrics.json tot een run-record (workflow-stap; -- --dry-run toont het record)

```

## Fase-grenzen

- **Fase 1 (nu):** MVP — agenda, filters, detail-/saunapagina's, SEO-pagina's, affiliate-redirects. Geen DB, geen auth, geen community.
- **Fase 2 (later, bij aantoonbaar verkeer):** reviews, accounts (magic link), favorieten, foto-uploads. Migratiepad: repo-content → Postgres (Neon/Vercel), MDX → headless CMS. Bouw fase 1 daarom **architecture-ready**: content achter een loader-abstractie (`src/lib/content.ts`) zodat de databron later te vervangen is zonder de UI te raken.
