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
src/
  app/              # App Router routes (zie hieronder)
  components/       # herbruikbare UI (SiteHeader, EventCard, filters, ...)
  lib/
    site.ts         # site-config, EVENT_TYPES, PROVINCES, COUNTRY_LABELS
    content.ts      # content-loader: leest & parseert MDX, joint events↔saunas
    clicks.ts       # affiliate klik-logging (fase 1: append naar data/clicks.log)
data/
  clicks.log        # klik-log (gitignored)
```

## Datamodel (repo-based content)

**Sauna** (`content/saunas/<slug>.mdx` frontmatter): `slug`, `naam`, `land` (`NL`|`BE`), `provincie`, `plaats`, `adres`, `lat`, `lng`, `faciliteiten[]`, `website`, `affiliateUrl`, `sponsored` (bool), `afbeelding`. MDX-body = beschrijving.

**Event** (`content/events/<slug>.mdx` frontmatter): `slug`, `saunaSlug` (koppelt aan sauna), `titel`, `type` (`opgietweekend`|`thema`|`kampioenschap`|`regulier`), `startDatum` (`YYYY-MM-DD`), `eindDatum`, `tijden`, `prijsIndicatie`, `ticketUrl` (affiliate), `afbeelding`, `status` (`concept`|`gepubliceerd`|`afgelopen`). MDX-body = beschrijving/programma.

> Events joinen aan sauna's via `saunaSlug`. Alleen `status: gepubliceerd` events zijn zichtbaar (concepts worden gefilterd in de loader).

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

## Commando's

```bash
npm run dev      # dev-server (http://localhost:3000)
npm run build    # productie-build (verifieer hiermee vóór commit)
npm run start    # productie-server
npm run lint     # eslint
```

## Fase-grenzen

- **Fase 1 (nu):** MVP — agenda, filters, detail-/saunapagina's, SEO-pagina's, affiliate-redirects. Geen DB, geen auth, geen community.
- **Fase 2 (later, bij aantoonbaar verkeer):** reviews, accounts (magic link), favorieten, foto-uploads. Migratiepad: repo-content → Postgres (Neon/Vercel), MDX → headless CMS. Bouw fase 1 daarom **architecture-ready**: content achter een loader-abstractie (`src/lib/content.ts`) zodat de databron later te vervangen is zonder de UI te raken.
