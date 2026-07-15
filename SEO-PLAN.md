# SEO-implementatieplan Opgietingen.nl

> Opgesteld 15 juli 2026 op basis van codebase-analyse (20 sauna's, 52 gepubliceerde
> events waarvan 51 toekomstig, 19 concepts, 31 scraper-bronnen waarvan 21 actief).
> Status: goedgekeurd door Nathaniel; implementatie gefaseerd uitvoeren.
> **Implementatie-instructie:** voer fases in volgorde uit, verifieer per fase de
> acceptatiecriteria (§12), draai `npm run build` + `npm run test` vóór elke commit,
> en committeer per logisch blok. Sla fase-onderdelen die een open beslissing (§14)
> vereisen over zolang die beslissing niet is ingevuld.

---

## 1. Analyse van de huidige SEO-situatie

### Wat al goed staat (behouden, niet opnieuw bouwen)

| Onderdeel | Status |
|---|---|
| `robots.ts` + `sitemap.ts` | ✅ Aanwezig, `/uit/` correct uitgesloten |
| Canonicals | ✅ Elke route zet een eigen `alternates.canonical`; gefilterde `/agenda?...`-URL's canonicaliseren naar `/agenda` |
| Title-template + per-pagina metadata | ✅ Overal `generateMetadata`/`metadata` |
| JSON-LD | ✅ `WebSite`+`Organization` (home), `Event` (detail), `LocalBusiness` (sauna), `ItemList` (maand/provincie) |
| SSG/ISR | ✅ Alles statisch of `revalidate: 3600`, filters via URL-params |
| SEO-landingspagina's | ✅ `/agenda/[maand-jaar]` en `/opgietingen/[provincie]` bestaan al |
| Rendering | ✅ Server Components, minimale JS → INP-risico verwaarloosbaar |
| Zoekformulier | ✅ GET-form, werkt zonder JS |

### De kern van het probleem

De site heeft een **skelet zonder vlees**:

- Event-beschrijvingen: mediaan 107 tekens; de dunste vijf 34–57 tekens.
- Sauna-profielen: 37–99 woorden.
- Nul informatieve content — geen pagina die uitlegt wat een opgieting is.
- `/over` is ~150 woorden zonder mens/verhaal/expertise (E-E-A-T ontbreekt).

Plus drie structurele technische gebreken (§2) en een ontbrekende autoriteitslaag.

---

## 2. Belangrijkste problemen en groeikansen

### Kritiek

- **P1 — Geen favicon, geen icons, geen OG-images.** `src/app/` bevat geen icon-bestand;
  `layout.tsx` heeft geen default OG-image; `twitter.card: summary_large_image` zonder
  afbeelding. Google toont favicons in mobiele SERP's. PRD §5 belooft OG-images per event.
- **P2 — Oneindige URL-ruimte op maandpagina's.** `/agenda/[maand-jaar]` heeft geen
  `dynamicParams = false` en geen guard: `/agenda/maart-2031` rendert 200 met "geen
  opgietingen" → thin/doorway + crawl-budget-lek.
- **P3 — Provinciepagina's zijn event-afhankelijk.** `resolveProvince()` matcht alleen
  provincies met events; verloopt het laatste event, dan wordt de pagina een 404 en is
  de opgebouwde ranking weg. Sitemap bevat alleen provincies-met-events.
- **P4 — Verlopen events hebben geen beleid.** `getAllEvents()` filtert alleen `concept`;
  afgelopen events blijven in de sitemap (priority 0.8), houden `EventScheduled`-schema
  en tonen nergens dat ze voorbij zijn. Groeit wekelijks door de scraper.

### Hoge impact (kansen)

- **K1 — Tijdgebonden intentie onbediend**: "opgieting vandaag", "opgietingen dit
  weekend" — data en helpers (`isUpcoming`, `todayISO`) bestaan al.
- **K2 — Topical authority grijpbaar**: geen NL-site claimt "opgieting/aufguss" als
  onderwerp. Eén pillar + klein cluster maakt opgietingen.nl dé entiteit (ook voor
  AI-zoekmachines).
- **K3 — Type-landingspagina's**: "opgietweekend" (9 events) en NK/BK-kampioenschappen
  (15 events) verdienen evergreen URL's.
- **K4 — Interne linking minimaal**: footer linkt hardcoded alleen naar Gelderland;
  event-pagina's linken niet naar maand/provincie; geen gerelateerde events.
- **K5 — Schema-verdieping**: geen `BreadcrumbList`; `/agenda` en `/saunas` zonder
  `ItemList`; `Event` zonder `offers`/`organizer`; `Organization` zonder `logo`.

### Middel/laag

- Beide hero-images hebben `priority` → dubbele preload; bron-PNG's 1,8 MB.
- `keywords`-meta is dood gewicht.
- Sitemap zonder `lastModified`.
- Geen `llms.txt` (GEO).
- Stockfoto's zonder disclaimer op de pagina zelf.

---

## 3. Aanbevolen informatiearchitectuur

```
/                                  Home (hub)
├── /agenda                        Alle komende events (hub)
│   └── /agenda/[maand-jaar]       Maandpagina's — begrensd (§9)
├── /opgietingen/vandaag           NIEUW — tijdgebonden landing
├── /opgietingen/dit-weekend       NIEUW — tijdgebonden landing
├── /opgietingen/[provincie]       Regiopagina's — sauna-gebaseerd (§9)
├── /opgietweekenden               NIEUW — type-landing
├── /aufguss-kampioenschappen      NIEUW — NK/BK evergreen
├── /wat-is-een-opgieting          NIEUW — pillar (informationeel)
├── /saunas  →  /sauna/[slug]      Overzicht + profielen
├── /event/[slug]                  Event-details (incl. afgelopen-afhandeling)
└── /over, /contact, /voor-saunas  (E-E-A-T-upgrade op /over)
```

Bewuste keuzes:
- `/opgietingen/vandaag` en `/dit-weekend` onder dezelfde prefix als provincies
  (statische routes winnen van `[provincie]`).
- **Eén pillar voor "opgieting" én "aufguss"** — SERP's overlappen; twee pagina's
  kannibaliseren.
- **Geen plaatspagina's** (~1 sauna per plaats; de saunapagina target de plaats al).
  Herzien bij ≥3 sauna's per plaats.
- **Geen aparte FAQ-route**: FAQ-sectie op de pillar. NB: Google toont sinds mei 2026
  geen FAQ-rich-results meer; FAQPage-schema alleen voor AI-citatie-waarde.

---

## 4. Nieuwe pagina's / paginatypen (op verwachte waarde)

| # | Pagina | Zoekintentie | Inhoud | Thin-risico & mitigatie |
|---|---|---|---|---|
| 1 | `/wat-is-een-opgieting` | "wat is een opgieting", "aufguss betekenis" | 1.200–1.800 woorden: citeerbare definitie bovenaan, verloop van een sessie, saunameester, etiquette, soorten, beginners, FAQ (8–10), CTA's naar agenda/vandaag/provincies | Geen — handgeschreven kern |
| 2 | `/opgietingen/vandaag` | "opgieting vandaag" | Events van vandaag (ISR 3600); bij 0 events: eerstvolgende 6 + vaste uitleg (~150 woorden) | Fallback-blok verplicht |
| 3 | `/opgietingen/dit-weekend` | "opgietingen weekend" | Vr-avond + za + zo; zelfde fallback-patroon | idem |
| 4 | `/opgietweekenden` | "opgietweekend" | Alle events `type: opgietweekend` + 300 woorden uitleg | Laag |
| 5 | `/aufguss-kampioenschappen` | "NK aufguss 2026", "BK opgieten" | Evergreen (geen jaartal in URL): uitleg wedstrijd-aufguss, komende NK/BK, sectie per editie | Laag |
| 6 | Provincie-intro's (bestaande route) | "opgietingen gelderland" | Per provincie 150–250 woorden **unieke, handgeschreven** intro | Kritisch: geen template-tekst |
| 7 | `/over`-upgrade | E-E-A-T | Wie erachter zit, hoe de agenda tot stand komt (scraper + handmatige redactie = expertiseclaim), contact | — |

**Later, na GSC-validatie:** `/gids/sauna-etiquette`, `/gids/opgieting-voor-beginners`
(eerst sectie in pillar), verschil opgieting/saunaritueel.

---

## 5. Technische SEO-verbeteringen (volgorde van urgentie)

1. **Icons + OG-images**: `src/app/icon.*` + `apple-icon.png`; default `opengraph-image`;
   dynamische per-event/sauna OG-images via `opengraph-image.tsx` + `ImageResponse`.
2. **Maandpagina-begrenzing** (§9).
3. **Provinciepagina's sauna-gebaseerd** (§9).
4. **Verlopen-events-beleid** (§9).
5. **Sitemap**: `lastModified` waar betrouwbaar; verlopen events en verleden maanden
   eruit; nieuwe routes erin.
6. **Hero-LCP**: één `<picture>` via `getImageProps` (één preload); bron-PNG's
   hercomprimeren naar ~2560px JPG/WebP (~300 KB).
7. **`Organization`-schema**: `logo` (na icon), evt. `sameAs` (beslissing §14).
8. **Search Console + Bing** verifiëren, sitemap indienen; www-redirect en
   productie-`NEXT_PUBLIC_SITE_URL` in Vercel checken. *(Handmatig: Nathaniel.)*
9. **Opruimen**: `keywords`-meta weg; stockfoto-disclaimer ("sfeerbeeld") overwegen.
10. **CWV bewaken** (INP): let op bij de toekomstige Leaflet-kaart — lazy laden.

---

## 6. Content- en topical-authoritystrategie

**Principe: één onderwerp volledig bezitten** — "opgieting/aufguss in NL & BE", niet "sauna".

- **Laag 1 — Pillar** (`/wat-is-een-opgieting`): semantisch anker; alles linkt ernaar.
- **Laag 2 — Programmatische lagen met redactionele kop**: provincie/maand/type/tijd.
  **Regel: geen nieuwe programmatische pagina zonder unieke redactionele inhoud.**
- **Laag 3 — Sauna-profielen verdiepen**: van 37–99 naar 250–400 woorden met uniek
  waarneembare feiten (opgietfrequentie, cultuur, saunameesters, praktisch). Dit zijn
  de affiliate-pagina's.
- **Laag 4 — Event-beschrijvingen**: (a) kwaliteitspoort markeert beschrijvingen
  < ~200 tekens (wel publiceren, wel rapporteren); (b) handmatige aanvulling bij review.
  **Geen AI-verrijking die feiten verzint.**
- **GEO**: citeerbare definitieblokken (vraag-als-kop + direct antwoord), `llms.txt`
  in `public/`, consistente entiteitsnaam, FAQPage voor AI-citatie.

---

## 7. Structured data & indexatiestrategie

**Toevoegen:**

| Schema | Waar | Detail |
|---|---|---|
| `BreadcrumbList` | `Breadcrumb.tsx` (component-niveau) | items + posities uit props |
| `ItemList` | `/agenda` (ongefilterd), `/saunas`, nieuwe lijstpagina's | hergebruik `eventItemListSchema` |
| `Event.offers` | `eventSchema()` | alleen `url: ticketUrl` + `availability`; **prijs alleen als parsebaar** (`prijsIndicatie` is vrije tekst) |
| `Event.organizer` | `eventSchema()` | verwijs naar sauna via `@id` |
| `Organization.logo` | `siteSchema()` | na icon-aanmaak |
| `FAQPage` | pillar | alleen GEO-waarde |

**Niet doen:** `HowTo` (deprecated), `AggregateRating` (geen reviews in fase 1),
`SearchAction` (uitgefaseerd).

**Indexatie-regels:**

| Paginatype | Indexeren? | Mechanisme |
|---|---|---|
| Home, agenda, sauna's, komende events, provincies, maanden met events, nieuwe landings | ✅ | sitemap + interne links |
| `/agenda?...` (filters) | ❌ | bestaande canonical (werkt al) |
| Maanden zonder events / buiten venster | ❌ | 404 (§9) |
| Verlopen events | ✅ tijdelijk | §9 |
| `/uit/*` | ❌ | robots-disallow (werkt al) |

---

## 8. Interne-linkstrategie

1. **Footer dynamisch** (`SiteFooter.tsx`): top-6 provincies op event-aantal + links
   naar `/opgietingen/vandaag`, `/dit-weekend` en de pillar. Hardcoded Gelderland weg.
2. **Event-detailpagina**: contextlinks "Meer opgietingen in {maand}" en "in {provincie}"
   + "Vergelijkbare events"-blok (max 3 komend; zelfde sauna → provincie → type).
3. **Sauna-pagina**: link naar provinciepagina; plaats in lopende tekst.
4. **Maandpagina**: vorige/volgende maand (alleen maanden mét events) + provincielinks.
5. **Provinciepagina**: buurprovincies + maandpagina's.
6. **Pillar sitewide gelinkt** ("Wat is een opgieting?") vanuit header of footer.
7. **Ankertekst-regel**: altijd beschrijvend.

---

## 9. Filters, datums, lege pagina's en verlopen events

**Filters** — al goed (URL-params + canonical). Niets doen.

**Maandpagina's:**
- `dynamicParams = false` → alleen maanden uit `generateStaticParams`; rest echte 404.
- Sitemap: alleen huidige + toekomstige maanden. Verleden maandpagina's blijven bestaan
  (archief) maar uit de sitemap.
- Interne maandlinks: alleen komende maanden.

**Provinciepagina's:**
- `resolveProvince` + `generateStaticParams` baseren op **sauna's** i.p.v. events.
  Provincie met sauna zonder events toont: intro, sauna('s), eerstvolgende events in
  aangrenzende provincies, terugkom-CTA.
- Provincies zonder sauna's: **niet aanmaken** (doorway). Nieuwe bron in `bronnen.json`
  die een provincie ontsluit, activeert vanzelf een pagina.

**Verlopen events** (aanbeveling — bevestiging nodig, §14):
- **Behouden, niet redirecten/verwijderen** (long-tail voor volgende edities).
- Op de pagina: "Dit event is geweest"-banner; affiliate-CTA vervangen door "Bekijk
  komende opgietingen bij {sauna}"; vergelijkbare events prominent.
- Sitemap: verlopen events eruit.
- Schema: `Event` behouden met originele datums; geen `EventCancelled`-misbruik.
- **Editie-koppeling**: nieuwe editie bij dezelfde sauna → oude pagina toont
  "Nieuwe editie: {titel} {jaar}" met link.
- Na 12 maanden: verlopen events zonder opvolger/impressies (GSC) → `noindex` of 410.

**Lege staten**: `/vandaag` en `/dit-weekend` hebben per ontwerp een fallback-blok.

---

## 10 & 11. Gefaseerde volgorde met prioriteiten

### Fase 0 — Meten & hygiëne (impact hoog, complexiteit laag, ~½ dag)
1. GSC + Bing verifiëren, sitemap indienen; www-redirect + `NEXT_PUBLIC_SITE_URL`
   checken. *(Handmatig: Nathaniel — Claude kan wel verificatiebestanden klaarzetten.)*
2. Favicon/icons + default OG-image.
3. `keywords`-meta weg; hero-bronnen comprimeren; dubbele hero-preload fixen.

### Fase 1 — Structurele fixes (impact hoog, complexiteit laag-middel, 1–2 dagen)
4. `dynamicParams = false` op maandroute + sitemap-venster.
5. Provinciepagina's sauna-gebaseerd + lege-staat-ontwerp.
6. Verlopen-events-afhandeling (banner, CTA-swap, sitemap, editie-koppeling).
7. `BreadcrumbList`; `ItemList` op `/agenda` + `/saunas`; `Event.offers`/`organizer`;
   `Organization.logo`.
8. Interne linking: dynamische footer, event→maand/provincie, vergelijkbare events,
   maand-navigatie.

### Fase 2 — Landingspagina's met zoekwaarde (impact hoog, complexiteit middel, 2–3 dagen)
9. Pillar `/wat-is-een-opgieting` (+ FAQ + FAQPage-schema + `llms.txt`).
10. `/opgietingen/vandaag` + `/dit-weekend`.
11. `/opgietweekenden` + `/aufguss-kampioenschappen`.
12. Dynamische OG-images per event/sauna.

### Fase 3 — Content-verdieping (doorlopend, start na fase 2)
13. Provincie-intro's (11 × 150–250 woorden, handgeschreven/gereviewd).
14. Sauna-profielen naar 250–400 woorden (start bij de 6 met de meeste events).
15. Scraper-poort: minimumlengte-markering; redactieslag concepts (19 wachten).
16. `/over` E-E-A-T-upgrade.

### Fase 4 — Schaal & autoriteit (na zichtbare GSC-tractie)
17. Bronnen 21 → 50+ actief.
18. Linkbuilding: partnerbadge/widget voor sauna's, saunagidsen, pers rond NK/BK,
    Aufguss-verenigingen.
19. Gids-cluster uitbreiden o.b.v. GSC-queries.

---

## 12. Acceptatiecriteria per fase

**Fase 0:**
- [ ] GSC toont eigendom + sitemap "Geslaagd"; `site:opgietingen.nl` toont favicon
- [ ] Share op WhatsApp toont beeld + titel + omschrijving
- [ ] Lighthouse (mobiel, home): LCP < 2,5 s; precies één hero-preload in de HTML

**Fase 1:**
- [ ] `/agenda/maart-2031` → HTTP 404; alle maand-URL's in sitemap ≥ huidige maand
- [ ] Provinciepagina van sauna-provincie zonder events → HTTP 200 met inhoud
- [ ] Verlopen event: banner, geen affiliate-CTA, wél doorverwijzingen; uit sitemap
- [ ] Rich Results Test: `BreadcrumbList` + `Event` (met `offers`) valide
- [ ] Footer bevat ≥ 6 provincielinks; event-pagina linkt naar maand + provincie
- [ ] `npm run build` slaagt; bestaande tests groen

**Fase 2:**
- [ ] Pillar ≥ 1.200 woorden, sitewide gelinkt, FAQPage valide
- [ ] `/opgietingen/vandaag` toont bij 0 events het fallback-blok
- [ ] Alle nieuwe routes in sitemap met eigen canonical/title/description
- [ ] `public/llms.txt` bereikbaar
- [ ] OG-image van een event bevat titel + datum + sauna

**Fase 3:**
- [ ] Geen twee provincie-intro's met gedeelde zinnen (steekproef)
- [ ] Top-6 sauna's ≥ 250 woorden
- [ ] Scraper-issue rapporteert dunne beschrijvingen

**Fase 4 (leading indicators, GSC):**
- [ ] Impressies op niet-merk-queries stijgen maand-op-maand
- [ ] ≥ 1 informationele query in top-10
- [ ] ≥ 5 verwijzende domeinen

---

## 13. Te wijzigen bestanden/routes/componenten

| Bestand | Wijziging |
|---|---|
| `src/app/agenda/[maand-jaar]/page.tsx` | `dynamicParams = false`, maand-navigatie |
| `src/app/opgietingen/[provincie]/page.tsx` | sauna-gebaseerd, lege staat, intro-slot |
| `src/app/event/[slug]/page.tsx` | afgelopen-banner, CTA-swap, contextlinks, vergelijkbare events, editie-link |
| `src/app/sitemap.ts` | maandvenster, verlopen events eruit, nieuwe routes, `lastModified` |
| `src/app/layout.tsx` | `keywords` weg, default OG-image |
| `src/lib/schema.ts` | `BreadcrumbList`, `offers`, `organizer`, `logo`, `FAQPage`-helper |
| `src/lib/content.ts` | `getUpcomingEvents`, `getEventsForDay/Weekend`, `getProvincesWithSaunas`, `findNextEdition` |
| `src/lib/dates.ts` | weekend-helpers |
| `src/components/Breadcrumb.tsx` | JSON-LD |
| `src/components/SiteFooter.tsx` | dynamische kolommen |
| `src/components/HeroHeader.tsx` | enkele preload (`getImageProps`) |
| **Nieuw** | `src/app/wat-is-een-opgieting/page.tsx`, `src/app/opgietingen/vandaag/page.tsx`, `.../dit-weekend/page.tsx`, `src/app/opgietweekenden/page.tsx`, `src/app/aufguss-kampioenschappen/page.tsx`, `src/app/icon.*`, `opengraph-image.tsx` (root/event/sauna), `public/llms.txt`, `src/components/RelatedEvents.tsx` |
| Content | `content/saunas/*.mdx` (verdieping), provincie-intro's (nieuw veld of `content/provincies/*.mdx`), pillar-copy |
| Scraper | `scripts/lib/quality-gate.ts` (lengte-markering), `scripts/scrape-report.ts` |

---

## 14. Risico's, afhankelijkheden en open beslissingen

**Risico's:**
- Doorway-grens: programmatische pagina's zonder unieke copy niet uitbreiden.
- Scraper-thin-content: poort-markering + steekproef is de bewaking.
- Stockfoto's: disclaimer of echte partnerfoto's (fase 4-gesprek).
- Alle validatie loopt via Search Console → fase 0 blokkeert de rest.
- `todayISO()` in ISR-paden: bewust ISR (revalidate 3600), documenteren.

**Open beslissingen (invullen vóór de betreffende fase):**
1. Verlopen events: akkoord met "behouden + banner + na 12 mnd opschonen o.b.v. data"? → **[BESLISSING: ____]**
2. Wie staat op /over (naam/gezicht)? → **[BESLISSING: ____]**
3. Socials: bestaat `@opgietingen`? Welke kanalen komen er (voor `sameAs`)? → **[BESLISSING: ____]**
4. Provincie-intro's: zelf schrijven of laten schrijven met review? → **[BESLISSING: ____]**
5. Telefoonnummers/openingstijden sauna's verzamelen voor rijker LocalBusiness-schema? → **[BESLISSING: ____]**
6. NK/BK: contact met organisaties voor officiële vermelding/link? → **[BESLISSING: ____]**

**Ontbrekende data/content:** provincie-copy, pillar-copy, echte saunafoto's,
telefoonnummers, gestructureerde prijzen, socials, logo-bestand.

**Bewust nog níét bouwen:** plaatspagina's (tot ≥3 sauna's/plaats), aparte
`/aufguss`-pagina (kannibalisatie), reviews/ratings-schema, hreflang/i18n,
kalenderweergave, betaalde keyword-tooling.
