# Foto-vervanglijst

Audit van 24 juli 2026. Probleem: staande (portrait) bronbestanden in brede
liggende kaders (2:1 en 5:2 op detailpagina's) — met `object-cover` blijft dan
maar ~30% van de foto over, een willekeurige middenstrook. De oplossing is
**liggende versies** (richtformaat 16:9, minimaal 1600 px breed) van de
onderstaande bestanden. De overige foto's op de site zijn liggend en in orde.

## Eventfoto's (4) — regenereren via [image-prompts.md](image-prompts.md)

| Bestand | Event | Huidig formaat |
|---------|-------|----------------|
| `public/images/events/nk-aufguss.jpg` | NK Aufguss (Thermen Bussloo) | 1600×2400 |
| `public/images/events/bk-opgieten.jpg` | BK Opgieten (Thermae Boetfort) | 1600×2400 |
| `public/images/events/winter-festival.jpg` | Winter Opgietfestival (Elysium) | 1600×2400 |
| `public/images/events/zomeravond-boetfort.jpg` | Zomeravond Opgietingen (Boetfort) | 1600×2400 |

Gebruik de bestaande prompt per event-type en vraag expliciet om **liggend
16:9**. De crop van `nk-aufguss` valt toevallig nog acceptabel uit (lepel boven
de oven blijft in beeld); de andere drie hebben prioriteit.

## Saunafoto's (8) — liggende sfeerfoto kiezen

| Bestand | Sauna | Huidig formaat |
|---------|-------|----------------|
| `public/images/saunas/leeuwerikhoeve.jpg` | Thermen & Beauty LeeuwerikHoeve | 1200×1800 |
| `public/images/saunas/sauna-flevo-natuur.jpg` | Sauna Flevo Natuur | 1200×1800 |
| `public/images/saunas/spaweesp.jpg` | SpaWeesp | 1200×1800 |
| `public/images/saunas/spawell.jpg` | SpaWell | 1600×2400 |
| `public/images/saunas/thermen-berendonck.jpg` | Thermen Berendonck | 1600×2400 |
| `public/images/saunas/thermae-grimbergen.jpg` | Thermae Grimbergen | 1600×1810 |
| `public/images/saunas/thermen-la-mer.jpg` | Thermen La Mer | 1200×1800 |
| `public/images/saunas/vitae-goes.jpg` | Vitae Wellnessresort Goes | 1200×1800 |

Vooral `spawell.jpg` is dringend: de zichtbare middenstrook toont vooral tegels
en een deurpost.

## Logo-inventarisatie sauna's

Homepage-scan (statische HTML) van alle 21 sauna-websites, op zoek naar een
bruikbaar logobestand:

| Sauna | Logo gevonden | Opmerking |
|-------|---------------|-----------|
| Centre du Lac | ✅ `logo_centre_du_lac_breed2.png` | breed model |
| LAGO Lier | ✅ SVG | |
| LeeuwerikHoeve | ❌ | handmatig zoeken |
| Sauna Elysium | ✅ `logo.svg` | |
| Sauna Flevo Natuur | ✅ `logo-flevonatuur.1.svg` | |
| Zwaluwhoeve | ✅ `logo.svg` | |
| SpaSense | ✅ `logo.svg` | |
| SpaWeesp | ✅ `logo.svg` | |
| SpaWell | ✅ `logo.svg` | |
| Thermae 2000 | ✅ `logo-highres.png` | |
| Thermae Boetfort | ✅ `thermae-logo-black.png` | ook witte variant |
| Thermae Grimbergen | ✅ `thermae-logo-white.png` | witte variant → donkere achtergrond nodig |
| Thermen Berendonck | ❌ | site JS-gerenderd; handmatig zoeken |
| Thermen Binnenmaas | ✅ `logo-light.webp` + `logo-dark.webp` | beide varianten |
| Thermen Bussloo | ❌ | site JS-gerenderd; handmatig zoeken |
| Thermen La Mer | ✅ SVG | witte variant → donkere achtergrond nodig |
| Thermen Maarssen | ❌ | site JS-gerenderd; handmatig zoeken |
| Thermen Soesterberg | ❌ | site JS-gerenderd; handmatig zoeken |
| Veluwse Bron | ✅ `logo.svg` | |
| Vitae Goes | ✅ `vitae-logo-white.svg` | witte variant → donkere achtergrond nodig |
| Vitae Roosendaal | ✅ `vitae-logo-white.svg` | witte variant → donkere achtergrond nodig |

### Advies logogebruik

- **Niet als vervanging van sfeerfoto's.** Een agenda vol logo's oogt als een
  advertentiepagina en converteert slechter dan sfeerbeelden. Logo's zijn
  bovendien vaak wit-op-transparant en ogen klinisch in een fotokader.
- **Wél geschikt als fallback** waar nu de gradient met stoomwolkje staat
  (sauna's/events zonder foto), en eventueel klein op de sauna-detailpagina
  naast de naam. `CoverImage` ondersteunt sinds juli 2026 `fit="contain"`,
  dus technisch is dit één regel per plek; witte logovarianten hebben dan wel
  een donkere achtergrondkleur nodig i.p.v. `bg-white`.
- **Juridisch:** een logo gebruiken puur om de sauna aan te duiden waarnaar je
  verwijst (refererend gebruik, art. 2.23 BVIE) is in NL/BE doorgaans
  toegestaan, zeker omdat de site verkeer naar ze stuurt. Het mag alleen geen
  sponsoring/goedkeuring suggereren. Netste route: toestemming meenemen in de
  B2B-benadering (`/voor-saunas`) — het is meteen een contactmoment.
- **Niet hotlinken:** logobestanden downloaden naar `public/images/logos/` en
  lokaal serveren, zodat de site niet breekt als de sauna z'n website aanpast.
