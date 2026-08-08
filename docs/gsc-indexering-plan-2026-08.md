# GSC-indexeringsplan — augustus 2026

Implementatieplan op basis van vier Coverage-Drilldown-exports uit Google Search Console
(`GSC reports/`, momentopname 2026-08-05, geëxporteerd 2026-08-08). Aanvulling op
[SEO-PLAN.md](../SEO-PLAN.md) — dit document gaat alleen over indexeringsdekking.

## Wat de rapporten zeggen

Twee van de vier exports zijn identiek (dezelfde 403-drilldown, dubbel gedownload). Er zijn
dus **drie** unieke problemen:

| # | Probleem (GSC) | URLs | Diagnose | Verdict |
|---|----------------|------|----------|---------|
| 1 | Pagina met omleiding | `http://opgietingen.nl/`, `https://www.opgietingen.nl/` | 308 → `https://opgietingen.nl/` | **Correct gedrag — geen actie** |
| 2 | Geblokkeerd wegens verboden toegang (403) | `http://(www.)opgietingen.nl/index.php` | Vercel-firewall blokkeert PHP-probe-paden (`x-vercel-mitigated: deny`) | **Laag — cosmetisch** |
| 3 | Gevonden, momenteel niet geïndexeerd | 12 URLs, allemaal `laatst gecrawld 1970-01-01` (= nooit gecrawld) | Jonge site, beperkt crawl-budget + een paar dunne varianten | **Hier zit het werk** |

Verhouding: 141 URLs in `sitemap.xml`, 12 daarvan niet geïndexeerd (8,5%). Dat is voor een
site die ~4 weken live is een normale, gezonde uitgangspositie — geen technisch defect.

---

## 1. Redirect-rapport — geen actie

`http://opgietingen.nl/` en `https://www.opgietingen.nl/` geven allebei een 308 naar
`https://opgietingen.nl/`. Precies wat je wilt. Dit rapport verschijnt alleen omdat de
GSC-property een **domein-property** is en dus alle host-varianten ziet.

Geverifieerd: canonicals wijzen overal naar de kale https-host, `sitemap.xml` gebruikt
uitsluitend `https://opgietingen.nl`, geen interne links naar `www.`.

**Actie:** geen. Niet valideren, niet "oplossen" — het rapport blijft bestaan en dat is prima.

---

## 2. 403 op `/index.php` — cosmetisch, twee opties

De 403 komt van Vercels firewall (managed ruleset tegen bot-probes), niet van de app:
`/index.php` en `/wp-login.php` geven allebei `HTTP 403` met header `x-vercel-mitigated: deny`,
terwijl een gewone onbekende URL netjes een 404 geeft. Deze URLs hebben nooit bestaan; Google
kent ze uit oude probe-verkeer of een legacy-link.

Impact op rankings: nul. Een 403 op een niet-bestaande URL kost geen posities.

**Optie A (aanbevolen): laten staan.** De firewall doet zijn werk.

- [x] **Geverifieerd op 2026-08-08** met een volledige crawl van het live domein als Googlebot,
      wat harder bewijs is dan de dashboardlogs: **alle 140 sitemap-URL's geven 200**, evenals
      `robots.txt`, `sitemap.xml`, `feed.xml`, `agenda.ics`, `llms.txt`, de dynamische
      OG-images, de per-event `.ics`-downloads en gefilterde agenda-URL's met querystring.
      De affiliate-redirect geeft 302. Geen rate-limit of bot-challenge bij 140 snelle
      requests achtereen.

      De mitigatie is exact één regel breed: **alleen de extensie `.php`** (`/index.php`,
      `/wp-login.php`, `/admin.php`, `/xmlrpc.php`, `/config.php` → 403), terwijl
      `/.env`, `/.git/config` en onbekende paden een gewone 404 geven. Op een Next.js-site
      bestaat geen legitiem `.php`-pad, dus een vals-positief is uitgesloten.

**Conclusie: niets doen.** De twee URLs blijven in GSC als "geblokkeerd" staan — ze verdwijnen
alleen als ze gaan 404'en of redirecten, en daarvoor zou je de bescherming moeten versoepelen
op precies het pad dat het vaakst geprobeerd wordt. Slechte ruil voor een rapportregel die
geen ranking kost.

**Optie B (als je de melding weg wilt):** eerst een custom firewall-rule `path equals /index.php → Allow`
(custom rules gaan vóór de managed ruleset), daarna in `next.config.ts`:

```ts
async redirects() {
  return [{ source: "/index.php", destination: "/", permanent: true }];
}
```

Volgorde is essentieel: zonder de Allow-rule bereikt het verzoek de routinglaag nooit en blijft
de 403 staan. Na deploy verifiëren met
`curl -s -o /dev/null -w "%{http_code}" https://opgietingen.nl/index.php` (verwacht: 308).

---

## 3. De 12 niet-geïndexeerde pagina's — het echte werk

Alle twaalf hebben crawl-datum `1970-01-01`: Google kent de URL (uit de sitemap), maar heeft
hem **nog nooit opgehaald**. Dat is geen kwaliteitsoordeel over de pagina, het is crawl-budget.

| URL | Komende events | Opmerking |
|-----|---------------|-----------|
| `/opgietingen/antwerpen` | 0 | 1 sauna, geen events → dunne staat |
| `/opgietingen/noord-holland` | 0 | 3 sauna's, geen events → dunne staat |
| `/opgietingen/vlaams-brabant` | 1 | 5 sauna's |
| `/opgietingen/utrecht` | 3 | 2 sauna's |
| `/agenda/december-2026` | 4 | dunne maand |
| `/agenda/september-2026` | 11 | ~3.300 woorden — **niet dun** |
| `/agenda/augustus-2026` | 11 | ~3.400 woorden — **niet dun** |
| `/sauna/thermae-boetfort` | 2 | rooster + 261 woorden body |
| `/sauna/thermen-binnenmaas` | 5 | rooster + 260 woorden body |
| `/gids/beste-saunageuren-2026` | n.v.t. | ~2.300 woorden |
| `/event/opgietweekend-2026-09-05` | n.v.t. | |
| `/event/vitae-goes-opgietdag-2026-10-24` | n.v.t. | |

Dat `/agenda/augustus-2026` (de drukste maandpagina van de site) er tussen staat, bevestigt de
diagnose: dit is **crawl-budget, geen contentprobleem**. Content-verbetering helpt wel voor de
vier dunne pagina's bovenaan, maar het hoofdmedicijn is autoriteit + interne linkkracht.

### Fase 1 — quick wins (deze week, ±1 uur)

- [ ] **1.1 Indexering aanvragen** in GSC → URL-inspectie → "Indexering aanvragen", voor alle
      12 URLs. Handmatig, ±15 min. Dit is de snelste manier om nooit-gecrawlde URLs een eerste
      crawl te geven; verwacht resultaat binnen 1–2 weken zichtbaar.
- [ ] **1.2 Firewall-log-check** (zie §2, optie A).
- [x] **1.3 `lastModified` op saunapagina's** in [src/app/sitemap.ts](../src/app/sitemap.ts).
      28 van de 41 sauna's hebben al een `roosterGecheckt`-datum uit
      `npm run check-roosters` — dat is een **echte** verificatiedatum, geen gefingeerde.
      Die mag dus wél als `lastModified` mee (de bestaande comment sluit alleen verzonnen
      datums uit). Geeft Google een legitiem versheidssignaal per saunapagina.
      Sauna's zonder `roosterGecheckt` blijven zonder lastMod.
      *Geverifieerd in de build: 28 van de 41 sauna-URL's hebben nu een `<lastmod>`.*

### Fase 2 — dunne pagina's inhoud geven (1–2 dagen werk)

- [x] **2.1 Vaste opgietroosters op provinciepagina's.**
      [src/app/opgietingen/[provincie]/page.tsx](../src/app/opgietingen/[provincie]/page.tsx)
      heeft nu een sectie **"Vaste opgiettijden in \<provincie\>"** die per sauna in de regio
      het `opgietRooster` rendert, met een link naar het saunaprofiel en één bronvermelding
      met de meest recente controledatum. Unieke, blijvende content die niet leegloopt als er
      even geen events zijn. Gedeeld met de saunapagina via
      [OpgietRoosterTabel](../src/components/OpgietRoosterTabel.tsx).
      *Effect gemeten op de prerender: Noord-Holland 1.555 → 1.776 woorden,
      Utrecht 1.648 → 1.857, Vlaams-Brabant 1.589 → 2.018.*
- [ ] **2.2 Roosterdekking** — 13 van de 41 sauna's hebben geen rooster.
      Hiervoor is [scripts/vind-roosters.ts](../scripts/vind-roosters.ts) toegevoegd
      (`npm run vind-roosters`): het zoekt een rooster op de eigen pagina van de sauna en
      schrijft **voorstellen met broncitaat** naar `rooster-voorstellen.json` — bewust geen
      automatische write, want een nieuw rooster opvoeren is een grotere claim dan een
      bestaand rooster bevestigen.

      **Uitkomst van de eerste volledige run (2026-08-08): 0 voorstellen, 13 zonder resultaat.**
      Steekproef bevestigt dat dit klopt en geen extractiefout is: Sauna Swoll schrijft
      letterlijk "Wij hanteren het onderstaande opgietschema", maar de tijden zelf staan niet
      in de statische HTML (afbeelding of JS-component). Deze 13 vergen dus **handwerk** —
      `rooster-voorstellen.json` bevat per sauna de exacte gecontroleerde URL als startpunt.
      Prioriteit: `lago` (de enige sauna in Antwerpen; die provinciepagina heeft daardoor nog
      steeds geen rooster-sectie), daarna `spaweesp` (Noord-Holland) en `waer-waters`
      (Vlaams-Brabant).

      Bewust níét gedaan: Firecrawl inzetten om deze JS-pagina's te renderen. Credits zijn de
      schaarse resource en `check-roosters` mijdt Firecrawl om dezelfde reden — die afweging
      is aan jou, niet aan het script.

      **Alle 13 handmatig nagelopen op 2026-08-08.** Werkwijze: sitemap van de sauna uitlezen,
      zoeken naar een aparte opgiet-/programmapagina, en die pagina lezen. De vraag was steeds
      of het script niets vond omdat er niets ís, of omdat het naar de verkeerde pagina keek.

      | Sauna | Uitkomst | Bewijs |
      |---|---|---|
      | `lago` | **rooster gevonden** ✅ | verkeerde bron-URL; rooster stond op `/wellness/opgietsessies` |
      | `sauna-zwaluwhoeve` | geen rooster | "Informeer bij de receptie voor de mogelijkheden op de dag zelf" |
      | `spasense` | geen rooster | idem |
      | `spawell` | geen rooster | idem |
      | `sauna-elysium` | geen rooster | idem |
      | `spaweesp` | geen rooster | idem |
      | `thermen-holiday` | geen rooster | idem |
      | `thermen-barendrecht` | geen rooster | zelfde beleid, andere formulering ("niet vooraf gereserveerd") |
      | `thermen-bad-nieuweschans` | geen rooster | eigen opgietingen-pagina, wel thema's, geen tijden |
      | `waer-waters` | geen rooster | 7 sessietypes zonder tijden; geen agendapagina in de sitemap |
      | `palestra` | geen rooster | beschrijft opgietingen, publiceert geen tijden |
      | `spa-loppersum` | geen rooster | "opgietingen vinden alleen plaats bij voldoende gasten" |
      | `sauna-swoll` | **JS-only** ⚠️ | schema bestaat wél, maar in een client-side uitklappaneel |

      **Conclusie: 11 van de 13 publiceren écht geen vast rooster** — grotendeels omdat de
      BeWellness-resorts (7 van de 13) bewust met een dagprogramma bij de receptie werken.
      Dat is geen scrapeprobleem maar een bedrijfskeuze, en die profielen beschrijven het al
      correct in hun bodytekst. Niet opnieuw proberen.

      **Enige overgebleven Firecrawl-kandidaat: `sauna-swoll`.** Die belooft letterlijk
      "Wij hanteren het onderstaande opgietschema" met twee panelen (ma t/m za, zondag), maar
      rendert de inhoud client-side. Eén Firecrawl-call zou dat rooster opleveren.

      Nevenbevinding: `spa-loppersum` kondigt opgietspecials alleen aan op zijn nieuwspagina,
      en het laatste bericht dateert van **21-10-2024**. Die bron levert al bijna twee jaar
      niets op; overweeg de status te heroverwegen bij de volgende bronnenronde.
- [ ] **2.3 Maandpagina's met weinig events** (`december-2026`, 4 events): geen technische
      ingreep, maar een contentopdracht — bronnen aanvullen zodat de maand vult. De scraper
      draait wekelijks; check `content/bronnen.json` op sauna's met status `geen-agenda` /
      `handmatig` in de dunne provincies.

### Fase 3 — interne linkkracht verleggen (halve dag)

De provinciepagina's worden nu vrijwel uitsluitend vanuit de **footer** gelinkt
([src/components/SiteFooter.tsx](../src/components/SiteFooter.tsx)). Site-brede footerlinks
tellen licht mee; contextuele links uit de bodytekst wegen zwaarder en sturen crawl-budget.

- [x] **3.1 Contextuele regiolinks in de gidsen.** Vier gidsen hebben nu een natuurlijke link
      naar de uitgehongerde pagina's: `beste-saunageuren-2026` (zelf niet geïndexeerd) en
      `zo-werkt-een-opgieting-voor-beginners` en `wat-neem-je-mee-naar-een-opgieting` naar
      Noord-Holland/Utrecht/Vlaams-Brabant/Antwerpen, en `aufguss-etiquette` naar
      Thermae Boetfort en Thermen Binnenmaas. Bewust vier en niet alle elf: een ingevoegde
      link moet de zin verbeteren, anders leest het als linkstuffing.
- [x] **3.2 `/wat-is-een-opgieting`** — was al gedekt: de sectie "Waar kun je een opgieting
      meemaken?" linkt in de bodytekst al naar alle provinciepagina's. Geen wijziging nodig.
- [x] **3.3 Saunapagina's onderling linken** — `/sauna/[slug]` heeft nu een sectie
      "Andere sauna's in \<provincie\>" (max 6 kaarten, daarboven een doorlink naar de
      provinciepagina). Trekt Boetfort en Binnenmaas uit het linkschaduwgebied en maakt van
      de saunapagina's onderling een netwerk in plaats van 41 losse bladeren aan `/saunas`.

### Fase 4 — externe signalen (doorlopend, grootste hefboom)

Crawl-budget volgt autoriteit. Zonder inkomende links blijft elke technische ingreep marginaal.

- [ ] **4.1** Bij elke sauna die in de agenda staat: vraag om een link vanaf hun site
      ("wij staan op Opgietingen.nl"). De B2B-pitch op `/voor-saunas` is hiervoor het haakje.
- [ ] **4.2** Aanmelden/plaatsen in saunacommunities (Facebook-groepen, saunafora,
      Aufguss-verenigingen). Geen linkspam — één goede vermelding per kanaal.
- [x] **4.3 IndexNow** — [scripts/indexnow.ts](../scripts/indexnow.ts) (`npm run indexnow`)
      meldt de in de laatste commit gewijzigde publieke URL's aan bij Bing/Yandex c.s., en
      draait als stap in [scrape.yml](../.github/workflows/scrape.yml) — alleen ná een échte
      commit, want zonder wijziging zou `HEAD~1` de vorige run opnieuw inleveren.
      Sleutelbestand: `public/38f2c6c024a1b9b8644fad1764c9fa76.txt`.
      **Werkt pas na de eerstvolgende deploy**, want de zoekmachine haalt dat bestand van het
      live domein op. Google doet niet mee aan IndexNow; daar blijft de sitemap het kanaal.
- [ ] **4.4** Bing Webmaster Tools aanmelden + sitemap indienen (10 minuten). Niet nodig voor
      IndexNow hierboven, wel voor de rapportage aan Bing-kant.

---

## Verwachte uitkomst en meetpunt

| Termijn | Verwachting |
|---------|-------------|
| 1–2 weken | De 12 aangevraagde URLs zijn gecrawld; het merendeel geïndexeerd |
| 4–6 weken | Fase 2+3 zichtbaar: dunne provinciepagina's blijven geïndexeerd i.p.v. terug te vallen |
| 3 maanden | Crawlfrequentie omhoog dankzij fase 4; nieuwe events worden binnen dagen opgepikt |

**Meten:** GSC → Pagina-indexering, wekelijks. Let op de verhouding
"Gevonden, niet geïndexeerd" / totaal in de sitemap (nu 12/141). Loopt dat percentage op
terwijl de site groeit, dan is er wél een kwaliteitsprobleem en herzien we fase 2.

**Niet doen:** dunne provinciepagina's uit de sitemap halen of op `noindex` zetten. De URL en
de opgebouwde ranking moeten blijven bestaan wanneer events verlopen (SEO-PLAN §9) — het
antwoord op een dunne pagina is inhoud toevoegen, niet verbergen.
