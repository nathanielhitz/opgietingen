# Rubriek Saunagids en bredere TikTok-hashtags — ontwerp

Datum: 2026-10-14. Status: gebouwd in dezelfde sessie als het ontwerp.

Dit is een uitbreiding van de social-kit ([spec 2026-09-08](2026-09-08-social-fundament-en-kit-design.md)),
de Buffer-adapter ([spec 2026-09-23](2026-09-23-social-buffer-adapter-design.md)) en de
slideshow-video ([spec 2026-09-24](2026-09-24-social-video-met-muziek-design.md)).

## 1. Aanleiding

Op 2026-10-14 liet het TikTok-profiel zien dat de eerste weken van video's op
2 tot 4 views bleven en de laatste drie ineens op 283 tot 727 kwamen: TikTok
had ze voor het eerst op de For You-pagina gezet. Van de besproken opties
(zoekverkeer, netwerksignalen, meer en gevarieerder posten, meer kanalen,
echt opgietbeeld) zijn de twee goedkoopste met het grootste bereik per uur
werk gekozen:

1. **Een evergreen rubriek uit de tien gidsartikelen.** "Zo werkt een opgieting
   voor beginners", "Aufguss-etiquette", "Wat neem je mee" zijn precies de
   onderwerpen waar beginners op TikTok op zoeken, zijn niet tijdgebonden en
   linken naar de affiliate-gidsen.
2. **Bredere TikTok-hashtags.** TikTok gaf alleen vijf kerntags; de plaats- en
   type-tags gingen alleen naar Instagram. Op TikTok zijn juist plaats- en
   saunanamen de zoekwoorden waar nog niemand op zit.

## 2. Beslissingen

| Vraag | Besluit | Waarom |
|---|---|---|
| Plaatsingsdag en tijd | Zondag 19:00 NL | De enige dag zonder post (ma nieuw, wo uitgelicht, vr weekend); zondagavond plannen mensen hun week. Vanaf de maandagrun (Buffer) én de vrijdag (social-kit) is dat dezelfde ISO-week. |
| Welke gids | Alle gidsen op slug, weeknummer modulo aantal | Deterministisch, geen grootboek nodig, stabiel bij titelwijzigingen. Evergreen content mag na *n* weken herhalen; vrijwel niemand kijkt zo ver terug. Een nieuwe gids schuift de rotatie één plek op, dat is aanvaardbaar. |
| Post-id | `gids-<ISO-week>` | Zelfde patroon als `weekend-` en `nieuw-`; het grootboek voorkomt dubbele plaatsing binnen een week. |
| Inhoud van de slides | Cover (titel + samenvatting) + max. zes kernpunten + afsluiter | Acht story-slides van 3,5 s is 28 s video: nog uit te kijken. Zes punten houdt de kijktijd per slide leesbaar. |
| Waar de punten vandaan komen | Automatisch uit de MDX-body (`gidsPunten`) | Geen nieuw frontmatter-veld, geen Keystatic-wijziging, geen handwerk per gids. Regel: per `##`-sectie elke vette aanzet; anders de kop met de eerste alinea; max. 160 tekens hele zinnen. Op alle tien gidsen gecontroleerd. |
| Beeld | De `afbeelding` van de gids, terugval `/images/social/gids.jpg` → hero | Elke gids heeft een eigen foto, dus het profielraster wordt eindelijk gevarieerd. De gidsfoto's zijn generieke sfeerbeelden, dus de regel "geen beelden die suggereren hoe een specifieke sauna eruitziet" blijft gelden. |
| Caption | Opening (titel, samenvatting of "Goed om te weten…", rouleert), genummerde punten, "De hele gids via de link in bio" / Facebook-URL naar `/gids/<slug>` met UTM, kern + `saunatips` `saunagids` | Zelfde opbouw als de eventposts; de punten zijn de zoektekst. `/links` heeft al een knop *Saunagids*. |
| TikTok-hashtags | Kern + eventtype + max. 3 plaatsnamen + max. 3 saunanamen, max. 15 | TikTok staat 4000 tekens toe en indexeert hashtags als zoekwoorden. Instagram blijft op 12 (langere reeksen gelden daar als spam) en zonder saunanamen. Facebook blijft op drie. |
| Planning-contract | Nieuw optioneel veld `gids` op de post, `events: []`, slide-rol `punt` | Achterwaarts compatibel: `social-kit`, `social-buffer` en `social-video` lezen alleen `slides`, `captions` en `titel`. |

## 3. Wat er is gebouwd

- `src/lib/social-gids.ts`: `gidsPunten`, `kiesGids`, `naarPlanningGids`, `schoneTekst`, `eersteZinnen`.
- `src/lib/social.ts`: rubriek `gids`, slide-rol `punt`, `bouwPosts(events, datum, gidsen)`.
- `src/lib/social-captions.ts`: openingen, puntregels, oproep en hashtags voor gids; TikTok-tags verbreed.
- `src/lib/social-planning.ts` + `/social/planning`: `gidsen` meegeven, veld `gids` in het contract.
- `src/lib/social-slides.tsx`: `GidsCoverSlide`, `GidsPuntSlide`; routes `/social/gids/[slug]` en `/social/gids/[slug]/[nr]`.
- `scripts/lib/social-buffer.ts`: `PLAATSINGSTIJD.gids = "19:00"`.
- Tests: `scripts/lib/social-gids.test.ts`, uitgebreide caption- en Buffer-tests.

## 4. Niet gedaan (bewust)

- Geen TikTok-handles van sauna's (geen `tiktok`-veld op het profiel): eerst zien of de bredere tags iets doen.
- Geen aparte selectie voor product-gidsen versus how-to-gidsen; de rotatie behandelt ze gelijk.
- Geen uitsluitingsveld (`socialOverslaan`) per gids; komt pas als een gids aantoonbaar niet werkt als post.
