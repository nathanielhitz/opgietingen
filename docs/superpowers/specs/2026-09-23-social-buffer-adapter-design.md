# Buffer-adapter: social-posts automatisch inplannen — ontwerp

Datum: 2026-09-23. Status: ontwerp, goedgekeurd in de brainstorm van 2026-09-23.

Dit is deelproject 2 van het social-marketingtraject. Deelproject 1
([spec 2026-09-08](2026-09-08-social-fundament-en-kit-design.md)) bouwde de
planning-JSON, de slide-routes en de lokale `social-kit`; §7 daarvan beschreef
alleen het contract voor deze stap. Dit document vult dat in: een script dat de
weekplanning van de live site leest en elke post via de Buffer-API ingepland in
de wachtrij van Facebook, Instagram en TikTok zet, wekelijks vanuit GitHub Actions.

## 1. Aanleiding

Twee weken na de livegang van de kit merkt Nathaniel dat het handmatig
inplannen (vrijdag, half uur) niet volgehouden wordt. De startvoorwaarde uit de
vorige spec ("vier tot zes weken handmatig") vervalt daarmee bewust: het
alternatief voor automatisering is geen zorgvuldiger format, maar stilte op de
kanalen. De kit, de slides en de captions zijn al getest en live; deze stap voegt
alleen het plaatsen toe.

## 2. Beslissingen

| Vraag | Besluit | Waarom |
|---|---|---|
| Kanalen | Alle drie via Buffer; Instagram gaat mee zodra het in Buffer gekoppeld is | Eén adapter, één sleutel. Een kanaal dat ontbreekt wordt overgeslagen met een waarschuwing, niet met een fout. |
| Mate van automatisering | **Volledig ingepland**, geen goedkeuringsstap | Concepten die wekelijks goedgekeurd moeten worden lossen het bijhoud-probleem maar half op. De Buffer-wachtrij blijft de plek om vóór plaatsing iets te schrappen of aan te passen. `--concept` bestaat voor verificatie. |
| Run-moment | Eigen workflow `social.yml`, maandag 07:30 UTC | Anderhalf uur na de scrape (06:00 UTC) staan de nieuwe events live. Apart van `scrape.yml`: los herstartbaar, en een social-fout vervuilt het scraper-issue niet. |
| Dubbele posts voorkomen | Grootboek `data/social-buffer.json` in de repo | Buffer kent geen veld voor onze post-id; captions als sleutel zijn fragiel (ze veranderen mee met de agenda). Zelfde patroon als `data/scrape-runs.json`. |
| Kanaal-id's | Per run ontdekt via de `channels`-query op `service` | Nathaniel hoeft geen id's op te zoeken; één secret. Override per kanaal voor het geval een organisatie twee kanalen van dezelfde soort heeft. |
| Uitgelicht | Alleen kandidaat 1 | De planning levert drie kandidaten voor een handmatige keuze; de automaat neemt de hoogste prioriteit (opgietweekend > kampioenschap > thema > regulier). |
| TikTok | Story-slides (9:16) in fotomodus | Zoals §8.2 van de vorige spec: TikTok is een experiment in fotomodus; 4:5-slides zouden er met balken staan. |
| Instagram-stories | Buiten scope | Feedposts eerst; stories blijven een handmatige extra. |
| Alternatief Meta Pages-API | Afgewezen (herbevestigd) | Dekt TikTok niet, vergt een Meta-developer-app en tokenbeheer. Alleen relevant als Buffer bij de verificatie (§13) onverwacht faalt. |

## 3. Buffer-API: wat we gebruiken (gecheckt 2026-09-23)

- **Beschikbaarheid**: de GraphQL-API zit in elk plan, ook gratis. Gratis plan:
  één API-sleutel, 3.000 aanvragen per 30 dagen, maximaal 10 ingeplande posts
  per kanaal tegelijk. Wij doen per week 1 kanalen-query en hoogstens 4 posts
  per kanaal (Nieuw, Uitgelicht, Weekend, soms Maand), dus ruim binnen beide.
  Concepten (`saveToDraft`) tellen niet mee voor de wachtrijlimiet.
- **Endpoint**: `POST https://api.buffer.com`, header `Authorization: Bearer <sleutel>`,
  body `{ query, variables }`.
- **Kanalen**: `account { organizations { id name } }` en daarna
  `channels(input: { organizationId }) { id name service }`. `service` is
  `facebook`, `instagram` of `tiktok`.
- **Post aanmaken**: `createPost(input: CreatePostInput)` met
  `channelId`, `text`, `assets: [{ image: { url } }, …]` (geordend; publiek, direct,
  https, bereikbaar tot het plaatsmoment), `schedulingType: automatic`,
  `mode: customScheduled` + `dueAt` (ISO 8601 in UTC), `needsApproval: false`,
  optioneel `metadata` per kanaal en `saveToDraft: true` voor een concept.
  Antwoord is een union: `PostActionSuccess { post { id dueAt } }` of
  `MutationError { message }`.
- **Metadata**: `metadata.instagram { type, shouldShareToFeed }` met `type`
  `post` (of `carousel`; zie §13), `metadata.tiktok { title, type }` met `title`
  voor fotoposts. Facebook krijgt geen metadata.
- **Niet gedocumenteerd**, dus verificatiepunten (§13): of meerdere `assets` op
  Instagram, Facebook en TikTok een carrousel/fotopost opleveren, en of Buffer
  onze PNG-slides voor Instagram zelf naar JPEG omzet (de Instagram-API accepteert
  alleen JPEG).

## 4. Flow van `npm run social-buffer`

1. Zonder `BUFFER_API_KEY`: melding "Buffer-adapter overgeslagen", exitcode 0
   (zoals `scrape-mail` zonder `MAIL_IMAP_HOST`).
2. Haal `<basis>/social/planning?datum=<datum>` op (default: de maandag van de huidige week, NL-tijd,
   basis `https://opgietingen.nl`). Versheidscheck, zie §8.
3. Ontdek de kanalen (§9). Ontbrekende kanalen: waarschuwing, geen fout.
4. Lees het grootboek (§7), vóór de selectie: Uitgelicht slaat kandidaten over
   die eerder al geplaatst zijn.
5. Selecteer de posts (§5): rang 1, van Uitgelicht de eerste kandidaat die nog
   niet eerder is geplaatst; bereken per post het `dueAt`; laat posts met een
   verstreken plaatsingsdag weg met een melding. Combinaties post-id + kanaal die
   al in het grootboek staan worden overgeslagen ("al in Buffer").
6. Per post, per kanaal: bouw de `createPost`-input (§6), roep Buffer aan,
   schrijf bij succes direct een grootboekregel weg. Een fout stopt de andere
   posts niet.
7. Print een tabel (post, kanaal, dueAt NL-tijd, Buffer-id of fout) en schrijf
   dezelfde tabel naar `$GITHUB_STEP_SUMMARY` als die bestaat.
8. Exitcode 1 als er één of meer posts mislukten; 0 bij niets te doen.

Flags: `--datum YYYY-MM-DD`, `--basis <url>`, `--concept` (alles als concept in
Buffer, schrijft niets in het grootboek), `--dry-run` (toont de tabel met wat er
zou gebeuren, geen Buffer-aanroepen, schrijft niets), `--kanalen` (print alleen de
gekoppelde kanalen met id en service en stopt).
`--basis` is alleen zinvol samen met `--dry-run` of `--kanalen`: slide-URL's van een
lokale server kan Buffer niet ophalen.

## 5. Selectie en tijdstip

Referentiedatum is de maandag van de huidige week (`maandagVanWeek`, NL-tijd): de
cron draait op maandag, en een handmatige run later in de week houdt zo dezelfde
weekindeling. Een expliciete `--datum` die geen maandag is geeft in de modus
`inplannen` een waarschuwing, geen fout. `bouwPosts` levert dan precies de
komende week: *Nieuw* op die maandag, *Uitgelicht* woensdag, *Dit weekend*
vrijdag en *Deze maand* op de 1e als die in de zeven dagen valt. Van de drie
uitgelicht-kandidaten gaat er één de deur uit: de eerste op volgorde van rang die
nog niet eerder is geplaatst. `uitgelicht-<slug>` hangt aan het event, en hetzelfde
opgietweekend staat vaak twee à drie maandagen op rang 1; zonder deze regel viel
Uitgelicht vanaf de tweede week weg. Staat een kandidaat al in het grootboek met
een `dueAt` op dezelfde plaatsingsdag (NL-datum), dan is dat een herstart binnen de
week en blijft die kandidaat gekozen (de tabel toont "al in Buffer"). De overige
kandidaten krijgen de reden `kandidaat N` of `eerder al uitgelicht`.

Vaste plaatsingstijden in NL-tijd, één constante `PLAATSINGSTIJD` in
`scripts/lib/social-buffer.ts`:

| Rubriek | Tijd (Europe/Amsterdam) |
|---|---|
| `nieuw` | 17:00 |
| `uitgelicht` | 19:00 |
| `weekend` | 12:00 |
| `maand` | 10:00 |

Regels:

- `dueAt = nlTijdNaarUtc(post.plaatsingsdag, PLAATSINGSTIJD[post.rubriek])`.
  Nieuwe helper in `src/lib/dates.ts`: zet een NL-datum plus `HH:MM` om naar een
  UTC-ISO-string, zomer- en wintertijd via `Intl.DateTimeFormat` met
  `timeZone: "Europe/Amsterdam"` en `timeZoneName: "longOffset"` (geen
  tijdzonebibliotheek).
- Ligt `dueAt` op het moment van de run al in het verleden (late herstart), dan
  wordt het `nu + 15 minuten`, afgerond op de minuut. Buffer wil een toekomstig
  tijdstip.
- Ligt de **plaatsingsdag** vóór de run-dag (NL-datum), dan valt de post weg met de
  melding "plaatsingsdag verstreken". Dat kan alleen bij een handmatige run met
  een oude `--datum`.
- Bij `--concept` gaat de post zonder `dueAt` en met `mode: addToQueue` +
  `saveToDraft: true` naar Buffer: de docs noemen voor concepten alleen de
  wachtrijmodi. Een concept publiceert niet, dus het tijdstip doet er niet toe.

## 6. Mapping per kanaal

| Kanaal | Slides (`assets`) | Tekst | `metadata` |
|---|---|---|---|
| `facebook` | `slide.feed` van alle slides, in volgorde | `captions.facebook` | geen |
| `instagram` | `slide.feed` | `captions.instagram` | `instagram: { type: INSTAGRAM_TYPE, shouldShareToFeed: true }` |
| `tiktok` | `slide.story` | `captions.tiktok` | `tiktok: { title: tiktokTitel(post.titel), type: "post" }` |

`INSTAGRAM_TYPE` is een constante (`"post"`, eventueel `"carousel"` na §13).
`tiktokTitel` kapt af op 90 tekens op een woordgrens met "…" (TikTok-limiet voor
fototitels). De planning garandeert al ≤ 10 slides (Instagram-limiet), dus de
adapter knipt niet. Gemeenschappelijk: `schedulingType: "automatic"`,
`needsApproval: false`, en in de normale modus `mode: "customScheduled"` +
`dueAt`. De slide-URL's komen letterlijk uit de planning (basis = `site.url` in
productie), zodat Buffer ze bij aanmaken én plaatsen kan ophalen.

## 7. Grootboek `data/social-buffer.json`

```json
{
  "posts": [
    {
      "post": "weekend-2026-W40",
      "kanaal": "facebook",
      "bufferId": "68d2…",
      "dueAt": "2026-10-02T10:00:00.000Z",
      "aangemaakt": "2026-09-28T07:31:12Z",
      "run": "1234567890"
    }
  ]
}
```

- Sleutel voor dedup: `post` + `kanaal`. Bestaat de combinatie, dan wordt niets
  aangemaakt, ook niet als de caption inmiddels anders zou zijn.
- Alleen geslaagde `createPost`-aanroepen in de normale modus schrijven een regel;
  `--concept` en `--dry-run` schrijven niets. Concepten kunnen daardoor nooit een
  echte post blokkeren; wél moeten ze na verificatie in Buffer handmatig worden
  verwijderd (§13).
- `run` is `GITHUB_RUN_ID` of `"lokaal"`. Een lokale run in de normale modus
  moet het grootboek committen, anders maakt de workflow de posts opnieuw aan.
- Verwijdert Nathaniel een post in Buffer, dan blijft de regel staan en komt de
  post niet terug: dat was de bedoeling van het verwijderen.
- Het bestand groeit met ± 12 regels per week; opschonen is niet nodig in fase 1.
  Loader en typen komen in `src/lib/social-buffer-log.ts` (zoals
  `scrape-runs.ts`), zodat `/beheer` het later zonder verbouwing kan tonen.

## 8. Versheidscheck: veld `commit` in de planning

`/social/planning` krijgt een optioneel veld `commit: string | null` met
`process.env.VERCEL_GIT_COMMIT_SHA` (op Vercel beschikbaar; lokaal `null`). De
wijziging is achterwaarts compatibel; `social-kit` negeert het veld.

De adapter vergelijkt `commit` met `RUNNER_COMMIT` (de branch-tip die de workflow
uitcheckte, zie §10; zonder die variabele `GITHUB_SHA`). Wijken ze af, dan is de deploy
van de scrape-commit nog niet live: wacht en probeer elke 30 seconden opnieuw, tot
10 minuten. Daarna gaat de run met een waarschuwing door: een planning van vorige
week is beter dan geen posts. Is `commit` `null` (variabele niet beschikbaar) of
ontbreken `RUNNER_COMMIT` en `GITHUB_SHA` (lokaal), dan wordt de check overgeslagen met een melding.

## 9. Configuratie

| Variabele | Verplicht | Betekenis |
|---|---|---|
| `BUFFER_API_KEY` | ja (anders overslaan) | Persoonlijke API-sleutel, aan te maken in de Buffer-accountinstellingen (alleen de organisatie-eigenaar kan dat). |
| `BUFFER_KANAAL_FACEBOOK`, `BUFFER_KANAAL_INSTAGRAM`, `BUFFER_KANAAL_TIKTOK` | nee | Kanaal-id-override. Alleen nodig als de ontdekking twee kanalen van dezelfde `service` vindt; dan stopt de run met exitcode 1 en noemt de gevonden id's. |

Ontdekking: eerste organisatie van het account (meer dan één organisatie is een
fout met melding), daarna `channels` gefilterd op `service` ∈ {facebook,
instagram, tiktok}. Precies één per service → gebruiken; nul → kanaal overslaan
met waarschuwing; meer → fout tenzij de override gezet is. Lokaal via `.env`/export,
in CI als GitHub Actions secret; `.env.example` krijgt de vier regels.

## 10. Workflow `.github/workflows/social.yml`

```yaml
on:
  schedule:
    - cron: "30 7 * * 1"   # maandag 07:30 UTC, anderhalf uur na de scrape
  workflow_dispatch:
    inputs:
      datum:  { description: "Referentiedatum YYYY-MM-DD (leeg = maandag van de huidige week)", required: false }
      modus:
        description: "inplannen | concept | dry-run"
        required: false
        default: "inplannen"
        type: choice
        options: [inplannen, concept, dry-run]
permissions:
  contents: write
concurrency:
  group: push-naar-main      # dezelfde groep als scrape.yml
  cancel-in-progress: false
jobs:
  social:
    timeout-minutes: 30
```

`modus` is een keuzelijst, zodat een tikfout in de handmatige start niet kan; het
script weigert bovendien `--concept` samen met `--dry-run`. De job heeft
`timeout-minutes: 30` (de versheidscheck wacht hooguit 10 minuten). `social.yml`
en `scrape.yml` delen de concurrency-groep `push-naar-main`: er pusht maar één
workflow tegelijk naar `main`, zodat de grootboek-commit en de scrape-commit
elkaar niet laten falen.

Stappen: checkout op de branch-tip (`ref: ${{ github.ref }}`, niet `GITHUB_SHA`: bij
een Re-run of een run die in de concurrency-rij wachtte is `GITHUB_SHA` ouder dan de
laatste grootboek-commit) en die commit vastleggen als `RUNNER_COMMIT` voor de
versheidscheck, Node 22 met npm-cache, `npm ci`, `npm run social-buffer` met
de flags uit de inputs en `BUFFER_API_KEY` uit de secrets, daarna (alleen in de
modus `inplannen` en alleen vanaf `main`, ook als het script faalde: geslaagde
posts mogen niet verloren gaan) `data/social-buffer.json` committen als het
gewijzigd is, met dezelfde bot-identiteit als `scrape.yml` en een `git pull --rebase origin main` vóór de
push. Commitbericht: `chore(social): week <ISO-week>, <n> posts ingepland`. Een
gefaalde run levert GitHub's standaard-mail op; er komt geen apart issue.

## 11. Fouten

- Planning niet op te halen of ongeldige JSON: fout, exitcode 1, niets aangemaakt.
- Buffer-HTTP-fout of GraphQL-`errors`: leesbare fout met status en bericht.
- `MutationError.message` (bv. wachtrijlimiet, ongeldig kanaal): fout voor die
  post en dat kanaal; de rest gaat door.
- Timeout per aanvraag 20 seconden (zoals `social-kit`).
- Alle aanroepen gaan via één `bufferClient(fetch)` met injecteerbare fetch, zodat
  tests niets op het netwerk doen.

## 12. Bestanden

Nieuw:

- `scripts/social-buffer.ts`: flags, planning ophalen met versheidscheck
  (`haalPlanning`), kanalen ophalen (`haalKanalen`: de enige organisatie, dan
  `channels`) en bepalen (`bepaalKanalen`: overrides uit de omgeving, zonder
  sleutel bij een dry-run alle drie als "dry-run"), flow uit §4.
- `scripts/lib/buffer-client.ts`: `organisaties()`, `kanalen(orgId)`,
  `maakPost(input)`; GraphQL-strings als constanten; foutvertaling.
- `scripts/lib/social-buffer.ts`: pure functies `kiesPosts(planning, vandaag, nu, eerderGeplaatst)`,
  `dueAtVoor(post, nu)`, `bouwInput(post, kanaal, kanaalId, dueAt, opties)`,
  `tiktokTitel(titel)`, `ontdekKanalen(channels, overrides)`,
  `overridesUitEnv(env: Record<string, string | undefined>)`,
  `commitKomtOvereen(planningCommit, runnerCommit)`, `resultaatTabel(regels)`,
  en de beslisregel `besluit({ kanaalId, inGrootboek, modus })` met
  `type Modus = "inplannen" | "concept" | "dry-run"` (kanaal ontbreekt, al in
  Buffer, dry-run of maak; alleen de concept-modus negeert het grootboek).
- `src/lib/social-buffer-log.ts`: typen + `leesGrootboek(pad)`, `schrijfGrootboek`
  (atomair: tijdelijk bestand + hernoemen), `zoekRegel(grootboek, post, kanaal)`,
  `voegRegelToe(grootboek, regel)`, `eersteRegelVoorPost(grootboek, post)`.
- `src/lib/dates.ts`: `nlTijdNaarUtc(datum, tijd)`.
- `.github/workflows/social.yml`.
- Tests: `scripts/lib/social-buffer.test.ts`, `scripts/lib/buffer-client.test.ts`.

Aangepast:

- `src/lib/social-planning.ts` + `src/app/social/planning/route.ts`: veld `commit`.
- `package.json`: script `social-buffer`.
- `.github/workflows/scrape.yml`: concurrency-groep `push-naar-main` (gedeeld met `social.yml`).
- `.env.example`: Buffer-variabelen.
- `.gitignore`: niets nieuws; het grootboek wordt juist gecommit.
- `CLAUDE.md`: projectstructuur (script, workflow, `data/social-buffer.json`),
  paragraaf Social-kit (adapter, run-moment, grootboek, flags), commando's,
  env/secrets.
- Spec 2026-09-08 §7: één regel die naar dit document verwijst.

## 13. Uitrol en verificatie

Stappen voor Nathaniel, in volgorde:

1. In Buffer het Instagram-kanaal koppelen (professioneel account, gekoppeld aan
   de Facebook-pagina). Facebook en TikTok zijn al gekoppeld.
2. API-sleutel aanmaken in de Buffer-accountinstellingen; lokaal in `.env` zetten.
3. `npm run social-buffer -- --kanalen`: drie kanalen zichtbaar.
4. `npm run social-buffer -- --concept`: per kanaal een concept in Buffer. Checken:
   - **Facebook**: één post met alle slides als fotoreeks, caption compleet.
   - **TikTok**: fotopost met de story-slides en de titel.
   - **Instagram**: carrousel met alle slides; accepteert Buffer de PNG's? Zo niet:
     `INSTAGRAM_TYPE` op `carousel` proberen, en bij een formaatfout de
     slide-routes uitbreiden met `?type=jpeg` (omzetten via `sharp`, zoals de
     vorige spec §7 al voorzag) en de Instagram-mapping daarop zetten. Dat is dan
     een kleine vervolgtaak, geen herontwerp.
   Concepten daarna in Buffer verwijderen.
5. Secret `BUFFER_API_KEY` op GitHub zetten, PR mergen (rebase-merge, zoals de
   vorige PR's).
6. Eerste echte run handmatig via `workflow_dispatch` (modus `inplannen`) en de
   wachtrij in Buffer nakijken; daarna loopt het op de cron.
7. Herstarten na een faalmail: via Re-run of een dispatch, altijd op maandag of met
   `--datum` van die maandag.

Daarna is het weekritme uit de vorige spec (§8.3) teruggebracht tot: niets
verplicht. Optioneel blijven stories plaatsen en de weekendpost in een saunagroep
delen. `social-kit` blijft bestaan als handmatige terugvaloptie.

## 14. Tests

- `scripts/lib/social-buffer.test.ts` (`node:test`, zonder netwerk):
  `kiesPosts` neemt rang 1 (Uitgelicht: de eerste kandidaat die nog niet eerder
  is geplaatst, een herstart op dezelfde plaatsingsdag houdt de keuze) en laat
  verstreken plaatsingsdagen weg;
  `dueAtVoor` in zomertijd (CEST, +02:00) en wintertijd (CET, +01:00) en over de
  jaargrens; verstreken tijdstip wordt nu + 15 min; `bouwInput` per kanaal
  (feed vs. story, juiste caption, metadata alleen voor Instagram en TikTok,
  concept-modus zonder `dueAt`); `tiktokTitel` kapt op 90 tekens op een
  woordgrens; `ontdekKanalen` (nul, één, twee per service, override); grootboek
  lezen, schrijven en dedup.
- `scripts/lib/buffer-client.test.ts` met gemockte fetch: juiste headers en
  body, `PostActionSuccess` → id, `MutationError` → fout met bericht, HTTP 401 →
  fout met status, GraphQL-`errors` → fout.
- `src/lib/dates.ts`-test voor `nlTijdNaarUtc` (in `scripts/lib/dates-social.test.ts`, waar de andere social-datumhelpers al getest worden).
- Planningtests uitgebreid met het `commit`-veld (`null` zonder env).
- Handmatig: §13.

## 15. Buiten scope

Instagram-stories, delen in Facebook-groepen, een social-blok op `/beheer`,
Buffer-statistieken via de API, een eigen Meta- of TikTok-koppeling, het opschonen
van het grootboek, gids- of merchposts.

## 16. Risico's

- **API-wijzigingen bij Buffer**: de GraphQL-API is relatief nieuw. Onze kant is
  getest met gemockte antwoorden; een echte breuk levert een gefaalde run en een
  mail op, en de wachtrij in Buffer blijft leeg in plaats van fout gevuld.
- **Beeld en caption lopen uiteen**: Buffer haalt de slides op bij aanmaken en
  mogelijk opnieuw bij plaatsen; de caption is van maandag. Wordt een event tussen
  maandag en vrijdag verwijderd, dan kan de cover een ander aantal tonen dan de
  caption noemt. Zeldzaam en zichtbaar in de wachtrij; geaccepteerd.
- **Deploy later dan tien minuten**: dan gaat *Nieuw in de agenda* over de week
  ervoor of valt weg. De waarschuwing staat in de job-samenvatting.
- **Wachtrijlimiet gratis plan** (10 per kanaal): alleen te raken als handmatige
  posts de wachtrij vullen; de `MutationError` noemt het en de rest gaat door.
- **PNG op Instagram**: verificatiepunt met kant-en-klare terugvaloptie (§13).
- **Overlap met de scrape**: loopt `scrape.yml` langer dan anderhalf uur, dan
  wacht de social-run in de concurrency-rij `push-naar-main`. `GITHUB_SHA` is de
  commit van het moment waarop de run werd aangemaakt en is dan ouder dan de live
  deploy (die al de scrape-commit bevat). De versheidscheck ziet een afwijkende
  commit, wacht 10 minuten en gaat met een waarschuwing door op de verse
  planning. Onschadelijk, alleen traag. Komt er een derde run in de rij, dan
  annuleert GitHub de wachtende (per groep wacht er hooguit één).
