# Growth-, SEO- & affiliate-audit — Opgietingen.nl

_Opgesteld: 21 juli 2026. Uitsluitend onderzoek/analyse — er is niets in de codebase gewijzigd._

> **Over de tijdsinschattingen:** de genoemde tijden zijn schattingen van de **implementatie-inspanning** (hands-on werk + review voor een competente ontwikkelaar/redacteur), **niet** van denktijd van de agent. Veel hiervan kan een AI-agent aanzienlijk sneller uitvoeren; gebruik de tijden als menselijke effort-/review-richtlijn.

> **Scope & databeperking vooraf.** Er was **geen** toegang tot Google Search Console, Analytics of affiliate-dashboards, en **geen** betrouwbare zoekvolumedata. De concurrenten-/zoekvolume-workflow is op de tokenlimiet gestopt vóór afronding. Alles hieronder is gebaseerd op de **codebase + live site** (feitelijk geverifieerd) plus marktlogica (gelabeld _aannemelijk_/_hypothese_). Er zijn **geen** cijfers verzonnen.

---

## 1. Managementsamenvatting (10 punten)

1. **Huidige situatie:** een technisch sterk gebouwde, maar _zeer jonge_ site (SEO-structuur live ~15 juli 2026, gidsen op 20 juli). Fundament is uitstekend: self-canonicals, niet-crawlbare filter-URL's, Event/LocalBusiness/Article/FAQ/Breadcrumb/ItemList-schema, evergreen pillars, `llms.txt`, GSC geverifieerd. Dit is _geen_ reparatieklus — het is een fundament dat nog gevuld moet worden.
2. **Grootste kans:** de site bezit een echte, onderbelichte niche (dé NL/BE opgiet-agenda) mét Event-structured-data. Met meer contentdiepte + regiodekking kan hij goedkoop de long-tail van event-, regio- en info-zoekopdrachten domineren.
3. **Grootste blokkade (organisch):** de eventpagina's — de kern van de voorraad — zijn zo goed als leeg. Alle 52 gepubliceerde events hebben een body onder de 80 woorden (mediaan 14; veel 2–9 woorden, bv. letterlijk _"Thematische Halloween-opgietdag."_). Dit remt ranking, snippet-kwaliteit én de funnel.
4. **Grootste blokkade (inkomsten):** de sauna-"affiliate"-links zijn slechts `?ref=opgietingen` op de eigen sauna-site — **geen echt commissieprogramma**. Het enige echte affiliatekanaal is bol.com, via 3 gloednieuwe gidsen.
5. **Waar organisch verkeer kan groeien:** (a) event-content verrijken, (b) 21 concept-events publiceren, (c) provinciedekking uitbreiden (nu 11 van ~23 NL+BE-provincies), (d) commerciële/informatieve gidsen erbij.
6. **Waar affiliate-inkomsten worden gemist:** de gidsen (het enige echte kanaal) zijn semi-verweesd — niets linkt eránaar toe vanuit de pillar/agenda/events; de pillar noemt "saunahoed" zonder naar de saunahoed-gids te linken.
7. **Meetbaarheid ontbreekt:** klik-logging is `console.log` + best-effort file-append; op Vercel is die file vluchtig. Er is dus feitelijk geen duurzame doorklik-analytics — terwijl "meetbare doorklikken" juist de B2B-belofte op `/voor-saunas` is.
8. **Realistisch verdienmodel:** omdat sauna-affiliate niet bestaat, draait geld op korte termijn op **(a) bol.com-productcontent** en **(b) gesponsorde/uitgelichte vermeldingen** (nu slechts 1 sauna `sponsored`). Doorklik-tracking is de sleutel die beide ontsluit.
9. **Onderscheidend vermogen:** breedte (NL+BE), actualiteit (wekelijkse scraper) en de agenda-focus zijn de wig t.o.v. losse thermen-sites en algemene wellness-aggregators.
10. **Eerste drie acties:** ① interne links van info-content → gidsen + gidsen de-verwezen (snelste affiliate-winst); ② event-content verrijken (grootste organische hefboom); ③ duurzame outbound-klik-tracking opzetten (ontsluit optimalisatie én B2B-omzet).

---

## 2. Belangrijkste bevindingen

### Wat goed werkt (behouden)
- **Technische SEO is bovengemiddeld.** `/agenda` heeft een statische self-canonical naar `/agenda`; filters muteren query-params via client-side `router.replace` (geen crawlbare `<a>`-varianten) → **geen index-bloat uit filtercombinaties**. Provinciefiltering heeft een eigen canonieke pagina (`/opgietingen/[provincie]`). (`src/app/agenda/page.tsx`, `src/components/AgendaFilters.tsx`)
- **Structured data breed en correct** (`src/lib/schema.ts`): Event (incl. Offer), LocalBusiness+HealthAndBeautyBusiness, Article, FAQPage, BreadcrumbList, ItemList, WebSite+Organization.
- **Slimme SEO-keuzes:** evergreen kampioenschaps-/opgietweekend-pagina's zonder jaartal, verlopen events blijven live met editie-doorverwijzing, sitemap sluit `/uit/` en verleden maanden uit, `llms.txt` aanwezig.
- **Interne links deels goed geregeld:** footer (top-provincies + secties), event-detail linkt naar maand/provincie/gerelateerd, pillar linkt naar type-/tijdpagina's.

### Wat de groei blokkeert (aanpakken)
- **Thin content op de kernvoorraad.** _Feitelijk:_ 52 gepubliceerde events, allemaal <80 woorden body (mediaan 14). 73/79 events komen van de scraper. Bijkomend gevolg: `generateMetadata` van events gebruikt `plainSummary(event.body)` → de **meta descriptions zijn óók dun** (herhalen vaak enkel de titel). (`src/app/event/[slug]/page.tsx`)
- **Affiliate-realiteit.** _Feitelijk:_ alle 20 `affiliateUrl`-waarden = sauna-site + `?ref=opgietingen`. Alleen `/uit/product/[id]` wikkelt echt in `partner.bol.com` met site-ID 1533193. (`src/app/uit/product/[id]/route.ts`)
- **Gidsen verweesd.** _Feitelijk:_ gids-detail linkt alleen naar `/gids` en `/agenda`; niets in de pillar/agenda/events linkt naar een gids. De pillar noemt "saunahoed" als tip zonder link naar `/gids/beste-saunahoed-2026`.
- **Overlap-risico:** `/gids/zo-werkt-een-opgieting-voor-beginners` overlapt inhoudelijk sterk met de pillar `/wat-is-een-opgieting` (beide: wat is het, verloop, etiquette) → kannibalisatie-risico.
- **Dekkingsgaten:** 11/≈23 provincies; ontbrekend o.a. Overijssel, Groningen, Drenthe, Oost-/West-Vlaanderen. 21 concept-events onbenut. Slechts 3 BE-sauna's.
- **Meetbaarheid:** geen duurzame doorklik-data (`src/lib/clicks.ts`).

### Vastgestelde content-census (feitelijk)
- Events: 79 bestanden — **52 gepubliceerd, 21 concept, 6 afgelopen**. Types: thema 34, regulier 20, kampioenschap 16, opgietweekend 9. Bron: 73 scraper, 6 handmatig.
- Sauna's: 20 (17 NL, 3 BE), 1 `sponsored`. Body's 191–274 woorden (goed), behalve `spawell.mdx` (33 woorden, uitschieter).
- Gidsen: 3 (saunahoed = 3 producten; wat-neem-je-mee = 4 producten; beginners = 0 producten/informatief).

---

## 3. Quick wins (< 30 min)

**QW1 — Link "saunahoed" in de pillar naar de saunahoed-gids.**
De pillar-FAQ ("Wat neem je mee…") en de tekst noemen saunahoed; er is nu géén link. _Bron: codebase._ Plan: in `src/app/wat-is-een-opgieting/page.tsx` het woord "saunahoed" (FAQ-antwoord + soorten) linken naar `/gids/beste-saunahoed-2026` en `/gids/wat-neem-je-mee-naar-een-opgieting`. _Meten:_ pageviews `/gids/*` + `/uit/product/*`-kliks.

**QW2 — Verifieer "Gids"/"Saunagids" in de live navigatie.** Tijdens de audit gaf live `/gids` een 404 en ontbrak de nav-link; dit is zojuist gedeployd. _Bron: live-website._ _Meten:_ live-check (200) + interne kliks naar `/gids`.

**QW3 — Templated fallback-meta-description voor events.**
Nu leidt de dunne body tot dunne descriptions. Plan: in `src/app/event/[slug]/page.tsx` een fallback: `"{titel} bij {sauna} in {plaats} op {datum}. Bekijk tijden, programma en praktische info."` gebruiken zodra `plainSummary(body)` te kort is. _Bron: codebase._ _Meten:_ GSC CTR op `/event/*`.

**QW4 — Publiceer de "makkelijke" concept-events.** 21 concepts staan onzichtbaar. _Bron: codebase (census)._ Plan: redactionele check; zet valide toekomstige events op `gepubliceerd`. _Meten:_ aantal geïndexeerde event-URL's, sitemap-omvang.

**QW5 — Cross-link gids ↔ agenda/regio.** In elke gids onderaan 2–3 contextuele links (bv. beginners-gids → `/opgietingen/[provincie]` + `/wat-is-een-opgieting`). _Bron: codebase._ _Meten:_ interne kliks, crawl-diepte gidsen.

---

## 4. Kleine verbeteringen (30–120 min)

**KV1 — "Handig om mee te nemen"-blok op event- en pillar-pagina's** met 2 productkaarten/links naar de gidsen (saunahoed, badjas). Maakt van elke informatieve/agenda-pagina een affiliate-instappunt. _Bron: codebase + aannemelijk._ Bestanden: `src/app/event/[slug]/page.tsx`, `src/app/wat-is-een-opgieting/page.tsx`, evt. nieuw component. _Meten:_ `/uit/product/*`-kliks per bronpagina (subid).

**KV2 — CTA-copy specifieker + tweede doorklikmoment.** "Naar de sauna"/"Bekijk bij X" → bv. "Bekijk opgietschema bij {sauna} →". Op event-detail ook een CTA **boven** de vouw (nu enkel in de zijbalk, die op mobiel wegzakt zodra bodies groeien). _Bron: codebase._ Bestanden: `src/components/AffiliateButton.tsx`, `src/app/event/[slug]/page.tsx`. _Meten:_ outbound-CTR (na actie 3).

**KV3 — Differentieer beginners-gids vs pillar** om kannibalisatie te voorkomen: gids = "eerste keer / voorbereiding + spullen" (met producten), pillar = definitief naslag-anker; expliciet naar elkaar linken met verschillende intentie. _Bron: codebase._ _Meten:_ welke pagina rankt voor "wat is een opgieting" vs "eerste keer opgieting" (GSC).

**KV4 — Duurzame outbound-klik-tracking (basis).** Zie actie 3 — client-side custom event (Vercel Analytics `track()` of Plausible outbound) op `AffiliateButton`/`ProductCard` vóór navigatie. _Bron: codebase._ _Meten:_ dashboards tonen kliks per event/sauna/product.

**KV5 — 2 nieuwe commerciële bol.com-gidsen** (bv. "Beste opgiet-/Aufguss-oliën" en "Saunahanddoek/kilt & badjas"). Elk 3–5 producten + `AffiliateDisclosure`. _Bron: aannemelijk._ Bestanden: `content/gidsen/*.mdx`. _Meten:_ `/uit/product/*` per gids.

---

## 5. Verbeteringen (2–6 uur)

**V1 — Event-content verrijken naar 120–200 woorden unieke tekst (de grootste hefboom).** Semi-geautomatiseerd: breid de scraper-pipeline uit met een generatiestap die uit `titel + type + sauna-context + datum + tijden` een unieke alinea schrijft (feiten alleen uit frontmatter), plus een eenmalige verrijking van de 52 bestaande events. _Bron: codebase._ Bestanden: `src/lib/scraper.ts` + `scripts/lib` (writeEventMdx), `content/events/*.mdx`. _Risico:_ AI-fluff/duplicatie/onjuiste feiten → mitigeer met vaste template + opgiet-trefwoord + geen verzonnen prijzen. _Meten:_ GSC impressies/kliks + gemiddelde positie `/event/*`.

**V2 — Provinciedekking uitbreiden** met sauna-profielen in ontbrekende regio's (Overijssel, Groningen, Drenthe; BE: Oost-/West-Vlaanderen) → activeert nieuwe regiopagina's (primair SEO-kanaal). _Bron: codebase + PRD._ _Afhankelijkheid:_ sauna-data verzamelen. _Meten:_ geïndexeerde `/opgietingen/*`, impressies per regio.

**V3 — Gesponsorde-vermelding productiseren (B2B-omzet).** Formaliseer het `sponsored`-model (nu 1 sauna): pakket + prijs op `/voor-saunas`, gekoppeld aan meetbare doorklikken (V1-tracking maakt de belofte hard). _Bron: codebase._ _Afhankelijkheid:_ sales. _Meten:_ aantal betaalde listings, geleverde kliks per sauna.

**V4 — Seizoens-/thema-landingspagina's** (bv. "Kerst- & oud-en-nieuw-opgietingen", "winter-opgietingen") die programmatisch `type=thema`-events in het seizoen bundelen met redactionele intro. _Bron: aannemelijk/hypothese._ _Meten:_ seizoenspieken in GSC.

---

## 6. Nieuwe pagina- & contentkansen (geprioriteerd)

| # | Voorlopige titel | Intentie | Type | Waarom verkeer | Linkt vanuit | Affiliatekans | Prioriteit |
|---|---|---|---|---|---|---|---|
| 1 | Verrijkte event-pagina's (bestaand, uitbreiden) | transactioneel/lokaal | agenda | Grootste voorraad; nu te dun om te ranken | agenda/regio/maand | sauna-doorklik | **Hoog** |
| 2 | "Beste opgiet-/Aufguss-oliën" (gids) | commercieel | gids | Koopintentie, bol.com-aanbod | pillar, events, gidsen | **bol.com** | **Hoog** |
| 3 | "Welke saunahoed" (bestaat; beter linken) | commercieel | gids | Duidelijke koopintentie | pillar, events | **bol.com** | **Hoog** |
| 4 | Ontbrekende provinciepagina's (via sauna's) | lokaal | regio | Regio = primair SEO-kanaal | footer, home, agenda | sauna-doorklik | Gemiddeld |
| 5 | "NK/BK Aufguss [jaar]" (evergreen bestaat; verdiepen met uitslagen/deelnemers) | informatief/actueel | pillar | PR-/linkwaardig, jaarlijks terugkerend | pillar, opgietweekend | laag | Gemiddeld |
| 6 | "Sauna-cadeaubon / wellness cadeau" (gids) | commercieel | gids | Sterke koop-/cadeau-intentie | home, gidsen | partner (valideren) | Gemiddeld |
| 7 | Seizoensbundels (kerst/winter/zomer-opgietingen) | actueel/seizoen | landing | Seizoenspieken | agenda, home | sauna-doorklik | Gemiddeld |
| 8 | "Sauna met opgietingen in [grote stad]" | lokaal | landing | Lokale intentie onder provincie | regiopagina | sauna-doorklik | Laag |

_Alle intentie-inschattingen: aannemelijk/hypothese — te valideren met GSC + keyword-onderzoek._

---

## 7. Affiliate-optimalisaties (kern)

1. **De-verwees de gidsen** — leg contextuele links vanuit pillar, agenda, event- en sauna-pagina's naar de relevante gids. Hoogste affiliate-ROI met de laagste inspanning: het enige echte inkomstenkanaal is nu vrijwel onvindbaar. (QW1, QW5, KV1)
2. **Meer doorklikmomenten per pagina** — informatieve pagina's hebben nu 0 commerciële vervolgstap; agenda-/event-pagina's 1. Voeg product-tie-ins en een tweede CTA toe. (KV1, KV2)
3. **Maak doorklikken meetbaar** — zonder tracking is optimaliseren gokken; het is ook de harde onderbouwing voor betaalde listings. (actie 3)
4. **Wees eerlijk over "affiliate" bij sauna's** — `?ref=opgietingen` levert niets op. Behandel sauna-doorklikken als **B2B-waarde** (verkeer dat je aan sauna's verkoopt), niet als affiliate-omzet. Focus affiliate-omzet op bol.com-content + verken **reële** partners (bol.com-accessoires; mogelijk Booking/Tripadvisor voor saunaresorts mét overnachting; cadeaubon-programma's) — telkens eerst valideren of het programma bestaat en past.
5. **Breid het bol.com-assortiment uit** met gidsen rond koopintentie (oliën, handdoek/kilt, badjas, cadeaubon, sauna-thuis). (KV5)
6. **Disclosure is correct** (ACM-conform, boven de producten, `rel="sponsored nofollow noopener"`) — behouden bij elke nieuwe gids.

---

## 8. Top 15 aanbevelingen op ROI (hoogste eerst)

| # | Aanbeveling | Categorie | Org. impact | Affil. impact | Moeilijkheid | Tijd | Bron |
|---|---|---|---|---|---|---|---|
| 1 | Interne links info/agenda → gidsen; gidsen de-verwezen | affiliate/interne-links | gemiddeld | **hoog** | zeer laag | 30–60 min | codebase |
| 2 | Event-content verrijken naar 120–200 w (pipeline + backfill) | content/SEO | **zeer hoog** | gemiddeld | gemiddeld | 3–6 u | codebase |
| 3 | Duurzame outbound-klik-tracking (Plausible/Vercel events) | tracking/funnel | laag | **hoog** | laag | 1–2 u | codebase |
| 4 | Templated fallback-meta-descriptions events | technische-SEO | gemiddeld | laag | zeer laag | 20–30 min | codebase |
| 5 | 21 concept-events reviewen & publiceren | content/coverage | gemiddeld | laag | laag | 1–2 u | codebase |
| 6 | 2–4 nieuwe commerciële bol.com-gidsen | affiliate/content | gemiddeld | **hoog** | gemiddeld | 2–4 u/gids | aannemelijk |
| 7 | Tweede CTA + specifiekere copy (event/sauna) | funnel | laag | gemiddeld | laag | 30–60 min | codebase |
| 8 | Provinciedekking uitbreiden (ontbrekende regio's) | SEO/coverage | **hoog** | gemiddeld | gemiddeld | 4–6 u | codebase+data |
| 9 | Gesponsorde-vermelding productiseren (B2B) | verdienmodel | laag | **hoog**\* | gemiddeld | 2–4 u | codebase |
| 10 | Beginners-gids vs pillar differentiëren | content/SEO | gemiddeld | laag | laag | 45–90 min | codebase |
| 11 | Seizoens-/thema-landingspagina's | SEO/seizoen | gemiddeld | laag | gemiddeld | 2–4 u | hypothese |
| 12 | NK/BK Aufguss-pagina verdiepen (PR/links) | SEO/autoriteit | gemiddeld | zeer laag | laag | 1–2 u | codebase |
| 13 | Cadeaubon-/wellnesscadeau-gids (partner valideren) | affiliate | gemiddeld | gemiddeld | gemiddeld | 2–3 u | hypothese |
| 14 | Per-stad landingspagina's (grote steden) | SEO/lokaal | gemiddeld | laag | gemiddeld | 3–5 u | hypothese |
| 15 | Concurrent-/keyword-onderzoek afronden (validatie) | onderzoek | n.v.t. | n.v.t. | laag | 2–3 u | — (gestopt) |

\* Impact op **omzet** hoog, maar dit is B2B/sponsoring, niet affiliate in strikte zin.

---

## 9. De eerste drie acties (volledig uitgewerkt)

### Actie 1 — Interne links van info/agenda-content naar de gidsen (en gidsen de-verwezen)
- **Waarom eerst:** hoogste affiliate-ROI tegen de laagste inspanning. De gidsen zijn het _enige echte_ inkomstenkanaal en zijn nu vrijwel onbereikbaar (alleen nav/footer). Puur contentwerk, nul risico.
- **Aan te passen:** `src/app/wat-is-een-opgieting/page.tsx` (link "saunahoed" → saunahoed-gids), `src/app/event/[slug]/page.tsx` (blok "Handig om mee te nemen" → gidsen), de 3 `content/gidsen/*.mdx` (contextuele links terug naar agenda/regio/pillar).
- **Werk:** 3–5 contextuele tekstlinks + één klein aanraders-blokje; hergebruik `ProductCard`/link-styling.
- **Succes meten:** stijging pageviews `/gids/*` en kliks `/uit/product/*` (per `subid=gids-<slug>`).
- **Eerst controleren:** dat `/gids` en `/gids/[slug]` live 200 geven (waren 404 tijdens audit; net gedeployd) en dat `subid` correct meeloopt.

### Actie 2 — Event-content verrijken naar 120–200 woorden
- **Waarom:** de grootste organische hefboom. 52 dunne event-pagina's zijn de bulk van de indexeerbare voorraad; te dun om te ranken, zwakke snippets, zwakke funnel. Verbetert meteen ook de event-meta-descriptions.
- **Aan te passen:** `src/lib/scraper.ts` + `scripts/lib` (generatiestap in `writeEventMdx`), eenmalige backfill van `content/events/*.mdx`.
- **Werk:** LLM-template die uit frontmatter (titel/type/sauna/plaats/datum/tijden) een unieke alinea maakt; feiten uitsluitend uit frontmatter; opgiet-trefwoord verplicht; em-streepje-normalisatie hergebruiken.
- **Succes meten:** GSC-impressies/kliks + gemiddelde positie voor `/event/*`; indexatiegraad.
- **Eerst controleren:** steekproef op feitelijke juistheid (geen verzonnen prijzen/tijden) en op duplicatie tussen events van dezelfde sauna.

### Actie 3 — Duurzame outbound-klik-tracking
- **Waarom:** zonder meetbare doorklikken is elke optimalisatie (actie 1, CTA's, gidsen) blind — én het is de harde onderbouwing voor betaalde sponsor-listings. `@vercel/analytics` staat al in `src/app/layout.tsx`.
- **Aan te passen:** `src/components/AffiliateButton.tsx` + `src/components/ProductCard.tsx` (client-side `track('outbound', {slug,kind})` vóór navigatie), of Plausible met outbound-tracking. `/uit/*` blijft voor de redirect/rel-attributen.
- **Werk:** kleine client-wrapper of `onClick`-handler; event-namen per kind (event/sauna/product).
- **Succes meten:** dashboards tonen kliks per event/sauna/product en per bronpagina → CTR-optimalisatie mogelijk.
- **Eerst controleren:** dat de server-side redirect (`route.ts`) niet dubbel telt en dat tracking de redirect nooit blokkeert (fail-open, net als de huidige logging).

---

## 10. Validatievragen & ontbrekende data

Deze data kan de prioritering nog verschuiven:
1. **GSC:** welke queries/pagina's krijgen nu al impressies? Ranken de dunne event-pagina's überhaupt? (bepaalt urgentie actie 2)
2. **GSC-indexatie:** hoeveel van de ~99 URL's zijn geïndexeerd; worden dunne events uitgesloten ("Crawled – currently not indexed")?
3. **Analytics:** waar landen bezoekers, waar haken ze af, wat is de huidige outbound-CTR? (nu niet meetbaar — actie 3 lost dit op)
4. **Affiliate/bol.com-dashboard:** genereren de 3 gidsen al kliks/omzet? Welke producten converteren?
5. **Concurrenten & zoekvolumes:** de deep-research is gestopt — rond aanbeveling #15 af om paginavoorstellen 2, 6, 11, 13, 14 te valideren (zoekvolume + moeilijkheid) vóór je erin investeert.
6. **Reële affiliate-partners:** bestaat er een passend programma voor saunaresorts mét overnachting (Booking/Tripadvisor) of voor cadeaubonnen? Valideren vóór je er content omheen bouwt.
7. **B2B-bereidheid:** willen sauna's betalen voor uitgelichte plaatsing? (bepaalt ROI actie 9)

---

**Samengevat:** het fundament is goed; de winst zit in **vullen en verbinden**, niet in verbouwen. Begin met de drie acties hierboven — samen ruwweg een halve tot één werkdag menselijke effort — ze raken zowel de grootste organische blokkade (lege events) als het enige echte inkomstenkanaal (gidsen) en de meetbaarheid die al het overige stuurbaar maakt.
