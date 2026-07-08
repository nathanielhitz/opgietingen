# PRD — Opgietingen.nl

## 1. Samenvatting

Opgietingen.nl is dé agenda voor opgiet-evenementen (Aufguss-sessies, opgietweekenden, themadagen) in sauna's in Nederland en België. Bezoekers vinden snel welke opgietingen er binnenkort zijn, filteren op locatie en datum, en klikken door naar de sauna (affiliate/gesponsorde links). In fase 2 komt een community-laag waar bezoekers ervaringen delen.

**Businessmodel:** affiliate-commissie en gesponsorde vermeldingen van sauna's.

## 2. Doelgroep

- Saunaliefhebbers in NL en BE die gericht opgietingen/Aufguss-events zoeken
- Aufguss-fans die speciale evenementen (kampioenschappen, themaweekenden) volgen
- Sauna's die zichtbaarheid willen voor hun events (B2B, later)

## 3. Scope

### Fase 1 — MVP (launch)
1. **Evenementen-agenda** — overzicht van alle opgiet-evenementen, gesorteerd op datum
2. **Filteren & zoeken** — op provincie/regio, land (NL/BE), datum(bereik), type event (regulier opgietweekend, thema, kampioenschap)
3. **Event-detailpagina** — datum/tijden, sauna, beschrijving, programma, prijsindicatie, CTA-knop "Bekijk bij [sauna]" (affiliate link)
4. **Saunapagina's** — profiel per sauna: locatie (kaart), faciliteiten, komende events, affiliate link naar tickets/entree
5. **Kalenderweergave** — maandkalender naast lijstweergave
6. **SEO-landingspagina's** — per provincie/regio ("Opgietingen in Gelderland"), per sauna, per maand ("Opgietweekenden november 2026")
7. **Nieuwsbrief-opt-in** — wekelijkse mail met komende opgietingen (simpele e-mailcapture, integratie later)

### Fase 2 — Community (pas starten bij aantoonbaar verkeer, architectuur-ready bouwen)
- Reviews/ervaringen per event en per sauna (sterren + tekst)
- Accounts (magic link login, geen wachtwoorden)
- Favorieten / "ik ga" markering
- Foto's uploaden (met moderatie)

### Buiten scope (voorlopig)
- Ticketverkoop op eigen platform
- App (PWA-ready bouwen is voldoende)
- Saunabeheer-dashboard (events worden handmatig/via CMS beheerd)

## 4. Datamodel (kern)

```
Sauna
- id, slug, naam, land (NL/BE), provincie, plaats, adres, lat/lng
- beschrijving, faciliteiten[], website, affiliateUrl, sponsored (bool)
- logo/afbeeldingen[]

Event
- id, slug, saunaId, titel, type (opgietweekend | thema | kampioenschap | regulier)
- startDatum, eindDatum, tijden/programma (rich text of blokken)
- beschrijving, prijsIndicatie, ticketUrl (affiliate), afbeelding
- status (concept | gepubliceerd | afgelopen)

// Fase 2
Review
- id, eventId | saunaId, userId, rating (1-5), tekst, createdAt, gemodereerd (bool)
User
- id, email, naam, favorieten[]
```

## 5. Technische uitgangspunten

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4
- **Data:** ✅ BESLOTEN — repo-based content (MDX voor beschrijvingen, JSON/frontmatter voor gestructureerde velden). Geen database in fase 1. Migratiepad naar Postgres (Vercel/Neon) zodra de community-fase start
- **CMS:** ✅ BESLOTEN — fase 1 repo-based: events als MDX/JSON-bestanden in `/content/events/`, sauna's in `/content/saunas/`. Nieuw event = bestand toevoegen + git push. Migratiepad naar headless CMS zodra derden events moeten kunnen invoeren
- **Hosting:** Vercel, auto-deploy via git push
- **Kaart:** Leaflet + OpenStreetMap (gratis) voor saunalocaties
- **SEO:** SSG/ISR voor alle event- en saunapagina's, structured data (schema.org `Event` en `LocalBusiness`), sitemap, OG-images per event
- **Affiliate tracking:** uitgaande links via redirect-route (`/uit/[slug]`) zodat kliks meetbaar zijn (simpele klik-logging)
- **Analytics:** privacy-vriendelijk (Plausible of Vercel Analytics)
- **Taal:** NL-only bij launch, i18n-ready contentstructuur (BE/FR later mogelijk)

## 6. Pagina's (routes)

```
/                          → home: highlights + komende events + zoekbalk
/agenda                    → volledige agenda (lijst + kalender-toggle, filters)
/agenda/[maand-jaar]       → SEO: events per maand
/opgietingen/[provincie]   → SEO: events per regio
/event/[slug]              → event-detail
/saunas                    → overzicht sauna's (kaart + lijst)
/sauna/[slug]              → sauna-profiel
/uit/[slug]                → affiliate redirect (klik-tracking)
/over, /contact, /voor-saunas (B2B pitch-pagina)
```

## 7. Succescriteria (eerste 3 maanden)

- 50+ events en 20+ sauna's live bij launch
- Organisch verkeer op regio- en maandpagina's (SEO-first)
- Meetbare affiliate-kliks via /uit/ redirects
- 100+ nieuwsbrief-inschrijvingen

## 8. Open beslissingen

1. ~~Contentbeheer fase 1~~ → ✅ BESLOTEN: repo-based (MDX/JSON)
2. Community-fase: go/no-go zodra er aantoonbaar verkeer is (SEO-tractie op regio/maandpagina's)
3. **Affiliate via Awin:** aanmelding onderzoeken — check welke sauna-/wellnessprogramma's op Awin actief zijn (bijv. Thermen Bussloo, Fortuna, SpaSereen, TravelBird/Spadeals-achtige aanbieders). Fallback: handmatige sponsordeals per sauna. `/uit/[slug]` redirect-structuur werkt voor beide
4. Domein-strategie: opgietingen.be erbij kopen en redirecten?

## 9. Designrichting (kort)

- Warm, rustgevend, premium: donkere houttinten, stoom/warmte-accenten, veel witruimte
- Mobile-first (agenda wordt vooral onderweg/op de bank geraadpleegd)
- Snelle filters bovenaan, geen zware hero's
