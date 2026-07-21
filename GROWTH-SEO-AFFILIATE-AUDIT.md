# Growth-, SEO- & affiliate-audit — Opgietingen.nl

_Opgesteld 21 juli 2026._
_Versie 2: aangevuld met een parallel, geverifieerd onderzoek (6 onderzoekstromen + verificatiepass + completeness-critic; 61 findings, alle web-/marktclaims onafhankelijk getoetst)._
_Versie 3 (21 juli 2026): implementatiestatus toegevoegd — de top-prioriteiten zijn inmiddels uitgevoerd, zie het statusblok hieronder en de statuskolom in de top-15-tabel._

## ✅ Implementatiestatus (bijgewerkt 21 juli 2026)

**Afgerond en gecommit:**

| Commit | Inhoud |
|---|---|
| `37d231f` | Eerste drie acties + quick wins: gids-links op pillar/event/sauna/provincie, `track()` op AffiliateButton + ProductCard, Veluwse Bron-profiel (2 onzichtbare events hersteld), 4 duplicaat-events → concept/dedup-anker, LCP-fix hero, 3 meta descriptions <160, /agenda breadcrumb + alt-teksten, fallback-meta-description events |
| `dc5bd80` | Nieuwe gids **Beste saunageuren & opgietmiddel 2026** (4 geverifieerde bol.com-producten) + inbound links vanuit pillar en wat-neem-je-mee |
| `ed35238` | **Alle 48 gepubliceerde event-bodies verrijkt** van 2–75 woorden (mediaan 14) naar 103–147 woorden (mediaan 128); scraper vraagt bij nieuwe scrapes voortaan 60–120 woorden beschrijving; feitfout "grootste van Brabant" gecorrigeerd |

**Concept-review uitgevoerd:** geen van de 21 concepts publiceerbaar (14 verlopen, 6 bewust afgekeurd, 2 nieuwsbrief-testartefacten) — kwaliteitspoort werkt zoals bedoeld.

**Nog open (hoogste prioriteit eerst):** Booking.com-affiliate voor de ~10 sauna's met overnachting (vereist aanmelding programma), kampioenschap-hubs + WK-2026-content (tijdgevoelig: WM-playoffs eind aug), restant technische-hygiëne-batch (Event-schema op lijstpagina's, sitemap lastMod, noindex afgelopen events, OG-image-fix), extra gidsen (handdoek/badjas/opgietset), kerst-/winterlanding (vóór nov), sponsored-propositie, info-cluster + llms.txt-verrijking, retentie & off-page (nieuwsbrief, ICS, digital PR).

> **Over de tijdsinschattingen:** dit zijn schattingen van de **implementatie-inspanning** (hands-on werk + review voor een competente ontwikkelaar/redacteur), **niet** van denktijd van de agent. Een AI-agent kan veel hiervan sneller doen; gebruik ze als menselijke effort-/review-richtlijn.

> **Databeperking.** Geen toegang tot Google Search Console, Analytics of affiliate-dashboards; geen betrouwbare zoekvolumedata. Alle impact-labels zijn **relatieve prioriteiten, geen voorspellingen**. Alles is gebaseerd op codebase + live site (feitelijk geverifieerd) en marktonderzoek (web, geverifieerd), met claims gelabeld _feitelijk_/_aannemelijk_/_hypothese_. Er zijn **geen** zoekvolumes, rankings, CTR's of inkomsten verzonnen. WebSearch is US-gelokaliseerd; de echte NL/BE-SERP kan afwijken — valideer met GSC.

---

## 1. Managementsamenvatting (10 punten)

1. **Situatie:** technisch sterk gebouwde, _zeer jonge_ site (SEO-structuur live ~15 juli 2026, gidsen 20 juli). Fundament uitstekend: self-canonicals, niet-crawlbare filter-URL's (geverifieerd: geen index-bloat), breed schema, evergreen pillars, `llms.txt`, GSC geverifieerd. Dit is een fundament dat gevuld en verbonden moet worden — geen reparatieklus.
2. **Grootste kans (bevestigd door concurrentieonderzoek):** **geen enkele concurrent biedt een filterbare cross-sauna opgiet-agenda voor NL+BE.** sauna.nl/BeWellness heeft geen kalender, VNSWB/aufgussnk.nl dekken alleen wedstrijden, saunameestervereniging.nl toont geen live agenda, deals-aggregators (sauna-aanbiedingen.nl, vandaagweg.nl) verzamelen alleen kortingen. Dat is een structurele voorsprong.
3. **Grootste blokkade (organisch):** de eventpagina's — de grootste indexeerbare URL-set (52 gepubliceerd) — zijn zo goed als leeg: 73 van 79 zijn scraper-stubs van 2–32 woorden, geen enkel event haalt 120 woorden.
4. **Grootste blokkade (inkomsten):** sauna-"affiliate"-links zijn `?ref=opgietingen` op de eigen sauna-site — **0 commissie**. Het enige echte affiliatekanaal is bol.com (3 gloednieuwe gidsen), en dat cluster is intern **verweesd** (nul contextuele links vanuit pillar/event/sauna/agenda) én **te klein**.
5. **Onbenutte échte commissieroute:** 10 van 20 sauna's bieden overnachting (Thermae 2000, Zwaluwhoeve, Elysium, Berendonck, La Mer, Vitae Goes/Roosendaal, …) → **Booking.com-affiliate** (of via Awin/Daisycon/TradeTracker) is een reëel programma met commissie, nu volledig onbenut.
6. **Concrete bug gevonden:** bron `veluwse-bron` is actief in `bronnen.json`, maar er is geen sauna-profiel; de loader dropt daardoor stilzwijgend 2 gepubliceerde events (opgietweekend 12–13 sep + Aufguss-finale) uit agenda, `/opgietweekenden`, `/aufguss-kampioenschappen` én sitemap.
7. **Datakwaliteit:** scraper-duplicaten — dezelfde BeWellness-finale (2026-10-02) staat 3× live onder verschillende sauna's; de kampioenschappen-pagina laat de site tegen zichzelf concurreren op precies de PR-waardige events.
8. **Meetbaarheid ontbreekt (randvoorwaarde):** klik-logging is `console.log` + best-effort file-append (op Vercel vluchtig); `@vercel/analytics` is geladen maar `track()` wordt nergens aangeroepen. **Zonder een echte track()-call op de `/uit`-redirects is geen enkele affiliate-optimalisatie meetbaar of A/B-baar.**
9. **De echte lange-termijn-bottleneck (door de critic toegevoegd):** voor een greenfield-domein zonder ranking-historie is **autoriteit/backlinks** de rem — geen enkele on-page-verbetering rankt zonder inkomende links. Er is nu geen off-page/PR-plan, geen nieuwsbrief, geen ICS/"toevoegen aan agenda", geen E-E-A-T-auteurssignaal op de money-pages.
10. **Eerste drie acties:** ① contextuele interne links van info/agenda → de 3 gidsen (snelste affiliate-winst, consensus over 3 streams); ② `track()` op de `/uit`-redirects (meetbaarheid vooraf); ③ de correctheidsbugs fixen (`veluwse-bron`-profiel + de 2026-10-02-triple ontdubbelen). Direct daarna: gids "Beste saunageuren" + event-content verrijken.

---

## 2. Belangrijkste bevindingen

### Wat goed werkt (behouden)
- **Technische SEO bovengemiddeld** en **live geverifieerd:** `/agenda` self-canonical naar `/agenda`; filters via client-side `router.replace` → geen crawlbare filtervarianten, geen index-bloat. (`src/app/agenda/page.tsx`, `src/components/AgendaFilters.tsx`)
- **Affiliate-disclosure is correct geplaatst** — in tegenstelling tot een aanvankelijke onderzoeksclaim rendert `<AffiliateDisclosure />` in `src/app/gids/[slug]/page.tsx` **vóór** de MDX-body (boven de eerste inline `<Product>`), dus zichtbaar vóór de eerste affiliate-link. ACM-conform. `rel="sponsored nofollow noopener"` correct op `ProductCard` en `AffiliateButton`. _(Deze correctie kwam uit eigen codebase-verificatie; niet aanpassen.)_
- **Breed schema** (`src/lib/schema.ts`): Event (detail), LocalBusiness, Article, FAQPage, BreadcrumbList, ItemList, WebSite+Organization. Slimme keuzes: evergreen kampioenschaps-/opgietweekend-pillars zonder jaartal, editie-doorverwijzing, sitemap sluit `/uit/` en verleden maanden uit.

### Wat de groei blokkeert
- **Thin content op de kernvoorraad** _(feitelijk, wc-geverifieerd):_ 73/79 events = 2–32 woorden; 6 handmatige events 56–67 woorden; geen enkel event ≥120 woorden. Gevolg: ook de event-meta-descriptions (`plainSummary(event.body)`) zijn dun. (`src/app/event/[slug]/page.tsx`)
- **Gidsen-cluster verweesd én te klein** _(sterkste consensus, 5+4 findings):_ nul contextuele interne links vanuit pillar/event/sauna/agenda; slechts 3 gidsen; de meest opgiet-specifieke bol.com-categorie (saunageuren/opgietconcentraat) ontbreekt. De pillar noemt letterlijk "saunahoed" en "handdoek" zonder naar de gidsen te linken.
- **Affiliate-realiteit** _(feitelijk):_ 20× `affiliateUrl` = sauna-site + `?ref=opgietingen`; slechts 6 van 78 ticketUrls dragen een `?ref`. Vanity-parameter, 0 commissie. Echte routes onbenut: **bol.com** (gidsen), **Booking.com** (overnachting), **gesponsorde vermeldingen** (1 van 20 sauna's `sponsored`; `/voor-saunas` zonder concrete propositie/tarief).
- **Meetbaarheid** _(feitelijk):_ `track()` nergens aangeroepen (`src/lib/clicks.ts`, `AffiliateButton`, `ProductCard`).
- **Datakwaliteit:** scraper-duplicaten (2026-10-02 triple; 2026-07-18 dubbele voorronde; mogelijk 09-05/09-12/11-28) en de `veluwse-bron`-bug.
- **Lijstpagina-schema mist Event-objecten** _(live geverifieerd op `/opgietingen/gelderland`):_ `eventItemListSchema()` levert alleen `{position, url, name}` — de volledige `Event`-markup staat uitsluitend op detail. Regio-/maandpagina's (de primaire SEO-pagina's) komen zo niet in aanmerking voor event-rich-results.
- **Home-hero LCP** _(live geverifieerd):_ hero-`<img>` heeft `loading="lazy"` én `fetchPriority="high"` — het grootste element boven de vouw wordt uitgesteld (`HeroHeader.tsx`).
- **Index-hygiëne:** afgelopen events blijven indexeerbaar (self-canonical, geen noindex) en houden `eventStatus:EventScheduled`/`InStock`; verleden-maandpagina's zijn statisch gegenereerd en bereikbaar — een crawl-set die wekelijks groeit.
- **Dekkingsgaten:** 11/≈23 provincies; grote regio's ontbreken (Overijssel, Groningen, Drenthe; BE: Oost-/West-Vlaanderen). Slechts 3 BE-sauna's. 21 concept-events onbenut.

### Feitelijke correcties uit de verificatiepass (gebruik bij contentproductie)
- WK Aufguss 2026 = **14–20 september 2026** (officieel, aufguss-wm.com), niet 13–20. WM-playoffs **26–29 aug 2026** bij Thermen Bussloo (bevestigd).
- NK 2026-uitslag (bevestigd, maar **herverifieer vóór publicatie**): single **Jo-Annie Hulleman** (Thermen Bussloo); team **Sigrid van Rijswijk & Job Verheijen** (Thermen Berendonck).
- Thermen La Mer opgiettijden **11:30–21:30** (niet 12:00–22:00). "Sauna Drôme 6 opgietingen/dag" = **niet te staven** → weglaten. Rhodos-prijzen niet te verifiëren → softenen.
- `aufgussnk.nl` is een **301-redirect** naar vnswb.nl (geen zelfstandige site). "Concurrenten missen Event-schema" = **hypothese** (niet geverifieerd).

### Twee "red herrings" expliciet ontkracht
- **Google Business Profile is niet van toepassing** — opgietingen.nl is een online-only uitgever zonder fysieke vestiging. Entiteitwinst zit in **Organization `sameAs` + echte social-accounts** (bestaat `@opgietingen`?) / evt. Wikidata.
- **hreflang NL/BE is nu een non-issue** — NL en Vlaanderen delen het Nederlands, site is NL-only (`<html lang="nl">`). Pas relevant bij aparte taalvarianten.

---

## 3. Quick wins (< 30 min)

- **QW1 — Interne links "saunahoed"/"handdoek" in de pillar → gidsen.** `src/app/wat-is-een-opgieting/page.tsx`. _Affiliate: hoog. Meten: `/uit/product/*` per subid._
- **QW2 — `veluwse-bron.mdx` sauna-profiel aanmaken** (fixt 2 onzichtbare events). `content/saunas/veluwse-bron.mdx`. _Feitelijke bug._
- **QW3 — Hero-LCP fix:** `loading="eager"` / `priority:true` in `HeroHeader.tsx`. _Core Web Vitals op de hoogst-verkeerspagina. Verifieer met Lighthouse._
- **QW4 — Drie te lange meta descriptions inkorten** (wat-is 234, kampioenschappen 170, home 164 tekens → <160).
- **QW5 — `/agenda` breadcrumb + lege alt-teksten** op event-thumbnails repareren (inconsistent met andere lijstpagina's).
- **QW6 — Templated fallback-meta-description voor events** zolang `plainSummary(body)` te kort is. `src/app/event/[slug]/page.tsx`.
- **QW7 — Publiceer valide concept-events** (21 concepts; redactionele check).

## 4. Kleine verbeteringen (30–120 min)

- **KV1 — `track()` op de `/uit`- en `/uit/product`-redirects** (Vercel Analytics of Plausible). **Randvoorwaarde** voor het meten van alle affiliate-werk. `AffiliateButton.tsx`, `ProductCard.tsx`, `src/lib/clicks.ts`.
- **KV2 — De 3 gidsen de-verwezen vanuit event-, sauna-, agenda- en provinciepagina's** (één thema, 5 findings): "Handig om mee te nemen"-blok + contextuele links.
- **KV3 — Scraper-duplicaten opschonen** (2026-10-02-triple → 1 event; dubbele voorronde 2026-07-18; check 09-05/09-12/11-28).
- **KV4 — Sauna-detail linkt naar de eigen provinciepagina** (ontbrekende hub-and-spoke schakel).
- **KV5 — CTA-copy specifieker + tweede prikkel** ("Bekijk het opgietschema bij {sauna} →" + gids-cross-sell). Mobiele sticky CTA overwegen (nu staat de CTA ná de body).
- **KV6 — `llms.txt` verrijken** met de gidsen + Q&A-blok (wijst nu niet naar de commissie-content).

## 5. Verbeteringen (2–6 uur)

- **V1 — Nieuwe gids "Beste saunageuren & opgietmiddel 2026"** (bol.com `/l/saunageuren`; benc.nl "110+ geuren"; Rhodos "welke geur"). Meest opgiet-specifieke bol.com-product; datamodel is klaar. _Affiliate + organisch hoog, effort laag._
- **V2 — Event-content verrijken** naar 120–200 woorden: data-afgeleid tekstblok op detail + scraper-prompt ≥40 woorden + top-10 events handmatig. Varieer per type/sauna om nieuwe duplicatie te vermijden.
- **V3 — Volledige `Event`-objecten in de lijstpagina-ItemList** (`src/lib/schema.ts`) op regio-/maandpagina's — alleen komende events, valideren met Rich Results Test.
- **V4 — Booking.com-affiliate voor de ~10 sauna's met overnachting:** optioneel `bookingUrl`-frontmatterveld + "Overnachten bij {sauna}"-CTA via een `/uit`-achtige redirect met label/klik-logging.
- **V5 — Kampioenschap-hubcluster:** named subpagina's (Aufguss NK, Modern Classic Cup, Herbal Cup, BK, WK) die bestaande events/locaties/winnaars bundelen + NK/BK/WK-uitslag-recaps. **Tijdgevoelig:** WK-hub + WM-playoffs (Bussloo, eind aug) vóór eind augustus live.
- **V6 — Index-hygiëne afgelopen events:** noindex na grace-periode (>90 dgn) of link-beperking; `eventSchema()` geen `InStock`/`EventScheduled` op afgelopen events.
- **V7 — Sponsored-propositie op `/voor-saunas`** (pakket + indicatieprijs + sponsored-first sortering).
- **V8 — Provincie-/BE-breedte** uitbreiden (nieuwe sauna-profielen + bronnen) en **stadstermen verwerken in bestaande sauna-/provinciepagina's** (géén losse stadspagina's — zie §6).

---

## 6. Nieuwe pagina- & contentkansen (geprioriteerd, geverifieerd)

| # | Voorlopige titel | Intentie | Type | Affiliatekans | Prioriteit |
|---|---|---|---|---|---|
| 1 | **Beste saunageuren & opgietmiddel 2026** | commercieel | gids | **bol.com (hoog)** | **Hoog** |
| 2 | Verrijkte event-pagina's (bestaand) | transactioneel/lokaal | agenda | sauna-doorklik | **Hoog** |
| 3 | Kampioenschap-hubs per wedstrijd (NK/Modern Classic Cup/Herbal Cup/BK/WK) + NK/BK/WK-recaps | informatief/actueel | pillar/hub | laag (PR/links) | **Hoog** |
| 4 | Beste sauna's vóór opgietingen in NL (editorial ranglijst) | commercieel/navigational | editorial | indirect (sauna-CTA) | Gemiddeld |
| 5 | Kerst- & winteropgietingen (evergreen, jaarlijks) | seizoen/transactioneel | landing | sauna-doorklik + cadeaubon | Gemiddeld (vóór nov) |
| 6 | WK Aufguss 2026 Berlijn — NL/BE-deelnemers (tijdgevoelig) | actueel | nieuws/hub | laag | Gemiddeld (vóór eind aug) |
| 7 | Beste saunahanddoek & hamamdoek | commercieel | gids | **bol.com** | Gemiddeld |
| 8 | Sauna-/opgieting cadeau geven (cadeaubon) | commercieel/seizoen | gids | Bongo/Smartbox e.d. — **valideren** | Gemiddeld |
| 9 | Info-cluster: aufguss vs opgieting vs löyly · opgietgeuren · etiquette · "zijn opgietingen gezond?" | informatief | pillar-spokes | laag (GEO/links) | Gemiddeld |
| 10 | Vaste opgiettijden/-rooster op sauna-profielen (unieke long-tail; geen aggregator heeft dit) | lokaal/informatief | sauna-veld | sauna-doorklik | Gemiddeld |

_Alle intenties: aannemelijk/hypothese — valideren met GSC + keyword-onderzoek._

---

## 7. Affiliate-optimalisaties (kern)

1. **De-verwees het gidsencluster** (hoogste ROI, laagste effort; consensus). Links vanuit pillar, event, sauna, agenda/maand/provincie → relevante gids.
2. **Meet doorklikken (`track()`) — randvoorwaarde.** Zonder dit stuur je blind op alle onderstaande punten.
3. **Vergroot het echte affiliatekanaal (bol.com):** gids saunageuren/opgietconcentraat (eerst), daarna handdoek/hamamdoek, badjas, opgietset. Model + `/uit/product/[id]` + subid staan klaar.
4. **Activeer een échte commissieroute: Booking.com** voor de ~10 sauna's met overnachting (of via Awin/Daisycon/TradeTracker).
5. **Behandel sauna-doorklikken als B2B-waarde, niet als affiliate** — `?ref=opgietingen` levert niets op. Productiseer **gesponsorde vermeldingen** (`/voor-saunas` + sponsored-first).
6. **Verken cadeaubon/gifting** (Bongo/Smartbox via netwerk) — eerst valideren of er een werkbaar programma is; zo niet, alleen informatief naar de agenda linken (geen "partner"-claim).
7. **E-E-A-T op de money-pages:** auteur-/redactie-byline op de gidsen; Organization `sameAs` + echte socials.

---

## 8. Top 15 aanbevelingen op ROI (hoogste eerst)

| # | Aanbeveling | Org. | Affil. | Moeite | Tijd | Bron | Status |
|---|---|---|---|---|---|---|---|
| 1 | Contextuele interne links → de gidsen (pillar/event/sauna/agenda/provincie) | gemiddeld | **hoog** | zeer laag | 1 u | codebase + consensus | ✅ `37d231f` |
| 2 | `track()` op `/uit` + `/uit/product` (randvoorwaarde meetbaarheid) | zeer laag | **hoog** | laag | 1–2 u | codebase | ✅ `37d231f` |
| 3 | `veluwse-bron.mdx` aanmaken (fix bug: 2 onzichtbare events) | gemiddeld | laag | zeer laag | 20–30 min | codebase | ✅ `37d231f` |
| 4 | Nieuwe gids "Beste saunageuren & opgietmiddel" | hoog | **hoog** | laag | ½ dag | zoekresultaten | ✅ `dc5bd80` |
| 5 | Hero-LCP fix (`loading:eager`) | gemiddeld | laag | zeer laag | 15–30 min | live | ✅ `37d231f` |
| 6 | Scraper-duplicaten ontdubbelen + generieke titels verrijken | gemiddeld | laag | gemiddeld | 1–2 u | live + codebase | ✅ `37d231f`/`ed35238` |
| 7 | Technische-hygiëne-batch: Event-objecten in lijst-ItemList · sitemap lastMod · meta's inkorten · alt/breadcrumb `/agenda` · noindex+eventStatus afgelopen · OG-image fix | gemiddeld | laag | gemiddeld | ½–1 dag | codebase + live | ◐ meta's/alt/breadcrumb ✅; schema/lastMod/noindex/OG ⬜ |
| 8 | Event-bodies verrijken (48 gepubliceerd; grootste indexeerbare set) | **hoog** | gemiddeld | gemiddeld | 3–5 u | codebase | ✅ `ed35238` |
| 9 | Booking.com-affiliate voor ~10 sauna's met overnachting | zeer laag | **hoog** | gemiddeld | 3–5 u | codebase + hypothese | ⬜ wacht op aanmelding |
| 10 | Kampioenschap-hubs (NK/MCC/Herbal/BK/WK) + NK/BK/WK-recaps | hoog | laag | laag–gem. | 1–2 dagen | concurrentie | ⬜ |
| 11 | Gidsencluster uitbreiden (handdoek/hamamdoek, badjas, opgietset) + saunahoed-gids differentiëren | gemiddeld | **hoog** | laag | ½ dag/gids | concurrentie | ◐ saunageuren ✅; rest ⬜ |
| 12 | Kerst-/winteropgietingen-landing (evergreen) + WK-2026-hub (tijdgevoelig) | hoog | gemiddeld | gemiddeld | 1 dag | zoekresultaten | ⬜ vóór eind aug (WK) / nov (kerst) |
| 13 | Sponsored-propositie op `/voor-saunas` + sponsored-first sortering | zeer laag | gemiddeld | gemiddeld | 2–3 u | codebase | ⬜ |
| 14 | Info-cluster (aufguss/opgieting/löyly · geuren · etiquette · gezond) + `llms.txt` verrijken | gemiddeld | laag | laag | ½ dag/artikel | concurrentie | ⬜ |
| 15 | Retentie & off-page: nieuwsbrief/agenda-digest + ICS "toevoegen aan agenda"; digital-PR-plan (neutrale NK/BK/WK-databron; 20 thermen om agenda-link vragen) | hoog (LT) | gemiddeld | gemiddeld–hoog | doorlopend | critic | ⬜ |

---

## 9. De eerste drie acties (volledig uitgewerkt)

### Actie 1 — Contextuele interne links naar de 3 gidsen
- **Waarom eerst:** hoogste affiliate-ROI, laagste effort, consensus over 3 streams. Raakt de enige echte omzetbron (bol.com), die nu intern verweesd is. Puur content/template-werk, nul risico.
- **Bestanden:** `src/app/wat-is-een-opgieting/page.tsx` (noemt letterlijk "saunahoed"/"handdoek"), `src/app/event/[slug]/page.tsx`, `src/app/sauna/[slug]/page.tsx`, `src/app/opgietingen/[provincie]/page.tsx`.
- **Werk:** 3–5 contextuele tekstlinks + één klein "Handig om mee te nemen"-blok (hergebruik `ProductCard`).
- **Meten:** pageviews `/gids/*` + kliks `/uit/product/*` per `subid=gids-<slug>`.
- **Eerst controleren:** `/gids` + `/gids/[slug]` geven live 200 (net gedeployd); subid loopt mee.

### Actie 2 — `track()` op de affiliate-redirects (meetbaarheid vooraf)
- **Waarom:** randvoorwaarde. Zonder een echte outbound-event is geen enkele affiliate-verbetering (actie 1, gidsen, CTA's, Booking) meetbaar of A/B-baar; `@vercel/analytics` is al geladen.
- **Bestanden:** `src/components/AffiliateButton.tsx`, `src/components/ProductCard.tsx` (client-side `track('outbound', {slug,kind})` vóór navigatie); `src/lib/clicks.ts` behouden.
- **Meten:** dashboard toont kliks per event/sauna/product en per bronpagina.
- **Eerst controleren:** geen dubbeltelling met de server-redirect; tracking blokkeert de redirect nooit (fail-open).

### Actie 3 — Correctheidsbugs fixen (`veluwse-bron` + duplicaten)
- **Waarom:** feitelijke bugs, geen afweging. `veluwse-bron` mist een sauna-profiel → 2 gepubliceerde events onzichtbaar; de 2026-10-02 BeWellness-finale staat 3× live (duplicate content op de PR-waardige kampioenschappen).
- **Bestanden:** nieuw `content/saunas/veluwse-bron.mdx`; consolideer `content/events/*aufguss-challenge*-2026-10-02.mdx` tot 1 event; overweeg dedup op genormaliseerde titel+datum in `scripts/lib/quality-gate.ts`.
- **Meten:** `npm run build` → beide events joinen; geen dubbele kaarten op `/aufguss-kampioenschappen`; GSC "Duplicaat zonder canonical" daalt; sitemap-telling.
- **Eerst controleren:** juiste host-sauna van de finale; adres/geo-consistentie van het nieuwe profiel (er staan adres-discrepanties open).

_Direct hierna (actie 4–5): gids "Beste saunageuren" + start event-content-verrijking._

---

## 10. Validatievragen & ontbrekende data

1. **GSC:** welke queries/pagina's krijgen al impressies? Ranken de dunne events? (bepaalt urgentie actie 8)
2. **GSC-indexatie:** hoeveel van de ~99 URL's zijn geïndexeerd; worden dunne events uitgesloten ("Crawled – currently not indexed")? Groeien afgelopen-event-/maand-URL's?
3. **Analytics:** landingsgedrag, afhaakpunten, huidige outbound-CTR (nu niet meetbaar — actie 2 lost dit op).
4. **bol.com-dashboard:** genereren de 3 gidsen al kliks/omzet; welke producten converteren?
5. **Affiliate-programma's valideren:** Booking.com (of Awin/Daisycon/TradeTracker) — geschikt voor deze venues? Cadeaubon (Bongo/Smartbox)? Bestaat er een werkbare route?
6. **Adres-/coördinaat-discrepanties** in sauna-frontmatter oplossen (raken Event-/LocalBusiness-schema en stadstargeting).
7. **Merkentiteit:** bestaat `@opgietingen` (Instagram/socials) voor Organization `sameAs`?
8. **B2B-bereidheid:** willen thermen betalen voor uitgelichte plaatsing / linken zij vanaf hun agenda naar hun opgietingen.nl-vermelding? (bepaalt ROI actie 13 + de digital-PR-haak)

---

## Bijlage — Off-page & retentie (door de completeness-critic toegevoegd; geen enkele on-page stream ving dit)

- **Backlinks/digital PR is de echte greenfield-bottleneck.** Haakjes: positioneer opgietingen.nl als **neutrale databron** voor NK/BK/WK-uitslagen (pers/thermen-blogs linken naar de bron i.p.v. hun eigen winnaar); laat je opnemen op vnswb.nl / opgietersvereniging.be / aufguss-wm.com; vraag de 20 thermen om vanaf hun eigen agenda-pagina naar hun vermelding te linken (zij aggregeren zelf niet).
- **ICS / "Toevoegen aan agenda" / webcal-feed** (bestaat nog niet) — natuurlijke retentie: een Google/Apple-Calendar-reminder brengt de bezoeker op de eventdatum terug; per-sauna/per-provincie abonneerbare feed maakt de agenda "sticky" en linkbaar voor thermen.
- **Bezoekers-nieuwsbrief / event-alert opt-in** (nu uitgesteld) — de enige owned manier om bezoekers los van Google terug te halen; koppel aan de bestaande wekelijkse scraper-freshness ("opgietingen bij jou in de buurt").
- **Freshness syndiceerbaar maken:** RSS/JSON-feed van nieuwe events + `/nieuw`-pagina + sitemap `lastMod` — versheidssignaal én linkbaar/abonneerbaar kanaal.
- **Sauna-onboarding als omzetmotor (vooral outreach, geen code):** benader de 20 sauna's (+ thermen achter NK/BK/WK) om hun profiel te claimen, een echt trackbare boekings-/affiliate-link te leveren en een gesponsorde vermelding te kopen.
