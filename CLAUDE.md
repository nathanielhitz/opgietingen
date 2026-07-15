# CLAUDE.md — Opgietingen.nl

Context voor toekomstige sessies. De volledige spec staat in [opgietingen-nl-PRD.md](opgietingen-nl-PRD.md); dit bestand vat de kern samen en legt de conventies van deze codebase vast.

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
| Kaart | Leaflet + OpenStreetMap (nog te implementeren) |
| Analytics | Plausible of Vercel Analytics (nog te implementeren) |

## Projectstructuur

```
content/
  saunas/*.mdx      # sauna-profielen (frontmatter + beschrijving)
  events/*.mdx      # opgiet-events (frontmatter + beschrijving/programma)
  bronnen.json      # scraper-bronnen (agendaUrl per sauna, status)
src/
  app/              # App Router routes (zie hieronder)
  components/       # herbruikbare UI (SiteHeader, EventCard, filters, ...)
  lib/
    site.ts         # site-config, EVENT_TYPES, PROVINCES, COUNTRY_LABELS
    content.ts      # content-loader: leest & parseert MDX, joint events↔saunas
    clicks.ts       # affiliate klik-logging (fase 1: append naar data/clicks.log)
    scraper.ts      # scraper-laag: Firecrawl (markdown + extractie) + Claude-fallback
scripts/
  verify-bronnen.ts # verifieert agendaUrl's in bronnen.json (robots, discovery)
  scrape-events.ts  # scrapet actieve bronnen → events via kwaliteitspoort (gepubliceerd/concept)
  scrape-report.ts  # bouwt het probleem-issue-rapport (concepts + bronnen + ontbrekende profielen)
  lib/              # net.ts (fetch/robots), content.ts (bronnen/dedup/MDX-write), quality-gate.ts (poort)
.github/workflows/
  scrape.yml        # wekelijkse scrape (cron ma 06:00) → commit op main + scraper-issue
data/
  clicks.log        # klik-log (gitignored)
```

## Datamodel (repo-based content)

**Sauna** (`content/saunas/<slug>.mdx` frontmatter): `slug`, `naam`, `land` (`NL`|`BE`), `provincie`, `plaats`, `adres`, `lat`, `lng`, `faciliteiten[]`, `website`, `affiliateUrl`, `sponsored` (bool), `afbeelding`. MDX-body = beschrijving.

**Event** (`content/events/<slug>.mdx` frontmatter): `slug`, `saunaSlug` (koppelt aan sauna), `titel`, `type` (`opgietweekend`|`thema`|`kampioenschap`|`regulier`), `startDatum` (`YYYY-MM-DD`), `eindDatum`, `tijden`, `prijsIndicatie`, `ticketUrl` (affiliate), `afbeelding`, `status` (`concept`|`gepubliceerd`|`afgelopen`). MDX-body = beschrijving/programma.

Optioneel veld `bron: scraper` markeert automatisch gescrapete events. Optioneel veld `keurNotitie` bevat de afkeurreden(en) van de kwaliteitspoort wanneer een gescrapet event als `concept` blijft staan.

> Events joinen aan sauna's via `saunaSlug`. Alleen `status: gepubliceerd` events zijn zichtbaar (concepts worden gefilterd in de loader). Gescrapete events komen binnen als `concept` en worden pas zichtbaar na handmatige review + `status: gepubliceerd`.

## Routes (PRD §6)

| Route | Doel |
|-------|------|
| `/` | Home: highlights + komende events + zoekbalk |
| `/agenda` | Volledige agenda — lijst + filters (land, provincie, datum, type) |
| `/agenda/[maand-jaar]` | SEO: events per maand (bv. `november-2026`) |
| `/opgietingen/[provincie]` | SEO: events per regio (bv. `gelderland`) |
| `/event/[slug]` | Event-detail + `Event` structured data |
| `/saunas` | Overzicht sauna's (lijst; kaart volgt) |
| `/sauna/[slug]` | Sauna-profiel + `LocalBusiness` structured data |
| `/uit/[slug]` | Affiliate-redirect met klik-logging |
| `/over`, `/contact`, `/voor-saunas` | Statische pagina's (B2B-pitch) |

Kalenderweergave en nieuwsbrief-opt-in zijn **uitgesteld** naar een latere sessie.

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

**Bronnen** — `content/bronnen.json`: per bron een `id` (= `saunaSlug`, koppelt gescrapete events aan een profiel in `content/saunas/`), `naam`, `land`, `provincie`, `website`, `agendaUrl`, `type` (`website` | `handmatig` | `nieuwsbrief`), optioneel `matchToken`, `status` en `notities`. Alleen bronnen met `status: actief` én `type: website` worden gescrapet. Actieve bronnen hebben een bijbehorend sauna-profiel; niet-actieve bronnen zijn registry-only tot ze gecureerd worden.

Statusbetekenis:
- `actief` — werkende, scrapebare agendapagina gevonden.
- `geen-agenda` — host bereikbaar, maar geen aparte agendapagina op statische HTML (vaak JS-gerenderd) — handmatig controleren.
- `handmatig` — niet-scrapebaar (bv. Facebook/login-wall); handmatige check. Wordt door `verify-bronnen` nooit aangepast.
- `aanvullen` — placeholder, bron nog in te vullen.
- `opzetten` — toekomstig kanaal (bv. nieuwsbrief-forward), nog op te zetten.
- `kapot` — host onbereikbaar (DNS/timeout) / URL ongeldig.

`verify-bronnen` slaat `handmatig`/`aanvullen`/`opzetten` en niet-website-types over.

**Verifiëren** (`npm run verify-bronnen`) — fetcht elke `agendaUrl` (redirects, correcte robots.txt-naleving incl. `*`/`$`-wildcards), zoekt via sitemap + homepage-links de juiste agendapagina als het pad afwijkt (scoort op trefwoorden, sluit blog/nieuws/zakelijk uit, verkiest ondiepe sectiepagina's), en schrijft de juiste status + URL + notitie terug. Als de kale fetch geen agendapagina oplevert (JS-gerenderd), volgt een **Firecrawl-fallback** (echte browser-rendering; robots blijft gelden) via `firecrawlFetchMarkdown` — vereist `FIRECRAWL_API_KEY`. `-- --all` her-verifieert alles (behalve `handmatig`). `npm run bronnen-report` print een markdown-statusrapport.

**Scrapen** (`npm run scrape`) — per actieve bron:
1. **Fetch + extractie via `src/lib/scraper.ts`** (de enige, vervangbare fetch-laag), goedkoopste route eerst omdat Firecrawl-credits de schaarse resource zijn: **(a)** kale fetch (gratis) — levert die ≥ `MIN_STATIC_TEXT_CHARS` statische tekst op, dan extraheert `claude-haiku-4-5` daaruit direct en wordt Firecrawl overgeslagen (ook bij 0 events: liever een false negative dan credits verbranden); **(b)** JS-shell of kale route faalt → Firecrawl haalt de pagina als markdown op én doet structured extraction met het event-datamodel als JSON-schema; **(c)** valt dat tegen → Claude-extractie op de Firecrawl-markdown.
2. **Dedup** tegen bestaande events op `saunaSlug + startDatum` (bestaande events worden nooit overschreven).
3. **Kwaliteitspoort** (`scripts/lib/quality-gate.ts`): elk event wordt beoordeeld op harde criteria — geldige toekomstige ISO-datum, bestaande `saunaSlug`, niet-lege `titel`, geldig `type`, en een opgiet-trefwoord (opgiet/aufguss/löyly/saunaritueel/gietceremonie) in titel of beschrijving. Bij twijfel afkeuren (false negatives acceptabel, false positives niet).
4. **Schrijft** nieuwe events als MDX met `bron: scraper`. Status: **`gepubliceerd`** als het event door de poort komt én `SCRAPE_AUTOPUBLISH=true` staat; anders **`concept`**, met de afkeurreden(en) in `keurNotitie`. Bij het wegschrijven normaliseert `writeEventMdx` em-streepjes (—) uit de zichtbare tekst (`normalizeProseDashes` voor titel/beschrijving → komma of koppelteken; `normalizeRangeDashes` voor tijden/prijs → half streepje `–`), omdat die 'AI-achtig' lezen. Dit is het enige schrijfpunt, dus zowel de website- als de nieuwsbrief-scraper zijn gedekt.

Flags: `-- --limit N` (eerste N bronnen), `-- --dry-run` (mock-extractie incl. afkeur-cases; test poort + dedup + MDX zonder API-keys). Env `SCRAPE_AUTOPUBLISH=true` schakelt auto-publiceren aan (uit = alles blijft `concept`, voor de rollout-fase).

**Nieuwsbrief-kanaal (`events@opgietingen.nl`)** — tweede fetch-laag naast de website-scraper, met identieke verwerking (extractie → dedup → poort → MDX). `npm run scrape-mail` leest **ongelezen** mails uit een gedeelde IMAP-inbox (`scripts/lib/mail.ts`), extraheert events uit de mailinhoud via Claude (`extractEventsFromText` in `src/lib/scraper.ts` — geen Firecrawl, de mail levert de inhoud al), en koppelt elke mail op **afzender → sauna** (`matchBronBySender`: expliciete `matchToken` of het `website`-domein van een bron). Onbekende afzenders blijven `concept` met de afzender in `keurNotitie` voor handmatige toewijzing. Verwerkte mails worden als gelezen (`\Seen`) gemarkeerd zodat een volgende run ze overslaat; dedup op `saunaSlug + startDatum` blijft de tweede vangnet. Env: `MAIL_IMAP_HOST`/`MAIL_IMAP_USER`/`MAIL_IMAP_PASS` (+ optioneel `MAIL_IMAP_PORT`/`MAIL_IMAP_TLS`/`MAIL_IMAP_MAILBOX`). Zonder `MAIL_IMAP_HOST` slaat de stap zichzelf netjes over. De wekelijkse workflow draait dit als stap 3.

**Env / secrets:** `FIRECRAWL_API_KEY` (fetch + primaire extractie + verify-fallback), `ANTHROPIC_API_KEY` (extractie-fallback + nieuwsbrief-extractie), `MAIL_IMAP_*` (nieuwsbrief-inbox). Lokaal via `.env`/export; in CI via GitHub Actions secrets.

**Automatisering (hands-off):** `.github/workflows/scrape.yml` draait elke maandag 06:00 UTC (+ handmatig via `workflow_dispatch`): eerst `verify-bronnen -- --all`, dan `scrape` met `SCRAPE_AUTOPUBLISH=true`. De resultaten (nieuwe events + bijgewerkte `bronnen.json`) worden **direct op `main` gecommit** (Vercel deployt automatisch); concept-events komen mee maar zijn onzichtbaar (loader filtert ze). Daarna bouwt `npm run scrape-report` een rapport en beheert de workflow **één** GitHub-issue met label `scraper-probleem`: bij twijfelgevallen/kapotte bronnen/ontbrekende profielen wordt het geopend of geactualiseerd (GitHub's notificatiemail = de melding); een schone run sluit het. Geen review vooraf; steekproef achteraf.

> Model: de fallback-extractie gebruikt bewust `claude-haiku-4-5` (snel/goedkoop). Wijzig via `FALLBACK_MODEL` in `src/lib/scraper.ts`.

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
npm run scrape-report   # bouw scrape-issue.md + print problemen/schoon
```

## Fase-grenzen

- **Fase 1 (nu):** MVP — agenda, filters, detail-/saunapagina's, SEO-pagina's, affiliate-redirects. Geen DB, geen auth, geen community.
- **Fase 2 (later, bij aantoonbaar verkeer):** reviews, accounts (magic link), favorieten, foto-uploads. Migratiepad: repo-content → Postgres (Neon/Vercel), MDX → headless CMS. Bouw fase 1 daarom **architecture-ready**: content achter een loader-abstractie (`src/lib/content.ts`) zodat de databron later te vervangen is zonder de UI te raken.
