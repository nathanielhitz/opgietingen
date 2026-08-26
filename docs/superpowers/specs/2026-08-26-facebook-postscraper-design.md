# Facebook-postscraper — ontwerp

*Datum: 2026-08-26 · Status: goedgekeurd in brainstormsessie*

## Probleem

Sauna's kondigen opgietweekenden regelmatig aan met een post op hun Facebook-pagina (flyer-afbeelding + tekst-caption), soms zonder dat diezelfde aankondiging ook op hun website verschijnt. Sinds het [Facebook-doorstuurkanaal](2026-08-02-facebook-doorstuurkanaal-design.md) is dat al deels ondervangen — maar alleen wanneer Nathaniel de post zelf toevallig tegenkomt én hem handmatig doorstuurt. Dat kost hem twee dingen: hij moet actief blijven checken (discovery) én per gevonden post kopiëren/mailen (handwerk). Voorbeeld: een opgietweekend-aankondiging van Thermen Binnenmaas die alleen als Facebook-post bestond.

De vorige spec had hiervoor bewust een "Fase B — volautomatisch" geschetst maar niet gebouwd, met als expliciet beslispunt: *pas overwegen wanneer de doorstuur-route in de praktijk laat zien dat er regelmatig FB-only events zijn én het doorsturen te veel handwerk wordt.* Dat punt is nu bereikt.

## Oplossing (kern)

Een nieuw, **gratis** scrape-kanaal naast het bestaande doorstuurkanaal (dat blijft gewoon bestaan, voor gevallen die dit kanaal niet dekt). Voor elke bron met een `facebook`-veld wordt periodiek `gallery-dl` (al aanwezig in de tooling, gebruikt door de `fb-fotos`-skill voor klantfoto's) gevraagd om de recente foto-posts van de pagina op te halen — zonder login, zonder API-key, zonder kosten. **Geverifieerd tegen de echte Thermen Binnenmaas-pagina:** `python3 -m gallery_dl -j --range 1-5 "https://www.facebook.com/ThermenBinnenmaas/photos"` levert per post de volledige caption-tekst en datum, inclusief de exacte opgietweekend-aankondiging uit het probleem hierboven.

De caption-tekst gaat vervolgens door precies dezelfde extractieroute die het nieuwsbriefkanaal al gebruikt (`extractEventsFromText`), en daarna door dezelfde kwaliteitspoort en dedup als de website-scraper. Geen nieuwe Claude-integratie, geen nieuwe opslagvorm — alleen een nieuwe, gratis fetch-laag.

**Bewust beperkt tot Facebook-posts.** Instagram (en Instagram Stories in het bijzonder) blijft buiten dit project: Stories verlopen na 24 uur, wat een veel hogere scrape-frequentie zou vereisen, en zijn ook met betaalde tools onbetrouwbaar te bereiken. Als losstaande, lagedrempelige aanvulling blijft doorsturen (nu ook als screenshot, zie "Buiten scope") de aangewezen route voor dat soort content.

## Componenten

### 1. `src/lib/facebook.ts` (nieuwe fetch-laag)

```ts
export async function fetchFacebookPosts(
  facebookUrl: string,
  ctx: { maxOuderdomDagen: number; range: string },
): Promise<{ posts: { caption: string; datum: string }[]; warnings: string[] }>
```

- Draait `python3 -m gallery_dl -j --range <range> "<facebookUrl>/photos"` als subprocess en parst de JSON-output. Default `range`: `1-15` (de 15 meest recente foto-posts) — ruim genoeg om een gemiste wekelijkse run te overbruggen, klein genoeg om de subprocess snel te houden.
- Elke post komt meerdere keren voor in de ruwe output (één keer per Message-type); dedupliceert op `caption + datum` en behoudt alleen items met een niet-lege `caption`. **Bijgesteld tijdens implementatie:** het oorspronkelijke plan dedupliceerde op het `id`-veld van de post-metadata, maar `/photos` itereert per fóto, niet per post — één post met meerdere foto's levert dan meerdere id's met identieke caption+datum op, en zou zo als meerdere "posts" doorstromen. `id` zit niet in het publieke `FacebookPost`-type, dus de omzetting naar een caption+datum-sleutel bleef intern aan `parseGalleryDlOutput`.
- Filtert posts met een publicatiedatum ouder dan `maxOuderdomDagen` (default ~60) eruit — een post van maanden terug kondigt vrijwel zeker geen toekomstig event meer aan, en dit scheelt onnodige Claude-calls.
- Faalt de subprocess (gallery-dl ontbreekt, pagina onbereikbaar/geblokkeerd, onverwachte output) dan wordt dat **niet** doorgegooid als crash: de functie geeft `{ posts: [], warnings: [...] }` terug zodat de aanroeper de bron overslaat en doorgaat met de volgende.
- Dit is de enige plek die weet hóe Facebook-posts worden opgehaald — zelfde ontwerpprincipe als `src/lib/scraper.ts` voor de website-route: vervangbaar zonder de rest van de pipeline te raken.

### 2. `scripts/scrape-facebook.ts` (nieuw script)

Structuur spiegelt `scrape-events.ts` (dezelfde publicatielogica) gecombineerd met `scrape-mail.ts` (dezelfde tekst-extractieroute):

1. Voor elke bron met een `facebook`-veld (ongeacht `status` — net als het mailkanaal is dit een onafhankelijk kanaal, geen vervanging van de website-route):
   - `fetchFacebookPosts` ophalen.
   - Overgebleven captions **samenvoegen tot één tekstblok** (met een scheiding per post) en in **één** `extractEventsFromText`-aanroep verwerken — niet per post. `extractEventsFromText` ondersteunt al meerdere events uit één tekstblok (zelfde route als een volledige agendapagina of een nieuwsbrief-mail met meerdere aankondigingen), dus dit bespaart API-calls zonder functionaliteit te verliezen.
2. Dedup: `dedupKey` (saunaSlug + startDatum) tegen bestaande events, plus de cross-sauna-check via `titelDatumKey`/`existingTitelDatumIndex` (zelfde bescherming tegen keten-sauna's die elkaars events aankondigen als bij de website-scraper).
3. Kwaliteitspoort: `evaluateEvent`, ongewijzigd.
4. **Publicatieregel — identiek aan de website-scraper** (bevestigd in de brainstormsessie: de `facebook`-URL komt uit onze eigen gecureerde `bronnen.json`, niet uit een spoofbare afzender, dus zelfde vertrouwen als de website-route):
   - Poort geslaagd + opgiet-trefwoord in de **titel** + geen cross-sauna-kopie + geen externe ticket-URL + `SCRAPE_AUTOPUBLISH=true` → `gepubliceerd`.
   - Anders → `concept`, met de blokkade(s) in `keurNotitie`.
5. `ticketUrl`: valt terug op `bron.website || bron.agendaUrl` (FB-captions bevatten zelden een directe ticketlink; komt er toch een linkachtige tekst in de caption, dan filtert de bestaande extractie/sanitatie die net als bij elke andere bron).
6. `--dry-run`: mockt `fetchFacebookPosts` (geen subprocess, geen netwerk) met vaste testcaptions, zelfde patroon als de andere scripts — dus test dezelfde blokkade-logica zonder gallery-dl of API-keys nodig te hebben.
7. Politeness: korte `sleep` tussen bronnen (bestaande `REQUEST_DELAY_MS`/`sleep`-helpers uit `scripts/lib/net.ts`).
8. Per-bron `try/catch`: een falende bron (layoutwijziging, blokkade, netwerkfout) levert een warning op (`scrape-warnings.json`, komt in het weekrapport) en de run gaat door met de volgende bron — nooit de hele workflow laten crashen.

### 3. Workflow-integratie (`.github/workflows/scrape.yml`)

Nieuwe stap **na** de website-scrape en **vóór** de mailstap:

```yaml
- name: Setup gallery-dl
  run: pip install gallery-dl

- name: Scrape Facebook-pagina's (poort → gepubliceerd/concept in content/events/)
  env:
    SCRAPE_AUTOPUBLISH: "true"
  run: npm run scrape-facebook
```

Geen nieuwe secrets nodig — geen login, geen API-key. Wel een nieuwe, niet-Node CI-dependency (`pip install gallery-dl`) op de runner; `ubuntu-latest` heeft Python al standaard aan boord.

### 4. Rollout: `facebook`-veld aanvullen

Los van de code: op dit moment heeft alleen Thermen Binnenmaas een `facebook`-veld. Als eenmalige actie (geen nieuw script) zoekt Nathaniel-assistent voor de overige actieve bronnen de Facebook-pagina op via websearch en legt de kandidaten per bron voor ter bevestiging, voordat ze in `bronnen.json` belanden. Dit gebeurt na goedkeuring van dit ontwerp, los van de implementatie van de scraper-code zelf.

## Randgevallen

| Geval | Gedrag |
|---|---|
| Post zonder afbeelding (zuiver tekst-only) | Wordt niet gezien — `gallery-dl` haalt alleen de foto-tab op. Geaccepteerde beperking; het doorstuurkanaal blijft de vangnet-route voor zulke posts. |
| `gallery-dl` niet geïnstalleerd (lokaal dev) | Duidelijke foutmelding, stap slaat zichzelf over — zelfde patroon als `MAIL_IMAP_HOST` ontbreekt bij `scrape-mail`. |
| Facebook-layoutwijziging breekt de extractor | Per-bron `try/catch` vangt dit af; warning in `scrape-warnings.json`, overige bronnen gaan door. |
| Pagina tijdelijk geblokkeerd/traag | Zelfde afhandeling als hierboven: warning, door naar de volgende bron. `sleep` tussen bronnen beperkt het risico. |
| Event stond al via het doorstuurkanaal of de website-scraper | Bestaande dedup (`saunaSlug + startDatum`) en cross-sauna-index vangen het af — geen dubbele MDX. |
| Post ouder dan `maxOuderdomDagen` | Overgeslagen vóór extractie (geen Claude-call). |
| Caption zonder concrete datum (bv. sfeerpost) | Levert gewoon geen event op — `extractEventsFromText` extraheert alleen events met een concrete kalenderdatum, ongewijzigd gedrag. |

## Tests

- **Unit `fetchFacebookPosts`-parsing:** mock gallery-dl-stdout (JSON) → correcte `{caption, datum}`-lijst, dedup op post-id, leeftijdsfilter.
- **Dry-run:** `npm run scrape-facebook -- --dry-run` met mock-bronnen (facebook-veld) en vaste mock-captions, zonder subprocess/netwerk — dekt dezelfde blokkade-logica als `scrape-events.ts` (autopublish-regels, cross-sauna-kopie, externe ticket-URL).
- Bestaande tests (`npm run test`) blijven groen.

## Documentatie

- CLAUDE.md: nieuwe sectie "Facebook-postscraper" onder de content-scraper-pipeline (fetch-laag, publicatieregel, gallery-dl als CI-dependency, bekende beperkingen), plus vermelding in de commando-tabel (`npm run scrape-facebook`).
- `bronnen.json` `$comment`/schema-documentatie: geen wijziging nodig, het `facebook`-veld bestaat al.
- `.github/workflows/scrape.yml`: nieuwe stap met comment, zoals de andere stappen.

## Buiten scope

- **Instagram** (posts én stories) — expliciet uitgesloten in deze sessie; stories vereisen een veel hogere scrape-frequentie en zijn onbetrouwbaar te bereiken, ook met betaalde tools.
- **Betaalde scraping-dienst** (Apify e.d.) — niet nodig, de gratis `gallery-dl`-route werkt aantoonbaar.
- **Tekst-only Facebook-posts zonder afbeelding** — blijft de taak van het bestaande doorstuurkanaal.
- **Vision-extractie van poster-afbeeldingen** (bv. rechtstreeks een screenshot mailen zonder caption-tekst) — apart onderwerp, niet meegenomen in dit project.
- **Nieuw `vind-facebook-paginas`-script** — de eenmalige aanvulling van bronnen.json gebeurt nu handmatig/eenmalig; een herbruikbaar discovery-script (zoals `vind-roosters`) is bewust niet gebouwd, kan later alsnog als daar behoefte aan blijkt.
