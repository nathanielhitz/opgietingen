# Facebook-doorstuurkanaal — ontwerp

*Datum: 2026-08-02 · Status: goedgekeurd in brainstormsessie*

## Probleem

Sauna's kondigen opgietweekenden vaak (eerst of alleen) aan op hun Facebook-pagina. De website-scraper ziet die aankondigingen niet, en Facebook is niet direct scrapebaar: login-walls, bot-detectie en robots.txt blokkeren zowel de kale fetch als Firecrawl. Geverifieerd op een publieke post van Thermen Binnenmaas: een anonieme fetch levert een lege foutpagina op (geen og-tags, geen posttekst). Server-side verrijking van een postlink is dus geen optie.

## Oplossing (kern)

Geen nieuw kanaal, maar een **tweede matching-route in het bestaande nieuwsbrief-mailkanaal** (`scrape-mail`). Nathaniel ziet een FB-post op zijn telefoon, kopieert de posttekst, plakt die samen met de paginalink in een mail naar `events@opgietingen.nl`. De bestaande keten (Claude-extractie → dedup → kwaliteitspoort → MDX-concept) doet de rest. De enige nieuwe logica is: mails van een vertrouwde afzender aan de juiste sauna koppelen op basis van de **mailinhoud** in plaats van de afzender.

Bewust semi-automatisch en gratis: volautomatisch FB-scrapen kan alleen via betaalde diensten in ToS-grijs gebied (zie fase B) en is uitgesteld tot bewezen is dat er regelmatig FB-only events zijn. **Besluit 2026-08-02: geen betaalde actors (Apify e.d.) opzetten; fase B blijft puur op papier.**

## Componenten

### 1. `facebook`-veld in `content/bronnen.json`

Nieuw optioneel veld per bron: de URL van de Facebook-pagina van de sauna.

```json
"facebook": "https://www.facebook.com/ThermenBinnenmaas"
```

- Bij oplevering ingevuld voor sauna's waarvan de pagina bekend is (Thermen Binnenmaas als eerste); de rest gaandeweg.
- Dient in fase A als matching-anker en is in een eventuele fase B meteen de bronnenlijst.

### 2. Vertrouwde doorstuurders (`MAIL_VERTROUWDE_AFZENDERS`)

Nieuwe env-var: kommagescheiden lijst van e-mailadressen (lowercase-vergelijking op het volledige adres). Lokaal via `.env`, in CI als GitHub Actions secret — geen persoonlijke adressen hardcoded in de repo. Alleen voor mails van deze afzenders wordt de content-match geprobeerd.

De trusted-status bepaalt uitsluitend de **sauna-koppeling**, nooit de publicatiestatus. Een From-header is spoofbaar; omdat mail-events altijd `concept` blijven, kan een spoof hooguit een onzichtbaar concept aanmaken — hetzelfde risico dat het mail-kanaal nu al accepteert voor herkende nieuwsbrief-afzenders.

### 3. `matchBronByContent(bronnen, tekst)` in `scripts/lib/content.ts`

Nieuwe matcher naast `matchBronBySender`:

1. **Facebook-match:** zoek per bron mét `facebook`-veld of de genormaliseerde pagina-identiteit in de mailtekst voorkomt. Normalisatie: lowercase, `www.`/`m.facebook.com` → `facebook.com`, trailing slash weg; matching op het padsegment (paginanaam) zodat zowel `facebook.com/ThermenBinnenmaas` als een volledige post-URL (`…/ThermenBinnenmaas/posts/…`) matcht.
2. **Domein-fallback:** komt het website-domein van precies één bron in de tekst voor, dan die bron (zelfde host-normalisatie en platform-host-uitsluiting als `matchBronBySender`).
3. **Uniek of niets:** levert een stap twee of meer kandidaten op, dan `undefined`. Bij twijfel niet gokken.

### 4. Flow-aanpassing in `scripts/scrape-mail.ts`

```
afzender-match (bestaand)
  └─ geen match én afzender ∈ MAIL_VERTROUWDE_AFZENDERS
       └─ matchBronByContent(bronnen, mailinhoud)
            ├─ match  → verwerk als gewone nieuwsbrief-mail (extractie → dedup → poort → concept)
            └─ geen   → bestaand vangnet: concept met afzender-domein in keurNotitie
```

Alles stroomafwaarts is ongewijzigd, inclusief:

- **Nooit auto-publiceren** voor mail-events (bestaande regel blijft gelden).
- **`veiligeTicketUrl`**: een facebook.com-link wordt nooit ticket-URL; de CTA valt terug op de sauna-website.
- **`\Seen` pas na succesvolle verwerking** en dedup op `saunaSlug + startDatum` als tweede vangnet.

## Workflow (telefoon)

1. FB-post van een sauna zien → posttekst selecteren en kopiëren.
2. Delen → e-mail (of nieuwe mail): posttekst plakken + link naar de post of pagina erbij.
3. Versturen naar `events@opgietingen.nl`. De maandag-cron verwerkt hem; tussendoor kan `npm run scrape-mail` handmatig.

**Regel: altijd de posttekst meeplakken.** De link is voor de matching, de tekst voor de extractie.

## Randgevallen

| Geval | Gedrag |
|---|---|
| Mail met alleen een link, geen posttekst | Extractie vindt 0 events → mail wordt gelezen gemarkeerd en gelogd; er verschijnt niets. Geaccepteerde beperking (verrijking is technisch onmogelijk, zie Probleem); ontbreekt een event, dan opnieuw sturen mét tekst. |
| Ambigue content-match (0 of ≥2 kandidaten) | Geen koppeling → bestaand vangnet: concept met `keurNotitie` voor handmatige toewijzing. |
| URL-varianten (`m.facebook.com`, hoofdletters, trailing slash, post- vs. pagina-URL) | Gedekt door de normalisatie in `matchBronByContent`. |
| Event stond ook op de sauna-website | Bestaande dedup (`saunaSlug + startDatum`) en cross-sauna-index vangen het af. |
| FB-datums zonder jaartal ("za 14 februari") | Bestaand mechanisme: extractie krijgt de verwerkingsdatum als context; de kwaliteitspoort keurt verleden/ongeldige datums af. |

## Tests

- **Unit-tests `matchBronByContent`:** facebook-URL-varianten (pagina-URL, post-URL, m.facebook.com, hoofdletters), website-domein-fallback, ambigu → `undefined`, bron zonder `facebook`-veld.
- **Flow-test:** trusted-afzender-conditie (niet-vertrouwde onbekende afzender blijft het bestaande vangnet volgen).
- **Dry-run:** mock-inbox in `scrape-mail.ts` krijgt een derde mail — doorgestuurde FB-post van een vertrouwde mock-afzender — die via content-match aan een sauna koppelt. `npm run scrape-mail -- --dry-run` blijft zonder keys draaien.
- Bestaande tests (`npm run test`) blijven groen.

## Documentatie

- CLAUDE.md: nieuwsbrief-sectie uitbreiden met de doorstuur-route (`MAIL_VERTROUWDE_AFZENDERS`, `facebook`-veld, content-match) + de telefoon-workflow.
- `bronnen.json` `$comment` bijwerken met het nieuwe veld.

## Fase B — volautomatisch (alleen schets, niet bouwen)

Een apart script `scrape-fb` dat via een betaalde scraping-dienst (bv. een Apify-actor) wekelijks de recente posts ophaalt van alle bronnen mét `facebook`-veld en door exact dezelfde keten duwt (`extractEventsFromText` → dedup → poort → altijd `concept`). Achter een env-token: geen token = stap slaat zichzelf over, zoals `scrape-mail` zonder IMAP. Indicatieve kosten €5–20/maand; ToS-grijs gebied en breekbaar.

**Beslispunt:** pas overwegen wanneer de doorstuur-route in de praktijk laat zien dat er regelmatig FB-only events zijn én het doorsturen te veel handwerk wordt. Tot die tijd wordt hier niets voor gebouwd of afgesloten.

## Buiten scope

- Community-groepen (Aufguss WM Community): login-wall + ToS, blijft `handmatig`.
- Instagram: niet gevraagd; posts zijn doorgaans dezelfde als op Facebook.
- Vision-extractie van poster-afbeeldingen: de betrokken sauna's kondigen vooral in tekst aan.
- Automatisch publiceren van mail-events: veiligheidsregel blijft staan.
