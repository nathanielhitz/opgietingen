# Ontwerp: eigen saunahoed (merch) naast affiliate

**Datum:** 2026-07-23
**Status:** goedgekeurd door Nathaniel (met aanpassing: startvoorraad 10–20 stuks)

## Doel en context

Opgietingen.nl verdient nu aan bol.com-affiliate (o.a. de gids *Beste saunahoed 2026*). Per conversie levert dat ~€1–3 op. Een eigen wolvilten saunahoed met opgietingen.nl-borduring levert ~€10–20 marge per verkoop op én bouwt het merk (elke hoed in een sauna is reclame). De eigen hoed komt **naast** de affiliate-gidsen, niet in de plaats ervan: hij wordt de aanrader bovenaan de bestaande gids, met de affiliate-alternatieven eronder. Zo kannibaliseert hij niets en is direct meetbaar of hij loopt.

## Gekozen aanpak (samenvatting van de keuzes)

| Keuze | Besluit |
|-------|---------|
| Fulfilment | Kleine eigen voorraad (10–20 stuks), borduren op ingekochte blanks, zelf versturen per brievenbuspakket |
| Checkout | Mollie-betaallink; geen eigen checkout, geen externe shop |
| Assortiment | Eén hoed, één kleur, one-size |
| Plek op de site | Eigen landingspagina `/saunahoed` + blok bovenaan de saunahoed-gids + link in header/footer |

Afgewogen alternatieven: volledige eigen checkout (orderopslag + webhooks — te zwaar voor fase 1), externe shop zoals Shopify/Etsy (platformkosten, merkbeleving verlaat de site), print-on-demand (echte wolvilten saunahoeden zitten niet in POD-catalogi).

## Content & datamodel

Nieuw contenttype **merch-product**, zelfde repo-based patroon als events en gidsen:

- Bestand: `content/merch/saunahoed.mdx`
- Frontmatter: `slug`, `naam`, `prijs` (in euro's, incl. BTW), `verzendkosten` (bedrag of `0` voor "incl. verzending"), `afbeeldingen[]`, `betaalUrl` (kant-en-klare Mollie-betaallink), `voorraadStatus` (`leverbaar` | `uitverkocht`), `bijgewerkt` (ISO-datum)
- MDX-body: het productverhaal (waarom een saunahoed bij een opgieting, materiaal, verzorging)

Loader: nieuwe functie(s) in de stijl van `src/lib/content.ts` (bijv. `getMerchProduct(slug)` / `getMerchProducten()`), zodat de databron later vervangbaar blijft. Voorraad wordt **handmatig** geschakeld via `voorraadStatus` in de frontmatter; er is geen teller.

## Productpagina `/saunahoed`

- Server component (App Router), route `src/app/saunahoed/page.tsx`, data uit de merch-loader.
- Inhoud: foto's, productverhaal, specs (100% wolvilt, one-size, borduring), prijs, verzendinfo, één bestelknop.
- Bestelknop linkt naar `/uit/merch/saunahoed` (zie hieronder), nooit rechtstreeks naar de betaallink — kliks moeten meetbaar zijn, conform de bestaande affiliate-conventie.
- Bij `voorraadStatus: uitverkocht`: geen bestelknop, in plaats daarvan een "tijdelijk uitverkocht"-melding.
- SEO: `generateMetadata`, JSON-LD `Product` structured data (naam, prijs, valuta, beschikbaarheid, afbeelding) via `src/lib/schema.ts`, opname in `sitemap.ts`.

## Redirect & klik-logging

Nieuwe route `src/app/uit/merch/[slug]/route.ts`, naar het patroon van `src/app/uit/product/[id]/route.ts`:

- Slaat de klik op via `src/lib/clicks.ts` (label/herkomst `merch-<slug>`).
- Redirect (302) naar de `betaalUrl` uit de frontmatter.
- Ontbreekt de `betaalUrl` of is het product uitverkocht → redirect terug naar `/saunahoed` (geen kapotte checkout).

Conversie is af te lezen door kliks in `data/clicks.log` te vergelijken met betalingen in het Mollie-dashboard.

## Vindbaarheid op de site

1. **Gids *Beste saunahoed 2026*:** blok "Onze eigen hoed" bovenaan, met foto, prijs en link naar `/saunahoed`. Duidelijk gelabeld als **eigen product** (geen affiliate-disclosure van toepassing op dit blok; de bestaande disclosure voor de bol.com-producten eronder blijft).
2. **Gids *Wat neem je mee naar een opgieting*:** vermelding met link bij het saunahoed-item.
3. **Header/footer:** link "Saunahoed" (exacte plek volgt het bestaande navigatiepatroon in `SiteHeader`).

## Bestelflow (operationeel, buiten de code)

- Klant klikt "Bestel" → Mollie-betaallink → betaalt (iDEAL/Bancontact voor NL+BE).
- Nathaniel ziet betaling + klantgegevens in het Mollie-dashboard en verstuurt zelf per brievenbuspakket.
- **Te verifiëren bij implementatie:** dat een Mollie-betaallink het **verzendadres** kan uitvragen. Zo niet, dan is de fallback een minimaal bestelformulier op `/saunahoed` dat per e-mail binnenkomt, met de betaallink in de bevestigingsmail. Deze fallback wordt alleen gebouwd als de verificatie negatief uitvalt.
- Prijsstelling, inkoop (10–20 blanks + borduren) en BTW/KOR-administratie zijn Nathaniels kant en vallen buiten de scope van de site.

## Foutafhandeling

- Ontbrekend of ongeldig merch-bestand → `/saunahoed` geeft 404 via `notFound()`.
- `betaalUrl` leeg of `voorraadStatus: uitverkocht` → geen bestelknop; de redirect-route stuurt terug naar de productpagina.
- Afbeeldingen ontbreken → pagina rendert zonder galerie (geen build-fout).

## Testen

- Unit-tests voor de merch-loader (`node:test` via `tsx`, zoals de kwaliteitspoort): parsen van frontmatter, `uitverkocht`-gedrag, ontbrekende velden.
- `npm run build` als verificatie vóór commit.
- Handmatig: uitverkocht-stand testen door `voorraadStatus` om te zetten; redirect testen met een dummy-`betaalUrl`.

## Buiten scope (bewust, YAGNI)

- Geen winkelwagen, geen orderopslag, geen Mollie-webhooks of API-integratie.
- Geen voorraadteller; alleen de handmatige leverbaar/uitverkocht-schakelaar.
- Geen meerdere kleuren, maten of producten; geen `/winkel`-overzicht.
- Geen kortingscodes of verzendopties.

Alles hierboven is uit te breiden zodra de eerste voorraad aantoonbaar verkoopt.
