# Keystatic-beheerpaneel — ontwerp

**Datum:** 2026-08-29
**Status:** ontwerp goedgekeurd, wacht op implementatieplan
**Deelproject 1 van 3** in het traject "beheer & inzicht" (zie §8).

## 1. Aanleiding

Wekelijks zet de scraper 10–20 events als `concept` in `content/events/`. Beoordelen betekent nu: bestand openen in een editor, `status` aanpassen, committen, pushen. Dat is het meest repetitieve handwerk in het project. Daarnaast worden `content/bronnen.json` en sauna-profielen regelmatig handmatig gecorrigeerd.

Doel: die bewerkingen in de browser doen — ook vanaf een telefoon — zonder de repo-based architectuur (MDX in git, statische build, SEO-machine) los te laten.

## 2. Beslissingen en verworpen alternatieven

| Keuze | Besluit | Verworpen |
|---|---|---|
| Bron van waarheid | **Hybride**: git blijft de bron; het paneel schrijft commits | Volledige migratie naar Supabase (2–3 weken infra zonder verkeers- of omzetwinst; fase 2 in CLAUDE.md). Supabase als tussenlaag voor scraper-output (twee opslagplekken voor events). |
| Paneel | **Keystatic** (`@keystatic/core` 0.6.x, `@keystatic/next` 5.x; peer deps dekken Next 15 / React 19) | Filament (Laravel/PHP: tweede codebase, geen Vercel, vereist DB). Payload (vereist DB → volledige migratie). TinaCMS (eigen GraphQL-laag + cloud-auth, zwaarder). Zelf bouwen (formulieren/validatie/commit-logica die Keystatic al heeft). |
| Reviewflow | **Per event in het Keystatic-formulier** | Eigen review-pagina met bulk-knoppen (maatwerk; pas overwegen na een paar weken gebruik). |
| Plaatsing | **Live site, `opgietingen.nl/keystatic`, GitHub-mode** | Alleen lokaal (geen review vanaf ander apparaat, committen blijft handwerk). Aparte Vercel-deploy (dubbele configuratie). |

Supabase krijgt in dit traject een rol voor **runtime-data** (affiliate-kliks, deelproject 3), niet voor content.

## 3. Architectuur

### Packages
`@keystatic/core`, `@keystatic/next`. Geen database.

### Bestanden
- `keystatic.config.ts` (repo-root) — storage `github` (`nathanielhitz/opgietingen`, branch `main`); valt terug op `local` wanneer `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` ontbreekt (de config wordt ook in de browser gebundeld, dus de schakelaar moet `NEXT_PUBLIC_` zijn), zodat `npm run dev` zonder GitHub App werkt; in productie zonder die variabele geven paneel en API 404 (`src/lib/beheer.ts`), omdat local-mode onbeveiligd is.
- `src/app/keystatic/[[...params]]/page.tsx` + `layout.tsx` — het paneel (Keystatic's eigen UI; client component; buiten ons Tailwind-thema).
- `src/app/api/keystatic/[...params]/route.ts` — Keystatic's API-handler (GitHub OAuth-callback + bestandsoperaties).

### Schrijfpad
Save in het paneel = één commit op `main` onder het GitHub-account van de ingelogde gebruiker → Vercel deployt → wijziging live. Dezelfde mechaniek als de scraper-bot; geen nieuwe deploy-route.

### Grenzen
- `src/lib/content.ts` verandert niet; de site leest MDX zoals nu.
- De scraper blijft MDX schrijven via `writeEventMdx`.
- Keystatic is uitsluitend een derde schrijver op dezelfde bestanden.

### SEO-hygiëne
- `robots.ts`: `disallow: ["/uit/", "/keystatic", "/api/keystatic"]`.
- Sitemap bevat deze routes niet (genereert alleen uit content; wordt met een test vastgelegd).
- Keystatic-layout exporteert `metadata.robots = { index: false, follow: false }`.

### Buiten scope
Bulk-acties, eigen review-UI, beeld-uploads, run-metrics (deelproject 2), klik-logging (deelproject 3), een `status: afgewezen`.

## 4. Collecties en schema's

Alle schema's zijn 1-op-1 op de bestaande frontmatter, zodat site en scripts niets merken. Select-lijsten (`type`, `status`, `provincie`, `land`) importeren uit `src/lib/site.ts` — één bron van waarheid.

### Events — `content/events/*.mdx` (slug = bestandsnaam)
| Veld | Type | Opmerking |
|---|---|---|
| `titel` | tekst | verplicht |
| `saunaSlug` | **relatie** → sauna-collectie | dropdown met sauna-namen; vangt typo's (event onzichtbaar) bij de bron |
| `type` | select | `EVENT_TYPES` |
| `startDatum` | datum | verplicht |
| `eindDatum` | datum | optioneel |
| `tijden`, `prijsIndicatie` | tekst | |
| `ticketUrl` | url | klikbaar in het formulier |
| `afbeelding` | tekst (pad) | geen upload; beelden via `public/images/` + `docs/image-prompts.md` |
| `status` | select | concept / gepubliceerd / afgelopen |
| `bron` | select, alleen-lezen weergave | scraper / handmatig |
| `keurNotitie` | meerregelig, **alleen-lezen** | reden van de kwaliteitspoort blijft als historie staan; de site negeert het veld bij `gepubliceerd` |
| body | `fields.mdx` | beschrijving/programma |

Lijstweergave: kolommen titel, sauna, startDatum, status; gesorteerd op startDatum. Keystatic filtert niet op veldwaarde; de review-ingang is sorteren op status of zoeken op "concept". Wat de lijst precies aankan wordt in de implementatie vastgesteld; zoeken is het minimum.

### Sauna's — `content/saunas/*.mdx`
Alle 18 velden: `naam`, `land` (select NL/BE), `provincie` (select `PROVINCES`), `plaats`, `adres`, `lat`/`lng` (number), `faciliteiten` (array tekst), `website`, `affiliateUrl` (url), `sponsored` (checkbox), `afbeelding`, `logo` (tekst-pad), `logoAchtergrond` (select licht/donker), `opgietRooster` (array van `{dag, tijden}`), `roosterGecheckt` (datum), `roosterBron` (url). Body: `fields.mdx`.

### Gidsen — `content/gidsen/*.mdx`
`titel`, `samenvatting`, `afbeelding`, `bijgewerkt` (datum), `eigenProduct` (checkbox), `producten` (array van `{id, naam, bolUrl, afbeelding, prijsIndicatie, beschrijving}`). Body: `fields.mdx` met `Product` en `ProductGrid` als gedeclareerde componenten (anders weigert de editor ze). Zie §5 voor de round-trip-voorwaarde.

### Bronnen — `content/bronnen.json` (singleton)
Eén array-veld `bronnen` van objecten: `id`, `naam`, `land`, `provincie`, `website`, `agendaUrl`, `facebook`, `type` (select website/handmatig/nieuwsbrief), `status` (select: actief, geen-agenda, handmatig, aanvullen, opzetten, kapot, te-verifieren), `matchToken`, `agendaUrlVast` (checkbox), `notities`, `laatstGecontroleerd` (alleen-lezen; beheerd door `verify-bronnen`). Item-label = `naam`. `readBronnen()` in de scripts verandert niet.

### Bewuste keuzes
1. **Geen beeld-uploads** — dat zou een tweede beeldroute naast de bestaande prompt-workflow zijn.
2. **`saunaSlug` als relatie**, niet als vrije tekst.
3. **`keurNotitie` alleen-lezen** — mag niet per ongeluk weggetypt worden.

## 5. Samenleven met de scraper

Drie schrijvers op dezelfde bestanden: scraper-bot (CI), Keystatic (paneel), lokale editor.

**Frontmatter-stijl.** Keystatic schrijft frontmatter in eigen volgorde/YAML-stijl terug. De eerste save op een bestaand bestand geeft een cosmetische diff; `gray-matter` leest beide. Geen normalisatie vooraf.

**Body-round-trip.** `fields.mdx` parseert en serialiseert de body; markdown kan genormaliseerd worden. Events en sauna's (eenvoudig proza, kopjes) zijn veilig. Gidsen (lange bodies, `<Product>`/`<ProductGrid>`, mogelijk tabellen) zijn het risico. **Go/no-go op bewijs:** voor elke gids een dry round-trip (Keystatic reader → writer → `git diff`) vóór livegang. Komt één gids niet schoon terug, dan blijven gidsen buiten het paneel (ze wijzigen zelden); de andere drie collecties gaan wél live.

**Gelijktijdige commits.** Maandag 06:00 UTC pusht de bot. Een save op datzelfde moment faalt met non-fast-forward; Keystatic toont een fout en de gebruiker saved opnieuw. Faalt de bot-push, dan is de run rood en zichtbaar. Geen extra mechaniek.

**Verwijderen van concepts — gebruiksregel.** Dedup werkt op `saunaSlug + startDatum`. Een verwijderd concept wordt de volgende run opnieuw aangemaakt. Daarom: *afwijzen = status op `concept` laten of op `afgelopen` zetten; niet verwijderen.* Een expliciete `status: afgewezen` zou loader, poort en rapport raken en is een mogelijke follow-up.

**Uitkomst round-trip (2026-08-29):** in local-mode via de UI getest — **go voor alle vier de ingangen, gidsen inbegrepen**: alle tien gidsen openen, saven en houden elke `<Product id="…" />` en `<ProductGrid />` op dezelfde plek met dezelfde id, met identieke kopjes, links, vet en lijstitems; ook het event (`slug`, `keurNotitie`, `bron: scraper` behouden), de sauna en `content/bronnen.json` (44 bronnen, `$comment` en `laatstBijgewerkt` intact) komen inhoudelijk ongeschonden terug, en een tweede save wijzigt alleen de bewerkte regel. De verschillen zijn cosmetisch: frontmatter wordt herordend (slugveld eerst) en opnieuw gequote/gevouwen, de witregel na de frontmatter verdwijnt, body-lijsten worden `*` in plaats van `-`, lege optionele velden verschijnen als default (`producten: []`, `agendaUrlVast: false`) of verdwijnen als ze leeg waren (`agendaUrl: ""`), en een kale URL in de body wordt geautolinkt (`www.svb.be` → `[www.svb.be](http://www.svb.be)`).

## 6. Toegang en configuratie

**GitHub App (eenmalig):** aanmaken via Keystatic's setup-flow (`/keystatic/setup` in local-mode), met callback-URL's voor `https://opgietingen.nl/api/keystatic/github/oauth/callback` en de Vercel-preview-variant. Installatie alleen op deze repo, permissie *Contents: read/write*.

| Env-var | Waar |
|---|---|
| `KEYSTATIC_GITHUB_CLIENT_ID` | Vercel (production + preview), `.env` lokaal |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | Vercel secret, `.env` lokaal |
| `KEYSTATIC_SECRET` | Vercel secret (sessie-signing, random), `.env` lokaal |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | Vercel, `.env` lokaal |

Ontbreekt `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` → `local`-storage in development; in productie → 404 (local-mode is onbeveiligd). Alle vier tegelijk zetten: alleen de slug zonder de andere drie laat de API-handler bij het laden falen.

**Autorisatie:** inloggen via GitHub; toegang vereist schrijfrecht op `nathanielhitz/opgietingen`. Geen aparte gebruikerslijst. Iemand toelaten = collaborator-toegang op de repo.

## 7. Verificatie en documentatie

1. **Schema-dekkingstest** (unit): leest alle frontmatter-keys uit `content/**` en `bronnen.json` en vergelijkt met de schema-velden — geen veld mag stil verdwijnen bij een save.
2. **Round-trip-test** per collectie (§5): reader → writer → lege diff; gidsen als go/no-go.
3. `npm run build` slaagt; `/keystatic` rendert in local-mode; `/api/keystatic` bestaat; robots-test dekt de nieuwe disallows; sitemap-test bevestigt dat de routes ontbreken.
4. **Acceptatie na deploy** (definition of done): inloggen; één bestaand concept op `gepubliceerd` zetten → commit op `main` zichtbaar → event op de live agenda na deploy; daarna één sauna-veld en één bron-status wijzigen.

**Documentatie:** CLAUDE.md krijgt een sectie *Beheer (Keystatic)* met de gebruiksregel uit §5, de env-vars en de local-fallback. `.env.example` (indien aanwezig) krijgt de vier vars.

## 8. Vervolg (aparte specs)

- **Deelproject 2 — Beheer-dashboard `/beheer`:** scrape-run-metrics per run × kanaal (website/facebook/mail) × bron (kandidaten, dedup, verleden, afgekeurd, concept, gepubliceerd, fout, methode) in `data/scrape-runs.json`; drie scrapers melden tellers via `scripts/lib/metrics.ts` (append-patroon als `warnings.ts`); workflow commit ook bij 0 nieuwe events; backfill uit git-historie; noindex-pagina met trend en per-bron-tabel; loader `src/lib/scrape-runs.ts` zodat de binnenkant later vervangbaar is.
- **Deelproject 3 — Kliks naar Supabase:** tabel `kliks`; `logClick` schrijft fire-and-forget; dashboard toont top-events/sauna's/producten.
