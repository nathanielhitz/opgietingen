# Ontwerp — audit en polish-pass Opgietingen.nl

**Datum:** 11 juli 2026  
**Status:** goedgekeurde richting; implementatie volgt na review van deze specificatie

## Doel

Voer een evolutionaire audit en polish-pass uit die bezoekers sneller laat bepalen welke opgietingen relevant zijn. Behoud de warme fotografie, serif-typografie, aardetinten, bestaande routes, MDX-contentbron en affiliateflow. Los eerst functionele, data-, mobiele en toegankelijkheidsproblemen op; pas daarna visuele details aan.

## Vastgestelde uitgangssituatie

- Next.js 15 App Router, React 19, TypeScript strict en Tailwind CSS 4.
- Content komt uit MDX-frontmatter en wordt server-side geladen; er is geen database.
- De agenda gebruikt URL-queryparameters voor land, provincie, type en datumbereik.
- De live homepage communiceert de propositie helder, maar de hero en grote fotokaarten stellen de scanbare agenda-informatie uit.
- De mobiele typefilters scrollen horizontaal zonder duidelijke affordance.
- Resultaten tonen datum, titel, sauna en plaats, maar tijden ontbreken in het overzicht.
- Vrij zoeken, afzonderlijk verwijderbare actieve filters en een volledig mobiel menu ontbreken.
- De datumhelper gebruikt UTC voor “vandaag”, wat rond middernacht kan afwijken van Europe/Amsterdam.
- De Event-JSON-LD doet claims over beschikbaarheid en organisator die niet altijd uit betrouwbare contentvelden volgen.
- Unit-tests en TypeScript slagen bij de baseline. Het bestaande `next lint`-script valt terug naar een interactieve configuratieprompt.

## Gekozen aanpak

Een gerichte functionele polish heeft de voorkeur boven uitsluitend technische reparaties of een brede visuele herbouw. De wijziging blijft reviewbaar, hergebruikt bestaande componenten en introduceert geen database, frameworkmigratie, betaalde dependency, nieuwe tracking of fictieve data.

## Gebruikerservaring

### Homepage

- Behoud de fotografische hero en merktypografie.
- Verminder de verticale dominantie zodat de eerstvolgende evenementen eerder zichtbaar zijn.
- Houd de bestaande zoekactie eenvoudig; de homepage stuurt naar de URL-gestuurde agenda.
- Laat de propositie expliciet Nederland én België benoemen.

### Agenda en resultaten

- Voeg `q` toe als stabiele, deelbare queryparameter.
- Zoek server-side, hoofdletterongevoelig, over eventtitel, saunanaam, plaats en provincie.
- Toon actieve filters als afzonderlijk verwijderbare labels en bied één duidelijke resetactie.
- Toon het resultaataantal als statusmelding en behoud de huidige URL tijdens combineren van filters.
- Behandel een omgekeerd datumbereik als inline fout; voer geen verrassende automatische correctie uit.
- Maak resultaten compacter. Op desktop worden ze horizontale, scanbare rijen; op mobiel compacte kaarten.
- Geef datum en tijd de hoogste scanprioriteit, gevolgd door titel, sauna en plaats. Laat onbekende tijden weg in plaats van ze te verzinnen.
- Gebruik fotografie ondersteunend en behoud deze voor herkenning.
- De lege staat noemt de actieve zoekopdracht/filters en biedt resetten of teruggaan naar de volledige agenda.
- Voeg geen afstands-, saunameester-, beschikbaarheids- of reserveringsfilter toe zolang de data dit niet ondersteunt.

### Navigatie

- Voeg een echte mobiele menuknop toe voor Agenda, Sauna's, Over en Voor sauna's.
- Ondersteun openen/sluiten, Escape, sluiten na navigatie, body-scroll-lock en logisch focusmanagement.
- Markeer de actieve hoofdnavigatieroute.
- Behoud de prominente agenda-CTA zonder dubbele mobiele navigatie.

## Architectuur en dataflow

- Breid `EventFilters` en `parseFilters` uit met `q` en geldigheidsinformatie voor datums.
- Pas filtering server-side toe op de reeds geladen en gesorteerde gepubliceerde events.
- Houd `AgendaFilters` als enige clientcomponent binnen de agenda voor URL-interactie; introduceer geen globale state.
- Gebruik `router.replace` met `scroll: false`, zodat filteren geen volledige reload of scrollsprong veroorzaakt.
- Centraliseer verwijdering van één filter in dezelfde URL-updatefunctie.
- Maak datumlogica expliciet voor `Europe/Amsterdam`, zonder locale-afhankelijke parsing van ISO-datums.
- Laat contentbestanden, scraper, affiliatebestemmingen en route-URL's ongemoeid.

## Betrouwbaarheid en content

- Voeg op agenda- en detailcontext een korte, voorzichtige melding toe dat programma's en tijden kunnen wijzigen en dat de saunawebsite leidend is.
- Claim niet dat de agenda volledig of realtime actueel is.
- Houd externe bestemmingen herkenbaar in CTA-microcopy.
- Verander geen eventstatussen, tijden, prijzen, sauna's of productiecontent.

## Accessibility

- Behoud één logische `h1` per pagina en semantische resultaatlijsten.
- Voeg een skiplink toe en zorg voor consistente `focus-visible`-ringen.
- Maak knoppen, filterchips en formuliercontrols minimaal 44 px hoog; tekstlinks in lopende tekst zijn hiervan uitgezonderd.
- Geef zoek- en filtervelden blijvende labels.
- Gebruik `aria-current` in hoofdnavigatie en `aria-live` voor resultaataantal/foutstatus.
- Het mobiele menu krijgt correcte naamgeving, `aria-expanded`, focusverplaatsing en Escape-gedrag.
- Respecteer `prefers-reduced-motion` voor transitions en scrollgedrag.

## SEO en structured data

- Behoud canonicals, sitemap en bestaande indexeerbare routes.
- Maak geen indexeerbare pagina's voor willekeurige filtercombinaties.
- Verwijder niet-onderbouwde `Offer.availability`, prijsconstructies en organisatorclaims uit Event-JSON-LD.
- Behoud uitsluitend velden die rechtstreeks uit betrouwbare event- en saunadata volgen.
- Controleer titels, descriptions, Open Graph, robots, sitemap en JSON-LD na de wijzigingen.

## Performance

- Verminder boven-de-vouwhoogte zonder de bestaande hero-assets te vervangen.
- Beperk client-JavaScript tot filter- en menu-interactie.
- Voeg geen animatie- of componentlibrary toe.
- Behoud `next/image`, vaste aspectverhoudingen en lazy loading voor niet-prioritaire beelden.
- Gebruik transforms, opacity en kleurtransitions; respecteer reduced motion.

## Foutafhandeling

- Ongeldige of onbekende querywaarden worden genegeerd en niet als actief filter getoond.
- Een onmogelijke datum of `van > tot` toont een inline fout en geen misleidende resultaten.
- Geen resultaten geeft een bruikbare resetactie.
- Ontbrekende optionele eventdata worden niet als lege labels of fictieve waarden weergegeven.

## Tests en validatie

Voeg unit-tests toe voor:

- zoeken op titel, sauna en plaats;
- combinaties van zoekterm, land, provincie, type en datumbereik;
- onbekende querywaarden;
- ongeldige en omgekeerde datumbereiken;
- Europe/Amsterdam rond UTC-middernacht;
- Event-structured-data zonder fictieve prijs-, beschikbaarheids- of organisatorvelden.

Valideer vervolgens:

- `npm test`;
- TypeScript via `tsc --noEmit`;
- een niet-interactieve lintoplossing passend bij de bestaande dependencies;
- `npm run build`;
- homepage, agenda, filtercombinaties, lege/foutstaat, eventdetail, saunapagina en 404;
- toetsenbordbediening en mobiel menu;
- 320, 375, 390, 430, 768, 1024, 1280 en 1440 px;
- console-, netwerk- en hydrationfouten;
- metadata, robots, sitemap en JSON-LD.

## Buiten scope

- Database- of backendmigratie.
- Productiecontent of eventstatussen aanpassen.
- Scraper- of importarchitectuur wijzigen.
- Authenticatie, accounts, favorieten of communityfuncties.
- Afstandsfilters, reserveringsstatus of saunameesters zonder betrouwbare brondata.
- Nieuwe commerciële tracking, betaalfunctionaliteit of dependencies.
- Bestaande geïndexeerde routes verwijderen of hernoemen.

## Acceptatiecriteria

De polish-pass is geslaagd wanneer:

1. de bestaande merkidentiteit herkenbaar blijft;
2. bezoekers op mobiel en desktop sneller datum, tijd, event, sauna en plaats kunnen vergelijken;
3. zoeken en alle bestaande filters combineerbaar, deelbaar en afzonderlijk verwijderbaar zijn;
4. datumlogica rond Nederlandse middernacht correct is;
5. navigatie en filters volledig met toetsenbord bruikbaar zijn;
6. structured data geen niet-onderbouwde claims meer bevat;
7. tests, TypeScript en productiebuild slagen;
8. bestaande routes, affiliateflow en gepubliceerde content functioneel intact blijven.
