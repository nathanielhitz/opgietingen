# Social-fundament en wekelijkse social-kit — ontwerp

Datum: 2026-09-08. Status: ontwerp, ter review.

Dit is deelproject 1 van het social-marketingtraject. Het legt de basis op de site
(links, schema, link-in-bio, deelknoppen) en bouwt de kit die elke week
huisstijl-beelden en captions uit de agenda genereert. Automatisch plaatsen is
deelproject 2 en staat hier alleen als contract beschreven (§7).

## 1. Aanleiding

Nathaniel heeft op 2026-09-08 drie kanalen aangemaakt: Instagram `@opgietingen.nl`,
een Facebook-pagina (`https://www.facebook.com/profile.php?id=61594226581273`, nog
zonder gebruikersnaam) en TikTok `@Opgietingen.nl`. De site verwijst nergens naar
sociale kanalen (geen footer-links, geen `sameAs`, een X-placeholder in de
site-config die nooit is gebruikt); het SEO-plan parkeerde dat bewust tot de kanalen
echt zouden bestaan.

Wat er wél ligt: 48 komende gepubliceerde events (10–13 per maand tot en met
november 2026), per-event OG-beelden via `next/og`, RSS- en ICS-feeds, en een
wekelijkse maandagrun die de agenda vers houdt. De zwakke plek is beeld: zes events
hebben een eigen sfeerbeeld, de rest valt terug op saunafoto of logo.

## 2. Beslissingen

| Vraag | Besluit | Waarom |
|---|---|---|
| Waar beginnen | Fundament + kit nu; automatisch plaatsen later | Zonder content, volgers en bewezen format automatiseert een poster stilte. De kit is in beide gevallen nodig. |
| Automatisch plaatsen via | **Buffer-API**, niet de Meta Graph API | Buffer heeft een API in het gratis plan (één sleutel, ~3.000 aanvragen/maand), dekt Instagram, Facebook én TikTok (Buffer is door TikTok geaudit; onze eigen TikTok-app zou tot een audit alleen privé kunnen posten) en vergt geen Meta-developer-app of tokenbeheer. Publer (API alleen Business) en Metricool (API alleen Advanced, 20 posts/maand gratis) vallen af voor automatisering. |
| Ritme | **B: basis + maandritme** | Vier rubrieken: *Dit weekend*, *Uitgelicht*, *Deze maand*, *Nieuw in de agenda*. Drie tot vier posts per week, vol te houden in een half uur. |
| Plandag | **Vrijdag** | Nathaniels vaste half uur. *Dit weekend* gaat dan direct de deur uit, precies wanneer mensen hun weekend plannen. |
| Beeld | **Hybride** | Sfeerbeeld met overlay voor covers; event-slides met eigen eventbeeld of echte saunafoto als die er is, anders houtgradient met saunalogo. Geen AI-beeld dat suggereert hoe een sauna eruitziet (besluit 2026-07-26, zie `docs/image-prompts.md`). |
| Stem | **Merkstem, "wij"** | Consistent met de over-pagina; alles kan uit templates komen. |
| Vorm | **Carrousels**: cover, één slide per event, afsluiter | Een lijst van zes events op één kaart is onleesbaar; carrousels werken identiek op Instagram, Facebook en TikTok-fotomodus. |
| Waar de kit leeft | **Live beeldroutes + planning-JSON + lokaal script**, geen beheer-tab | Nathaniel plant vanaf zijn laptop; met de Buffer-adapter kijkt hij straks in Buffer zelf. Eén renderstack (next/og), geen opslag, URL's die Buffer later direct kan ophalen. |
| Captions | **Templates**, geen model | Deterministisch en testbaar, geen API-kosten, geen "AI-toon". Variatie via rouleren op weeknummer. |

## 3. Fundament op de site

### 3.1 Configuratie — `src/lib/site.ts`

```ts
export const socials = [
  { id: "instagram", label: "Instagram", handle: "opgietingen.nl", url: "https://www.instagram.com/opgietingen.nl/" },
  { id: "facebook",  label: "Facebook",  url: "https://www.facebook.com/profile.php?id=61594226581273" },
  { id: "tiktok",    label: "TikTok",    handle: "opgietingen.nl", url: "https://www.tiktok.com/@opgietingen.nl" },
] as const;
export type SocialId = (typeof socials)[number]["id"];
```

`site.twitter` verdwijnt; in `src/app/layout.tsx` blijft `twitter.card` staan zonder
`site`. Zodra de Facebook-pagina een gebruikersnaam heeft, verandert alleen de URL hier.

### 3.2 Zichtbaar op de site

- **Footer** (`SiteFooter.tsx`): blok "Volg ons" met drie icoonlinks in de merk-cel (het grid blijft vijf kolommen). Component
  `SocialLinks.tsx` met inline SVG-iconen (geen icon-bibliotheek), `target="_blank"`,
  `rel="me noopener"`, `aria-label="Opgietingen.nl op Instagram"` enz. Kleuren via
  themetokens (`text-ink-soft`, hover `text-ember`).
- **/over**: één zin met dezelfde drie links, gerenderd door hetzelfde component in
  tekstvariant.
- **/voor-saunas**: één zin erbij: opgenomen events delen we ook op onze sociale
  kanalen. Maakt de gratis vermelding tastbaarder in de B2B-pitch.
- **Structured data** (`schema.ts`, `siteSchema()`): `Organization.sameAs` =
  `socials.map(s => s.url)`.

### 3.3 Link-in-bio — `/links`

Route `src/app/(site)/links/page.tsx` (binnen `(site)` zodat Vercel Analytics de
UTM-bezoeken meet). Mobiel-eerst: logo, één regel ("Dé agenda voor opgietingen in
Nederland en België"), daaronder knoppen:

| Knop | Doel |
|---|---|
| Dit weekend | `/opgietingen/dit-weekend` |
| Volledige agenda | `/agenda` |
| Deze maand | `/agenda/<currentMonthSlug(todayISO())>` |
| Wat is een opgieting? | `/wat-is-een-opgieting` |
| Saunagids | `/gids` |
| Onze saunahoed | `/saunahoed` |

Searchparam `k` ∈ `instagram | facebook | tiktok`; ontbreekt of onbekend → `social`.
Elke knop krijgt `?utm_source=<k>&utm_medium=bio&utm_campaign=links` via de helper
`utmUrl(pad, { source, medium, campaign })` in nieuw `src/lib/utm.ts`. De pagina is
dynamisch (searchParams), `robots: { index: false, follow: true }`, niet in de
sitemap. De bio-URL per kanaal is `opgietingen.nl/links?k=instagram` enz.

### 3.4 Deelknoppen op eventpagina's

Client-component `EventDeelKnoppen.tsx`, onder de .ics-link, alleen bij komende events:

- **WhatsApp**: `https://wa.me/?text=<titel> – <url>` met
  `utm_source=whatsapp&utm_medium=deel&utm_campaign=event-<slug>`.
- **Link kopiëren**: `navigator.clipboard.writeText(url)` met
  `utm_source=link&utm_medium=deel&…`; korte bevestiging "Gekopieerd".
- **Delen…**: `navigator.share` met `utm_source=native&utm_medium=deel&…`; de knop
  wordt pas na mount getoond als `navigator.share` bestaat (geen hydration-mismatch).

De bestaande OG-beelden zorgen voor de preview in WhatsApp.

### 3.5 Tests fundament

- Nieuw `scripts/lib/social-links.test.ts`: `siteSchema()` bevat `sameAs` met precies
  de drie URL's; `utmUrl` voegt parameters correct toe aan paden met en zonder
  bestaande query; `socials` heeft drie unieke id's en https-URL's.
- `beheer-routes.test.ts` uitbreiden: sitemap bevat `/links` niet.
- Metadata van `/links` exporteert `robots.index === false` (test via import van de
  page-module, zoals `sauna-meta.test.ts` doet).

## 4. Beeldroutes — `src/app/social/…`

Route-handlers (`route.tsx`) buiten `(site)`: geen SiteChrome, geen analytics.
Rendering met `ImageResponse` uit `next/og`. Logo.s, event- en sfeerbeelden gaan via de
eigen oorsprong (`request.nextUrl.origin`, lokaal én op Vercel) met een HEAD-check
vooraf: `public/` zit niet in de functiebundel, en een 404-beeld laat satori hard falen;
ontbreekt een beeld, dan valt de slide terug op de houtgradient.

### 4.1 Fonts

Fraunces 600 en Inter 400/500 via de Google Fonts CSS-API (met een oude User-Agent
levert die statische TTF-instanties per gewicht), één keer per proces geladen en
meegegeven via de `fonts`-optie van `ImageResponse`. Geen fontbestanden in de repo;
faalt het laden, dan rendert de slide met de standaardfont in plaats van een 500.
`next/font` werkt niet in satori.

### 4.2 Formaten

Searchparam `formaat`: `feed` (default, 1080×1350, 4:5) of `story` (1080×1920, 9:16).
Story houdt boven en onder 250 px vrij van tekst (UI-zones van Instagram en TikTok).
Alle slides tonen onderin het woordmerk "opgietingen.nl".

### 4.3 Routes

| Route | Inhoud | 404 als |
|---|---|---|
| `/social/weekend/[week]` | Cover *Dit weekend*. `week` = ISO-week, bv. `2026-W37`; weekend = vr t/m zo van die week. Kop: aantal events, bereik "vr 11 t/m zo 13 sep". | `week` ongeldig |
| `/social/maand/[maand-jaar]` | Cover *Deze maand*, bv. `oktober-2026`. | slug ongeldig |
| `/social/nieuw/[datum]` | Cover *Nieuw in de agenda*: events met `gepubliceerdOp` in `[datum-6, datum]` en `startDatum ≥ datum`. | datum ongeldig |
| `/social/event/[slug]` | Event-slide. | event onbekend of onzichtbaar (loader filtert concept/afgewezen) |
| `/social/afsluiter` | Afsluiter, statisch. | — |
| `/social/profiel` | 1080×1080, logo (ember-soft) op houtgradient zoals het logo-rondje in de sitekop, voor profielfoto's. Geen `formaat`. | — |
| `/social/omslag` | 1640×624, hero-beeld met overlay + tagline, Facebook-omslag. Geen `formaat`. | — |
| `/social/planning` | JSON, zie §5.3. `?datum=YYYY-MM-DD`, default vandaag (NL-tijdzone). | datum ongeldig |

Covers met nul events renderen gewoon ("0 opgietingen" komt niet voor in de
planning, want de planning laat zo'n post weg; de route bestaat voor de volledigheid).

Headers op alle routes: `X-Robots-Tag: noindex`, `Cache-Control: public, max-age=300,
s-maxage=86400`. Vercel leegt de edge-cache bij elke deploy en content wijzigt alleen
via een deploy, dus een dag cachen is veilig. De planning-route is de uitzondering: `Cache-Control:
no-store`, omdat de standaard-`datum` (vandaag) anders een dag lang blijft hangen. Bewust **geen** `Disallow: /social/` in
robots.txt: de fetcher van Facebook respecteert robots.txt en moet de beelden kunnen
ophalen.

### 4.4 Templates

- **Cover**: sfeerbeeld (`public/images/social/weekend.jpg`, `maand.jpg`, `nieuw.jpg`;
  9:16, ≤ 400 KB, door Nathaniel gegenereerd met de prompts die aan
  `docs/image-prompts.md` worden toegevoegd), donkere gradient van onder naar boven,
  label bovenin in ember-badge ("Dit weekend" / "Deze maand: oktober" / "Nieuw in de
  agenda"), grote Fraunces-kop met het aantal ("6 opgietingen"), daaronder het bereik
  of de maand in `ember-soft`, en daaronder het **programma**: per event één regel
  (compacte dag "vr 11" / "za 12–13" in `ember-soft`, saunanaam, plaats), max. 5 regels
  op feed en 7 op story, daarna "+ N meer op opgietingen.nl" (`programmaRegels`, pure
  functie). Met programma is de sluier over het beeld zwaarder (donker vanaf ±45%) en de
  kop een maat kleiner. Ontbreekt het sfeerbeeld, dan valt de cover terug op de
  homepage-hero (`/images/hero/hero-mobiel.jpg`, hetzelfde palet en ook generiek), en
  pas daarna op houtgradient (`wood-dark → wood`); de build breekt niet.
  (Besluit 2026-09-11: variant "sfeerbeeld + programma" gekozen boven een fotomozaïek
  van de sauna's en een puur typografische cover.)
- **Event-slide**: als `event.afbeelding` bestaat (eigen eventbeeld of, via de
  loader, de echte saunafoto) → beeld met overlay; anders houtgradient met het
  saunalogo op een crème plaat (werkt voor `logoAchtergrond` licht én donker), zonder
  logo alleen typografie. Inhoud: type-badge, titel (fontgrootte schaalt bij > 40
  tekens, max. 3 regels, daarna afgekapt met …), sauna + plaats, datum via
  `formatDateRange`, `tijden` en `prijsIndicatie` als aanwezig.
- **Afsluiter**: houtgradient, "Alle opgietingen in Nederland en België op één plek",
  "Link in bio", "Sla op en deel met je saunamaatje".
- **Uitgelicht** is een event-slide als losse post.

Beelden alleen als JPEG, PNG, GIF of SVG: satori kan geen WebP/AVIF lezen; de HEAD-check
controleert het content-type en valt anders terug op de houtgradient.

Kleuren zijn de hexwaarden van de themetokens uit `globals.css` (satori kent geen
Tailwind); ze staan als constante in `src/lib/social-stijl.ts` met een verwijzing naar
de tokens.

### 4.5 Nieuw frontmatter-veld `gepubliceerdOp`

Optioneel, `YYYY-MM-DD`, op events. Gezet door `writeEventMdx` wanneer de status
`gepubliceerd` is (datum van de run); handmatig te vullen in Keystatic (`fields.date`,
beschrijving: "Vul in bij handmatig publiceren; voedt de rubriek Nieuw in de
agenda"). Loader leest het via `toISODate` en zet het op `OpgietEvent.gepubliceerdOp`.
Bestaande events krijgen geen backfill: de rubriek begint leeg en vult zich vanaf de
eerste run na uitrol. Vergeten in te vullen heeft als enige gevolg dat het event niet
in *Nieuw* verschijnt. `keystatic-schema.test.ts` dekt het veld automatisch.

### 4.6 Nieuw frontmatter-veld `instagram` op sauna-profielen

Optioneel handle zonder `@` (patroon `^[A-Za-z0-9._]{1,30}$`), op `content/saunas/*.mdx`
en in het Keystatic-saunaschema. Loader zet het op `Sauna.instagram`. Gebruik: `@handle`
in captions (§5.4) en toegevoegd aan `sameAs` van het `LocalBusiness`-schema op de
saunapagina (bijvangst voor SEO). Het hoort bij het profiel en niet in `bronnen.json`,
dat scraperconfiguratie is. Het vullen voor de 41 profielen is een aparte taak in het
plan: alleen handles die op de eigen website van de sauna staan (footer/socials-blok).

## 5. Planning en captions — `src/lib/social.ts`

Pure functies, geen I/O, testbaar met `node:test`. De routes en het script zijn dunne
schillen hieromheen.

### 5.1 Datumhelpers (in `src/lib/dates.ts`)

- `isoWeek(iso): string` → `2026-W37` (ISO 8601, maandag als weekstart).
- `weekendVanIsoWeek(week): { van, tot }` → vrijdag t/m zondag van die week.
- `volgendeWeekdag(iso, dag): string` → eerstvolgende datum met die weekdag, `iso` zelf
  als die al die weekdag is.
- `eersteVanMaandIn(iso, dagen): string | undefined` → de eerste dag van een maand
  binnen `[iso, iso+dagen]`, of niets.

### 5.2 Selectieregels

| Rubriek | Events | Slides | Plaatsingsdag | Post bestaat als |
|---|---|---|---|---|
| `weekend` | overlappen vr–zo van `isoWeek(datum)`: `startDatum ≤ zo` en `(eindDatum ?? startDatum) ≥ vr`; gesorteerd op `startDatum`, dan saunanaam | cover + max. 8 events + afsluiter (Instagram-limiet 10) | vrijdag van die week, of `datum` als die later valt | ≥ 1 event |
| `uitgelicht` | `startDatum` in `[datum+7, datum+28]`; prioriteit op type `opgietweekend`, `kampioenschap`, `thema`, `regulier`, daarbinnen op datum; drie kandidaten met `rang` 1–3, elk een eigen post `uitgelicht-<slug>` | 1 event-slide | eerstvolgende woensdag, `datum` zelf als dat een woensdag is | ≥ 1 kandidaat |
| `maand` | `startDatum` in de maand waarvan de eerste dag in `[datum, datum+6]` valt | cover + max. 8 events + afsluiter | die eerste dag | er valt een maandstart in het venster én ≥ 1 event |
| `nieuw` | `gepubliceerdOp` in `[datum-6, datum]` en `startDatum ≥ datum`; gesorteerd op `startDatum` | cover + max. 8 events + afsluiter | eerstvolgende maandag na `datum` (of `datum` zelf) | ≥ 1 event |

Bij meer dan acht events noemt de caption ze allemaal en zegt de cover het volledige
aantal. Vanuit vrijdag als referentie betekent dit: *Dit weekend* vandaag, *Nieuw*
maandag, *Uitgelicht* woensdag, *Deze maand* op de eerste. Vanuit maandag (de latere
Buffer-adapter) levert dezelfde functie het komende weekend en dezelfde weekdagen.

### 5.3 Planning-JSON (contract voor script én latere adapter)

```json
{
  "datum": "2026-09-11",
  "basis": "https://opgietingen.nl",
  "posts": [
    {
      "id": "weekend-2026-W37",
      "rubriek": "weekend",
      "rang": 1,
      "titel": "Dit weekend: 6 opgietingen",
      "plaatsingsdag": "2026-09-11",
      "events": [{ "slug": "…", "titel": "…", "sauna": "…", "plaats": "…", "startDatum": "…", "eindDatum": "…" }],
      "slides": [
        { "rol": "cover", "feed": "https://opgietingen.nl/social/weekend/2026-W37?formaat=feed", "story": "…?formaat=story" },
        { "rol": "event", "eventSlug": "…", "feed": "…", "story": "…" },
        { "rol": "afsluiter", "feed": "…", "story": "…" }
      ],
      "captions": { "instagram": "…", "facebook": "…", "tiktok": "…" }
    }
  ]
}
```

`id` is stabiel per week/event zodat een adapter dubbele aanmaak kan herkennen. `rang`
is 1, behalve bij de tweede en derde `uitgelicht`-kandidaat (2 en 3). `bouwPlanning(events, datum, basis)` levert dit object;
de route serialiseert het. De nieuw-post gebruikt de ISO-week (`nieuw-2026-W37`), niet
de referentiedatum, zodat een vrijdag- en maandagrun van dezelfde week hetzelfde id
krijgen.

### 5.4 Captions — `bouwCaption(post, kanaal)`

Opbouw: opening, eventregels, oproep, tags, hashtags. Regels:

- **Opening** per rubriek: drie varianten, gekozen op `weeknummer % 3`. Feitelijk,
  geen superlatieven. Voorbeeld weekend: "Dit weekend op de agenda: 6 opgietingen."
  (grammaticaal veilig bij 1 event, geen landenclaim) / "Zin in een opgieting dit
  weekend? Dit is er te doen." / "Weekendplanning: 6 opgietingen, van Groningen tot
  Limburg." (de provincies komen uit de events; bij één provincie vervalt dat deel).
- **Eventregel**: `📅 vr 11 sep · Opgietweekend Herfstgloed · Thermen Bussloo, Voorst`,
  bij Instagram gevolgd door `@handle` als `sauna.instagram` bekend is. Het
  kalender-emoji is het enige emoji in de caption. Meerdaagse events tonen het bereik
  ("vr 11 t/m zo 13 sep").
- **Oproep**: Instagram en TikTok "Volledige agenda via de link in bio."; Facebook de
  echte URL: weekend → `/opgietingen/dit-weekend`, maand → `/agenda/<maand-jaar>`,
  uitgelicht → `/event/<slug>`, nieuw → `/agenda`, elk met
  `utm_source=facebook&utm_medium=social&utm_campaign=<id>`.
- **Hashtags**: kern `#opgieting #opgietingen #aufguss #sauna #saunaliefhebbers
  #wellness`; per type erbij `#opgietweekend`, `#aufgusskampioenschap`,
  `#themaopgieting`; plus maximaal drie plaatsnamen (`#<slugify(plaats)>` zonder
  streepjes) van de events op de slides. Instagram: alles (max. 12). Facebook: alleen
  `#opgieting #aufguss #sauna`. TikTok: de eerste vijf van de kern.
- **Limieten**: Instagram 2.200 tekens, TikTok 4.000, Facebook onbeperkt in de
  praktijk. Past het niet, dan worden eventregels van achteren weggelaten en vervangen
  door "Nog N meer op opgietingen.nl", nooit de hashtags of oproep.
- **Streepjes**: `normalizeProseDashes` en `normalizeRangeDashes` verhuizen van
  `scripts/lib/content.ts` naar het bestaande `src/lib/text.ts` (met re-export in
  `scripts/lib/content.ts` zodat de scrapers ongewijzigd blijven) en worden op elke
  caption toegepast, per veld: prose op opening/titel/sauna/plaats, bereik op
  tijden/prijs. Geen em-streepjes in captions.

## 6. Lokaal script — `npm run social-kit`

`scripts/social-kit.ts`, pure helpers in `scripts/lib/social-kit.ts`.

Flags: `--datum YYYY-MM-DD` (default vandaag NL-tijd), `--basis <url>` (default
`https://opgietingen.nl`; `http://localhost:3000` voor lokaal testen), `--formaat
feed|story|beide` (default `beide`), `--map <pad>` (default `data/social`).

Werking: haalt `<basis>/social/planning?datum=…` op (altijd met
expliciete `datum`, ook bij de default); per post een map
`data/social/<datum>/<id>/` met per formaat een submap `feed/` en `story/` waarin de
slides staan als `01-cover.png`, `02-event-<slug>.png`, …, `10-afsluiter.png` (zo is een
hele carrousel in één keer te selecteren en in Buffer te slepen); een post met één slide
(*Uitgelicht*) krijgt geen submappen maar `01-event-<slug>-feed.png` en `-story.png` direct
in de postmap. Daarnaast een `captions.md` met
plaatsingsdag, slide-overzicht en de drie kanaalvarianten onder kopjes. Print een
samenvatting (rubriek, plaatsingsdag, aantal slides, aantal events). Exitcode 1 als de
planning of een beeld niet op te halen is; halve kits worden niet stilzwijgend
achtergelaten (de map van die post wordt dan verwijderd). `data/social/` komt in
`.gitignore`.

Vanuit Finder/VS Code: alle bestanden uit `feed/` selecteren en in Buffer slepen,
caption uit `captions.md` plakken, drie kanalen aanvinken, plaatsingsdag instellen.

## 7. Publiceerstap (contract; adapter buiten scope)

Alles wat publiceert is consument van de planning-JSON. Nu: het script uit §6
(download-adapter). Later, deelproject 2: `scripts/social-buffer.ts` maakt per post via
de Buffer-API een **concept** aan in de wachtrij van de drie kanalen (feed-slides als
media-URL's, caption per kanaal, `id` als markering tegen dubbele aanmaak), draait in
`scrape.yml` na de commit, en slaat zichzelf over zonder `BUFFER_API_KEY` en de drie
kanaal-id's, zoals het mailkanaal zonder `MAIL_IMAP_HOST`.

Startvoorwaarden voor deelproject 2: vier tot zes weken handmatig geplaatst, het format
bevalt, de accounts hebben hun eerste volgers.

Verificatiepunten (in het plan van dit deelproject al te checken met een gratis
Buffer-account, omdat de uitkomst de routes raakt):

1. Accepteert Buffer PNG voor Instagram-posts, of wil het JPEG? Zo ja JPEG: de routes
   krijgen `?type=jpeg` en zetten om via `sharp` (Next levert het mee).
2. Werken carrousels via de Buffer-API voor Instagram, Facebook én TikTok? Zo niet voor
   een kanaal: dat kanaal krijgt alleen de cover als losse post.

## 8. Strategiehoofdstuk (uitvoering door Nathaniel)

### 8.1 Account-checklist, eenmalig

- Instagram omzetten naar een professioneel account en koppelen aan de Facebook-pagina.
- Facebook-pagina: gebruikersnaam claimen, over-tekst, websitelink; daarna de URL in
  `socials` aanpassen.
- TikTok op een Business-account zetten (link in bio zonder volgersdrempel).
- Profielfoto van `/social/profiel`, Facebook-omslag van `/social/omslag`.
- Bio op alle drie: "Dé agenda voor opgietingen in Nederland en België. Nooit meer een
  Aufguss missen." + `opgietingen.nl/links?k=<kanaal>`.
- Buffer-account met de drie kanalen gekoppeld; de twee verificatiepunten uit §7
  afvinken.
- Drie sfeerbeelden genereren en in `public/images/social/` plaatsen.

### 8.2 Rol per platform

- **Instagram** is het hoofdkanaal: carrousels in de feed, dezelfde slides als
  stories, sauna's taggen. Handmatig: sauna's en opgietmeesters volgen en op hun posts
  reageren. Dat is de groeimotor: elke sauna die deelt bereikt precies ons publiek.
- **Facebook** spiegelt de posts. Extra: de weekendpost eens per week handmatig delen
  in de grote Nederlandse en Vlaamse saunagroepen, binnen hun regels.
- **TikTok** is een experiment in fotomodus met de story-slides. Na acht weken: door of
  stop.

### 8.3 Weekritme (± 30 minuten, vrijdag)

1. `npm run social-kit` draaien.
2. In Buffer inplannen: *Dit weekend* vandaag, *Nieuw* maandag, *Uitgelicht* woensdag
   (kies één van de drie kandidaten), *Deze maand* op de eerste als die in de week valt.
3. Weekend-slides als stories plaatsen op Instagram.
4. Weekendpost delen in één saunagroep op Facebook.

### 8.4 Meetplan en richtwaarden

UTM-conventie:

| Parameter | Waarden |
|---|---|
| `utm_source` | `instagram`, `facebook`, `tiktok`, `whatsapp`, `link`, `native`, `social` |
| `utm_medium` | `bio` (link-in-bio), `social` (caption-link), `deel` (deelknoppen) |
| `utm_campaign` | `links`, het post-`id` (`weekend-2026-W37`, …), `event-<slug>` |

`utm_campaign` is de kleingemaakte vorm van het post-id (`weekend-2026-w37`); een adapter
die id en campagne wil matchen vergelijkt hoofdletterongevoelig.

Maandelijks: Vercel Analytics op `utm_source` (bezoekers per kanaal), Buffer-inzichten
per post (bereik, saves, shares). Richtwaarden na drie maanden, bewust bescheiden:
200 volgers op Instagram, minstens drie sauna's die een post hebben gedeeld, en social
als zichtbare bron in de analytics. Na zes weken besluit over deelproject 2.

### 8.5 Contentregels

- Geen beelden die suggereren hoe een specifieke sauna eruitziet; eigen eventbeeld,
  echte saunafoto of logo.
- Captions feitelijk, zonder superlatieven; programma en tijden kunnen wijzigen, dus
  nooit "gegarandeerd".
- Posts linken alleen naar opgietingen.nl; geen reclamedisclosure nodig. Komen er
  gids- of merchposts (affiliate/eigen product), dan geldt de Reclamecode Social
  Media en hoort `#reclame` in de caption. Dat is buiten deze spec.

## 9. Tests en verificatie

- `scripts/lib/social.test.ts`: `isoWeek`/`weekendVanIsoWeek`/`volgendeWeekdag`/
  `eersteVanMaandIn` incl. jaargrens; selectie per rubriek (overlap meerdaagse events,
  slide-limiet 8, prioriteit uitgelicht, venster maand, `gepubliceerdOp`-venster);
  `bouwPlanning` levert stabiele id's, plaatsingsdagen conform §5.2, ≤ 10 slides,
  beide formaten, en laat lege rubrieken weg; `bouwCaption` per kanaal (geen links op
  Instagram/TikTok, UTM-link op Facebook, hashtagaantallen, `@handle` alleen bij bekend
  handle, tekenlimieten met afkapregel, geen em-streepjes).
- `scripts/lib/social-kit.test.ts`: bestandsnamen, `captions.md`-opbouw, opruimen bij
  een mislukte download (met een gemockte fetch).
- `scripts/lib/social-links.test.ts` en uitbreidingen, zie §3.5.
- `keystatic-schema.test.ts` blijft groen met de twee nieuwe velden.
- Handmatig: `npm run build`; alle routes openen in feed en story; één event met eigen
  beeld, één met alleen logo, één zonder logo; story-veiligheidszones; `/links?k=tiktok`
  toont UTM's; deelknop op mobiel; `npm run social-kit -- --basis http://localhost:3000`.
- Implementatie in een aparte git-worktree (conventie bij parallelle sessies).

## 10. Buiten scope

Buffer-adapter (deelproject 2), gids-/merchrubriek (optie C van het ritme), beheer-tab,
Meta Graph API, video/reels, eigen TikTok-API-koppeling, nieuwsbrief, Instagram-
highlights, backfill van `gepubliceerdOp`.

## 11. Risico's

- **Satori-beperkingen**: alleen flexbox, geen `grid`, geen `background-image` met
  `cover` op dezelfde manier als CSS; beelden gaan daarom als `<img>` met absolute
  positionering. Lange titels en lange saunanamen testen.
- **Rendertijd**: een carrousel is tien afzonderlijke renders; met gecachte fonts en
  beelden ≤ 400 KB blijft één render ruim onder een seconde. De edge-cache dekt
  herhaalde ophaalacties door Buffer.
- **Repetitie**: vier templates elke week kunnen eentonig ogen. Mitigatie: drie
  openingsvarianten, echte eventbeelden waar mogelijk, en het handmatige deel van §8.2.
  Meer variatie (rubriek C) pas als het ritme staat.
- **PNG versus JPEG** en **carrousels via Buffer**: verificatiepunten in §7 met een
  lokale oplossing klaar.
- **`gepubliceerdOp` vergeten** bij handmatig publiceren: *Nieuw* mist dan een event;
  geen ander gevolg.
