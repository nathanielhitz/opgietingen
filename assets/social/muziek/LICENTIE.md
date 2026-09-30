# Achtergrondtrack social-video's

Eén track (sinds 2026-09-30); `trackVoorDatum` in `scripts/lib/video.ts` rouleert per
ISO-week zodra er meer tracks in `TRACKS` staan, alle posts van dezelfde week krijgen
dezelfde track.

| Bestand | Titel | Artiest | Duur | Bron | Licentie |
|---|---|---|---|---|---|
| `background-music.mp3` | Background music (bestandsnaam; titel onbekend) | onbekend | 3:16 | YouTube, kanaal/afspeellijst "no copyright music" (volgens Nathaniel, 2026-09-30); video-URL nog aan te leveren | rechtenvrij volgens de uploader; titel, artiest, video-URL en exacte voorwaarden (vaak: naamsvermelding verplicht) nog niet vastgelegd |

## Gebruik op de website

Dezelfde track staat byte-gelijk als `public/audio/sfeergeluid.mp3` op de site (sfeergeluid-knop in de header, spec `docs/superpowers/specs/2026-09-30-sfeergeluid-website-design.md`); een test bewaakt dat beide bestanden gelijk blijven. Vervang je de track, vervang dan beide.

## Openstaand

Nathaniel gaf op 2026-09-30 aan dat de track van YouTube ("no copyright music") komt. Wat nog
ontbreekt: titel, artiest en de video-URL met de licentietekst (spec §9). Let op: veel van die
tracks eisen naamsvermelding in de beschrijving; dat geldt dan ook voor de website. Vul dat in zodra
het bekend is, zodat een claim via Rights Manager (Facebook/Instagram) of TikTok
direct te weerleggen is met de bron.

## Historie

Tot 2026-09-30 stonden hier drie tracks van Mixkit onder de Mixkit Stock Music Free
License (<https://mixkit.co/license/#musicFree>): Valley Sunset en Forest Mist Whispers
(Alejandro Magaña) en Serene View (Arulo). Ze staan nog in de git-historie
(commit 1dc5902) en zijn eenvoudig terug te zetten als tweede/derde track in `TRACKS`.

Spec: `docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md` §9.
