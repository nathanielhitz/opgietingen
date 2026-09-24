# Social-posts als slideshow-video met achtergrondmuziek — ontwerp

Datum: 2026-09-24. Status: ontwerp, goedgekeurd in de brainstorm van 2026-09-24.

Dit is deelproject 3 van het social-marketingtraject. Deelproject 1
([spec 2026-09-08](2026-09-08-social-fundament-en-kit-design.md)) bouwde de
planning-JSON, de slide-routes en de lokale `social-kit`; deelproject 2
([spec 2026-09-23](2026-09-23-social-buffer-adapter-design.md)) plaatst de posts
wekelijks via de Buffer-API als fotocarrousel. Dit document vervangt die
fotocarrousel op TikTok, Facebook en (zodra gekoppeld) Instagram door een
slideshow-video van dezelfde slides met een vaste achtergrondtrack.

## 1. Aanleiding

Nathaniel wil achtergrondmuziek bij de posts, geautomatiseerd en liefst via
Buffer. Onderzoek op 2026-09-24 (schema-introspectie van de Buffer-API plus de
docs van Buffer, Meta en TikTok):

- `createPost` heeft geen muziekveld. `InstagramPostMetadataInput` en
  `TikTokPostMetadataInput` (alleen `title`, `isAiGenerated`) kennen geen audio.
  Het enige "muziek"-veld (`stickerFields.music`) is placeholder-tekst voor
  notificatie-publicatie: handmatig in de app.
- Buffer heeft experimentele, alleen-lezen queries `searchInstagramAudio`,
  `trendingInstagramAudio` en `instagramAudio` op Meta's Instagram Audio API.
  Die API koppelt catalogusmuziek alleen aan **Reels**, alleen via **Facebook
  Login**. Buffer kan die audio nog niet aan een post hangen.
- TikTok's eigen API kent `auto_add_music: true` voor fotoposts; Buffer geeft
  dat niet door.
- Buffer accepteert wél video-assets (`assets: [{ video: { url } }]`) en de
  posttypen `reel` (Facebook, Instagram) en video (TikTok). Muziek die in het
  videobestand zit komt zo altijd mee.

Conclusie: de enige nu volledig geautomatiseerde route via Buffer is een video
met ingebakken muziek. Het verlies van een in-app "trending sound" is beperkt:
zakelijke accounts krijgen op TikTok en Instagram sowieso alleen de commerciële
bibliotheek.

## 2. Beslissingen

| Vraag | Besluit | Waarom |
|---|---|---|
| Kanalen | TikTok, Facebook (Reel) en straks Instagram (Reel) op video | Eén formaat, muziek op alle posts. Facebook-Reels bereiken meer niet-volgers; de link staat als tekst in de omschrijving. Per kanaal instelbaar via één constante (`VORM`), dus omkeerbaar. |
| Waar renderen | In de GitHub-workflow met ffmpeg | Vercel-functies hebben geen ffmpeg en te krappe tijd- en geheugengrenzen; Remotion is te zwaar voor een slideshow. |
| Waar hosten | Vercel Blob, publiek | Buffer kent geen upload, alleen URL-assets. Een MP4 in `public/` committen groeit de repo met ~20 MB per week en vergt een extra deploy-wachttijd. Blob zit in het Vercel-ecosysteem dat we al gebruiken; Hobby-quotum 1 GB opslag en 10 GB verkeer per maand. |
| Muziek | Eén vaste track, in de repo met licentiebewijs | Eén keuze, één licentie. Roulerende of rubriekgebonden tracks zijn een latere optie. |
| Bron van de track | Mixkit, Stock Music Free License | Commercieel gebruik incl. social, geen naamsvermelding, en scriptmatig te downloaden (Pixabay blokkeert scripts). Nathaniel keurt de track goed via een proefvideo. |
| Vorm van de video | Story-slides (9:16) na elkaar met crossfade, geen bewegende elementen | De story-slides zijn al voor 9:16 ontworpen; beweging op de slides zou een tweede ontwerpslag zijn zonder aantoonbaar nut. |
| Bij falen | Terugvallen op de fotocarrousel, waarschuwing, exitcode 1 | Er gaat altijd een post uit; de rode run is de melding (GitHub mailt bij een mislukte workflow). |
| Lokale controle | Nieuw script `social-video` | De proefvideo voor de trackkeuze en later voor het nakijken van een week, zonder Buffer aan te raken. |
| Instagram-catalogusmuziek | Buiten scope, wel voorbereid | Zodra Buffer audio aan een Reel kan hangen, is dit ontwerp (Reel-vorm) de juiste basis. Koppel Instagram in Buffer daarom via **Facebook Login**. |

## 3. Wat Buffer, Meta en TikTok eisen (gecheckt 2026-09-24)

- **Buffer video-asset**: `assets: [{ video: { url, metadata: { thumbnailOffset, title } } }]`.
  `url` publiek, direct, https. `thumbnailOffset` (ms) kiest het frame voor de
  thumbnail; volgens de schema-beschrijving alleen ondersteund voor Instagram,
  TikTok en Pinterest, dus niet zetten voor Facebook. `thumbnailUrl` niet
  gebruiken (de API weigert het).
- **Facebook-Reel**: `metadata.facebook.type: "reel"`. Meta: 3 tot 90 s, 9:16,
  1080×1920 aanbevolen (minimaal 540×960), 24 tot 60 fps, H.264, AAC ≥ 128 kbps,
  .mp4. Buffer weigert een Reel die niet exact 9:16 is.
- **Instagram-Reel**: `metadata.instagram { type: "reel", shouldShareToFeed: true }`.
  Buffer: 4:5 tot 9:16, maximaal 1920 px breed, 3 s tot 15 min, tot 300 MB.
- **TikTok-video**: geen `type`-veld; `title` is voor fotoposts en wordt bij video
  weggelaten. Buffer: 3 s tot 10 min, MOV/MP4/WEBM, tot 1 GB, minimaal 360 px.
- **Vercel Blob** (`@vercel/blob`, server-SDK): `put(pad, body, { access: "public",
  addRandomSuffix: false, allowOverwrite: true, contentType: "video/mp4",
  cacheControlMaxAge })`, `list({ prefix, cursor })`, `del(paden)`. Token via
  `BLOB_READ_WRITE_TOKEN`. Bestanden tot 100 MB in één `put`.

Verificatiepunten voor de concept-run (§11): of TikTok een video zonder
`metadata` accepteert, of `video.metadata.title` bij Facebook de "Reel Title"
vult, en hoe de Facebook-Reel de URL's in de caption toont.

Uitkomst concept-run 2026-09-24: Buffer accepteert de TikTok-video zonder
`metadata` en de Facebook-Reel (`type: reel`) met `video.metadata.title`; beide
concepten kregen een post-id. De Blob-URL wordt met `content-type: video/mp4`
en `cache-control: public, max-age=3600` geserveerd. De weergave van de URL's
in de Reel-caption is een visuele controle in Buffer/Facebook (§15, eerste risico).

## 4. De video

- **Bron**: de story-slides (1080×1920 PNG) van de post, in de volgorde van de
  planning, gedownload met `downloadPost(post, root, map, ["story"])` uit
  `scripts/lib/social-kit.ts` (zelfde bestandsnamen en timeouts als de kit).
- **Timing**: 3,5 s per slide, crossfade van 0,5 s tussen opeenvolgende slides.
  Duur = `n × 3,5 − (n − 1) × 0,5` s voor n ≥ 2. Een post met één slide
  (Uitgelicht) is de uitzondering: 7 s, anders is de slide niet te lezen. Het
  maximum (cover + 8 events + afsluiter = 10 slides) is 30,5 s: binnen alle
  limieten uit §3.
- **Beeld**: 1080×1920, 30 fps, H.264 (`libx264`, `yuv420p`, `crf 20`, preset
  `medium`), `-movflags +faststart`. Verwachte grootte 2 tot 6 MB.
- **Geluid**: de track vanaf het begin, afgekapt op de videoduur, fade-in 0,5 s,
  fade-out 1,5 s, `loudnorm` naar −14 LUFS, AAC 128 kbps stereo 44,1 kHz.
- **Thumbnail**: `thumbnailOffset: 1000` (één seconde in de cover) voor TikTok en
  Instagram.

## 5. Rendermodule `scripts/lib/video.ts`

- `videoDuur(aantalSlides)`: pure functie, de formule uit §4 inclusief de uitzondering voor één slide.
- `ffmpegArgumenten(opties: { slides: string[]; track: string; uit: string })`:
  pure functie die de complete argumentenlijst bouwt (`-loop 1 -t 3.5 -i` per
  slide, de `xfade`-keten in een `filter_complex`, `atrim`/`afade`/`loudnorm` op
  de track, codecs, `-t <duur>` als harde grens). Getest op 1, 2 en 10 slides.
- `renderSlideshow(opties)`: start ffmpeg via `child_process.spawn` met het pad
  uit `FFMPEG_PATH` of `ffmpeg` op PATH, wacht op exit 0, geeft anders een fout
  met de laatste regels stderr. `ffmpegBeschikbaar()`: `ffmpeg -version` slaagt.

De module weet niets van Buffer, Blob of de planning: slides in, MP4 uit.

## 6. Hosting `scripts/lib/blob.ts`

- `blobPad(post)`: `social/<plaatsingsdag>/<post-id>.mp4`. Vast pad, dus een
  herstart overschrijft hetzelfde bestand en alle kanalen delen één URL.
- `uploadVideo(pad, bestand)`: `put` met de opties uit §3, `cacheControlMaxAge`
  3600, geeft de publieke URL.
- `verouderdePaden(lijst, vandaag, weken = 8)`: pure functie die uit een
  `list`-resultaat de paden kiest waarvan de datummap ouder is dan `weken`.
- `ruimOp(vandaag)`: `list({ prefix: "social/" })` met paginering, `del` op de
  verouderde paden; fouten hier zijn een waarschuwing, nooit een run-fout.

Zonder `BLOB_READ_WRITE_TOKEN` is de module "niet beschikbaar" en valt de
adapter terug (§7).

## 7. Adapter: `scripts/social-buffer.ts` en `scripts/lib/social-buffer.ts`

Nieuw in de pure laag:

- `export type Vorm = "foto" | "video"` en
  `export const VORM: Record<Kanaal, Vorm> = { instagram: "video", facebook: "video", tiktok: "video" }`.
- `bouwInput(post, kanaal, kanaalId, dueAt, opties)` krijgt in `opties` een
  optionele `videoUrl`. Met `videoUrl` en `VORM[kanaal] === "video"` levert hij de
  videovariant:

  | Kanaal | `assets` | `metadata` |
  |---|---|---|
  | `facebook` | `[{ video: { url, metadata: { title: post.titel } } }]` | `facebook: { type: "reel" }` |
  | `instagram` | `[{ video: { url, metadata: { thumbnailOffset: 1000, title } } }]` | `instagram: { type: "reel", shouldShareToFeed: true }` |
  | `tiktok` | `[{ video: { url, metadata: { thumbnailOffset: 1000, title } } }]` | geen |

  Zonder `videoUrl`, of bij `VORM[kanaal] === "foto"`, de bestaande fotovariant
  (ongewijzigd, spec 2026-09-23 §6). Tekst en planning blijven gelijk.
- `BufferPostInput.assets` wordt een union van beeld- en video-assets; het
  `type`-veld in `metadata.facebook`/`instagram` krijgt de waarde `"reel"` erbij.
- `heeftVideoNodig(post, kanaalIds, grootboek, modus)`: pure functie: is er ten
  minste één kanaal met `VORM === "video"`, een kanaal-id én zonder
  grootboekregel (of modus concept)? Alleen dan wordt gerenderd.

In het script, per gekozen post vóór de kanaal-lus:

1. `heeftVideoNodig` nee → fotovariant zoals nu.
2. Ja, en modus `dry-run` → geen render of upload; de tabel toont `video (niet gerenderd)`.
3. Ja, anders: download de story-slides naar een tijdelijke map
   (`os.tmpdir()`), `renderSlideshow`, `uploadVideo`. Slaagt dat, dan `videoUrl`
   voor alle kanalen van deze post, in de tabel `video`. Faalt een stap
   (ffmpeg ontbreekt, token ontbreekt, download-, render- of uploadfout), dan
   `videoUrl` leeg: de kanalen krijgen de fotovariant, de tabel toont
   `foto (video mislukt: <reden>)`, er komt een `⚠`-regel in de samenvatting en
   de exitcode wordt 1 nadat alle posts zijn verwerkt.
4. Na de lus, alleen in modus `inplannen` en met token: `ruimOp(vandaag)`.

Concept-modus rendert en uploadt wél (Buffer moet het bestand kunnen ophalen) en
schrijft zoals nu niets in het grootboek.

Grootboek: `GrootboekRegel` krijgt een optioneel veld `video?: string` (de
Blob-URL) dat bij een videopost wordt gevuld. Oude regels blijven geldig.

## 8. Script `npm run social-video`

`scripts/social-video.ts`, flags: `--datum <maandag>` (default zoals
`social-buffer`), `--post <id>` (één post), `--basis`, `--map` (default
`data/social`), `--upload`. Haalt de planning, rendert per post (of de gekozen
post) naar `data/social/<datum>/<post-id>/video.mp4` naast de story-slides
(zelfde map-conventie als de kit, gitignored), en print duur en grootte. Met
`--upload` ook naar Blob, met de URL in de uitvoer. Raakt Buffer en het
grootboek nooit aan. Dit is het gereedschap voor de trackkeuze (§11) en voor
het nakijken van een week.

## 9. Muziek

- Bestand: `assets/social/muziek/achtergrond.mp3`, constante `MUZIEK_PAD` in
  `scripts/lib/video.ts`. Niet onder `public/`: de track hoeft niet geserveerd
  te worden.
- `assets/social/muziek/LICENTIE.md`: titel, artiest, bron-URL, licentienaam met
  link, downloaddatum en de kern van de voorwaarden.
- Criteria: instrumentaal, rustig en warm (ambient, zachte piano of lo-fi), geen
  zang, minimaal 35 s (langer dan de langste video, dus geen loop nodig),
  geen bekende melodie (Rights Manager).
- Keuze door Claude, goedkeuring door Nathaniel via een proefvideo (§11). Bij
  een claim van Meta of TikTok: track vervangen, het ontwerp verandert niet.

## 10. Workflow `.github/workflows/social.yml`

- Nieuwe stap vóór "Plan social-posts in Buffer":
  `sudo apt-get update -qq && sudo apt-get install -y -qq --no-install-recommends ffmpeg`
  (ffmpeg staat niet op het `ubuntu-latest`-image; circa één minuut).
- Env van de Buffer-stap krijgt `BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}`.
- Verder ongewijzigd: cron, modi, concurrency-groep, grootboek-commit.

## 11. Uitrol en verificatie

1. **Blob-store** (Nathaniel): in het Vercel-dashboard bij het project Storage →
   Blob → store aanmaken (publiek). `BLOB_READ_WRITE_TOKEN` in `.env` en als
   GitHub-secret zetten.
2. **Track** (Claude): downloaden van Mixkit, `LICENTIE.md` schrijven,
   `npm run social-video -- --datum <maandag>` draaien en de proefvideo aan
   Nathaniel laten horen. Pas na akkoord verder.
3. **Concept-run**: workflow_dispatch met modus `concept` (of lokaal
   `npm run social-buffer -- --concept`). In Buffer controleren: Facebook toont
   een Reel met geluid en de caption, TikTok een video met geluid en thumbnail,
   de duur klopt, en de verificatiepunten uit §3. Concepten daarna in Buffer
   verwijderen.
4. **Eerste echte run**: de cron van maandag 2026-09-28 (week W40). Steekproef
   op de kanalen na plaatsing.
5. **Instagram** (later): koppelen via Facebook Login; de Reel-vorm staat dan al
   klaar, met een concept-run vooraf.

## 12. Tests (`npm run test`)

- `scripts/lib/video.test.ts`: `videoDuur` (1, 2, 10 slides), `ffmpegArgumenten`
  (inputs in volgorde, `xfade`-keten met de juiste offsets, geen `xfade` bij één
  slide, audiofilters en codecs aanwezig, `-t <duur>`). Rooktest `renderSlideshow`
  op twee met ffmpeg gegenereerde testbeelden, overgeslagen (`t.skip`) als
  `ffmpegBeschikbaar()` faalt.
- `scripts/lib/blob.test.ts`: `blobPad`, `verouderdePaden` (grens op precies
  acht weken, andere prefixen negeren, ongeldige mapnamen negeren).
- `scripts/lib/social-buffer.test.ts`: `bouwInput` met `videoUrl` per kanaal
  (video-asset, `reel`-metadata, `thumbnailOffset` niet bij Facebook, geen
  TikTok-metadata), zonder `videoUrl` ongewijzigd, `VORM` op `foto` geeft de
  fotovariant, `heeftVideoNodig` (alle combinaties).
- `scripts/lib/social-buffer-log.test.ts`: regel met en zonder `video` leest en
  schrijft rond.

## 13. Bestanden

Nieuw: `scripts/lib/video.ts`, `scripts/lib/blob.ts`, `scripts/social-video.ts`,
`assets/social/muziek/achtergrond.mp3` + `LICENTIE.md`, tests uit §12, dit document.

Aangepast: `scripts/lib/social-buffer.ts` (`Vorm`, `VORM`, `bouwInput`,
`heeftVideoNodig`), `scripts/lib/buffer-client.ts` (asset-union, `reel`),
`scripts/social-buffer.ts` (renderstap, terugval, opruimen),
`src/lib/social-buffer-log.ts` (`video?`), `.github/workflows/social.yml`,
`package.json` (`@vercel/blob`, script `social-video`), `.env.example`
(`BLOB_READ_WRITE_TOKEN`), `CLAUDE.md` (structuur, Social-kit-paragraaf,
commando's, env), spec 2026-09-23 §6 (verwijzing naar dit document).

## 14. Buiten scope

Instagram-catalogusmuziek via Buffers audio-queries (zodra Buffer het aan een
post kan hangen), TikTok's `auto_add_music`, roulerende of rubriekgebonden
tracks, bewegende slides (Ken Burns), ondertitels of voice-over, video-uitvoer
in `social-kit`, Instagram-stories.

## 15. Risico's

| Risico | Gevolg | Maatregel |
|---|---|---|
| URL's in een Facebook-Reel zijn minder zichtbaar dan in een fotopost | Minder kliks via Facebook | UTM-kliks vergelijken na vier weken; Facebook terug op `foto` is één constante. |
| Rights Manager of TikTok markeert de track | Post gedempt of geblokkeerd | Track uit een bibliotheek met expliciete social-licentie, licentie in de repo, track vervangbaar zonder ontwerpwijziging. |
| ffmpeg-installatie faalt op de runner | Geen video die week | Terugval op foto met waarschuwing; exitcode 1 maakt het zichtbaar. |
| Blob-quotum (Hobby, gedeeld met de rest van het project) | Blob dertig dagen onbereikbaar | Gebruik ~20 MB per week, opruimen na acht weken; Vercel mailt bij 75 %. Terugval op foto. |
| Buffer haalt het bestand pas bij plaatsing op en het is dan weg | Post mislukt in Buffer | Opruimen pas na acht weken; plaatsing is binnen een week. |
| Zelfde pad overschreven terwijl de CDN de oude versie cachet | Buffer krijgt een oude video | Alleen bij een herstart met gewijzigde agenda; `cacheControlMaxAge` 3600 en het grootboek voorkomt herposten. |
