# Muziek: licenties

## Social-video's: `background-music.mp3`

| Veld | Waarde |
|---|---|
| Titel | Ocean Dream Meditation |
| Uitgever / kanaal | Healing Meditation Music — <https://www.youtube.com/@HealingMeditationMusic> |
| Bron | <https://www.youtube.com/watch?v=1shZObJdO64> ("Royalty Free Meditation Music \| Relaxing Music Ocean Waves Nature Sounds & Calm Piano", 2020-06-04); het bestand is een fragment van 3:16 |
| Licentie | **Betaalde licentie vereist.** De videobeschrijving: "License this track here: <https://royaltyfreemeditationmusiclibrary.com/b/ocean-dream-meditation>" en "royalty free" = één keer betalen, daarna geen royalty's. |
| Status | **Nog niet gekocht** (stand 2026-09-30). Nathaniel besloot op 2026-09-30 de track voorlopig in de social-video's te houden en van de website te halen. Koop de licentie via de link hierboven en zet het bewijs (ordernummer, datum, licentietekst) hier neer, of vervang de track door een Mixkit-track (zie Historie). |

Risico zolang de licentie ontbreekt: een claim via Meta Rights Manager of TikTok (gedempte
of geblokkeerde post) en een inbreukclaim van de uitgever.

## Website: `public/audio/sfeergeluid.mp3`

| Veld | Waarde |
|---|---|
| Titel | Valley Sunset |
| Artiest | Alejandro Magaña (A. M.) |
| Bron | Mixkit, <https://assets.mixkit.co/music/127/127.mp3> via <https://mixkit.co/free-stock-music/mood/calm/> |
| Licentie | Mixkit Stock Music Free License — <https://mixkit.co/license/#musicFree>: persoonlijk en commercieel gebruik incl. websites en social, geen naamsvermelding; niet los herverdelen, niet op cd/dvd/games/uitzending, niet in een claimsysteem registreren. |
| Status | Gelicentieerd; sinds 2026-09-30 de sfeergeluid-track van de site (knop in de header). `scripts/lib/sfeergeluid.test.ts` bewaakt de sha256 van dit bestand. |

## Historie

- 2026-09-24 t/m 2026-09-30: drie Mixkit-tracks in de social-video's (Valley Sunset, Serene View, Forest Mist Whispers; commit 1dc5902, allemaal Stock Music Free License). Eenvoudig terug te zetten in `TRACKS` (`scripts/lib/video.ts`).
- 2026-09-30: eigen track (Ocean Dream Meditation) in de social-video's; website kortstondig dezelfde track, daarna Valley Sunset.

Spec: `docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md` §9 en
`docs/superpowers/specs/2026-09-30-sfeergeluid-website-design.md`.
