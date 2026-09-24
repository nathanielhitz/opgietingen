# Social-posts als slideshow-video met achtergrondmuziek — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De Buffer-adapter plaatst elke weekpost op TikTok, Facebook (Reel) en straks Instagram (Reel) als slideshow-video van de story-slides met één vaste achtergrondtrack, gerenderd met ffmpeg in de workflow en gehost op Vercel Blob; bij een fout valt de post terug op de fotocarrousel.

**Architecture:** Drie nieuwe, onafhankelijke modules onder `scripts/lib/`: `video.ts` (ffmpeg-argumenten als pure functie + spawn), `blob.ts` (Vercel Blob: pad, upload, opruimen) en `social-video.ts` (download story-slides → render, gedeeld door het nieuwe CLI-script `scripts/social-video.ts` en de adapter). De adapter (`scripts/lib/social-buffer.ts` + `scripts/social-buffer.ts`) krijgt een constante `VORM` per kanaal, een videovariant van `bouwInput`, de beslisfunctie `heeftVideoNodig` en de terugvalregel. Het grootboek krijgt een optioneel veld `video`. De workflow installeert ffmpeg en geeft het Blob-token door.

**Tech Stack:** TypeScript (strict), Node 22, `tsx`, `node:test`, ffmpeg (CLI, via `child_process.spawn`), `@vercel/blob` (server-SDK), Buffer GraphQL-API, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md](../specs/2026-09-24-social-video-met-muziek-design.md)

**Werkwijze:** branch `social-video-muziek` in worktree `../Opgieting.nl-social-video` (bestaat al, `npm ci` gedaan). Commits in het Nederlands, eindigend op `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Tests: `npm run test` (draait alle `scripts/**/*.test.ts`); één bestand: `node --import tsx --test scripts/lib/video.test.ts`. Lokaal staat ffmpeg op `~/.local/bin/ffmpeg` (versie 9). Vóór de laatste commit: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
|---|---|
| `scripts/lib/video.ts` (nieuw) | `videoDuur`, `ffmpegArgumenten` (puur), `ffmpegBeschikbaar`, `renderSlideshow` (spawn), `MUZIEK_PAD` |
| `scripts/lib/video.test.ts` (nieuw) | tests op de pure functies + rooktest als ffmpeg aanwezig is |
| `scripts/lib/blob.ts` (nieuw) | `blobBeschikbaar`, `blobPad`, `verouderdePaden` (puur), `uploadVideo`, `ruimOp` |
| `scripts/lib/blob.test.ts` (nieuw) | tests op `blobPad` en `verouderdePaden` |
| `scripts/lib/social-kit.ts` (wijzigen) | `slidePaden(post, map, formaat)` (puur), gebruikt door `downloadPost` en de video-render |
| `scripts/lib/social-kit.test.ts` (wijzigen) | test op `slidePaden` |
| `scripts/lib/social-video.ts` (nieuw) | `renderPostVideo(post, root, map)`: download story-slides + render → `video.mp4` |
| `scripts/social-video.ts` (nieuw) | CLI: video's van een week lokaal renderen, optioneel uploaden |
| `scripts/lib/buffer-client.ts` (wijzigen) | asset-union (beeld/video), metadata-typen |
| `scripts/lib/social-buffer.ts` (wijzigen) | `Vorm`, `VORM`, `THUMBNAIL_OFFSET_MS`, `bouwInput` met `videoUrl`, `heeftVideoNodig` |
| `scripts/lib/social-buffer.test.ts` (wijzigen) | tests videovariant, terugval, `heeftVideoNodig`; bestaande asserts op de union |
| `src/lib/social-buffer-log.ts` (wijzigen) | `GrootboekRegel.video?` |
| `scripts/lib/social-buffer-log.test.ts` (wijzigen) | round-trip met en zonder `video` |
| `scripts/social-buffer.ts` (wijzigen) | renderstap per post, terugval, waarschuwingen, opruimen, exitcode |
| `assets/social/muziek/achtergrond.mp3` + `LICENTIE.md` (nieuw) | de track en het licentiebewijs |
| `.github/workflows/social.yml` (wijzigen) | ffmpeg-stap, `BLOB_READ_WRITE_TOKEN` |
| `package.json`, `.env.example`, `CLAUDE.md`, spec 2026-09-23 §6 (wijzigen) | dependency, script, documentatie |

---

### Taak 1: `videoDuur` en `ffmpegArgumenten` (pure kern van de render)

**Files:**
- Create: `scripts/lib/video.ts`
- Test: `scripts/lib/video.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

```ts
// scripts/lib/video.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CROSSFADE, ffmpegArgumenten, SLIDE_DUUR, videoDuur } from "./video";

test("videoDuur: één slide is de uitzondering van 7 s; daarna n × 3,5 − (n − 1) × 0,5", () => {
  assert.equal(videoDuur(1), 7);
  assert.equal(videoDuur(2), 6.5);
  assert.equal(videoDuur(10), 30.5);
  assert.throws(() => videoDuur(0), /minstens één slide/);
});

test("ffmpegArgumenten: inputs in volgorde, track als laatste input, uitvoerpad als laatste argument", () => {
  const args = ffmpegArgumenten({ slides: ["/m/01.png", "/m/02.png"], track: "/m/track.mp3", uit: "/m/video.mp4" });
  const inputs = args.flatMap((a, i) => (a === "-i" ? [args[i + 1]] : []));
  assert.deepEqual(inputs, ["/m/01.png", "/m/02.png", "/m/track.mp3"]);
  assert.equal(args.at(-1), "/m/video.mp4");
  // Elke slide loopt als stilstaand beeld (-loop 1) precies SLIDE_DUUR seconden: "-framerate 30 -t 3.5 -i <slide>".
  const slideDuren = args.flatMap((a, i) => (a === "-t" && args[i + 2] === "-i" ? [args[i + 1]] : []));
  assert.deepEqual(slideDuren, ["3.5", "3.5"]);
  assert.equal(args.filter((a) => a === "-loop").length, 2);
});

test("ffmpegArgumenten: xfade-keten met offsets i × (3,5 − 0,5), laatste label [vout], audio afgekapt op de duur", () => {
  const slides = Array.from({ length: 10 }, (_, i) => `/m/${String(i + 1).padStart(2, "0")}.png`);
  const args = ffmpegArgumenten({ slides, track: "/m/track.mp3", uit: "/m/video.mp4" });
  const graaf = args[args.indexOf("-filter_complex") + 1];
  const xfades = graaf.split(";").filter((f) => f.includes("xfade"));
  assert.equal(xfades.length, 9);
  assert.match(xfades[0], /\[v0\]\[v1\]xfade=transition=fade:duration=0\.5:offset=3\[x1\]/);
  assert.match(xfades[8], /\[x8\]\[v9\]xfade=transition=fade:duration=0\.5:offset=27\[vout\]/);
  assert.match(graaf, /\[10:a\]atrim=0:30\.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0\.5,afade=t=out:st=29:d=1\.5,loudnorm=/);
  assert.match(graaf, /\[aout\]$/);
  // Totale duur als harde grens op de uitvoer.
  assert.equal(args[args.lastIndexOf("-t") + 1], "30.5");
  assert.equal(SLIDE_DUUR - CROSSFADE, 3);
});

test("ffmpegArgumenten: één slide krijgt geen xfade maar een null-filter naar [vout] en loopt 7 s", () => {
  const args = ffmpegArgumenten({ slides: ["/m/01.png"], track: "/m/track.mp3", uit: "/m/video.mp4" });
  const graaf = args[args.indexOf("-filter_complex") + 1];
  assert.ok(!graaf.includes("xfade"));
  assert.match(graaf, /\[v0\]null\[vout\]/);
  assert.equal(args[args.indexOf("-i") - 1], "7"); // -t 7 direct vóór de eerste -i
  assert.match(graaf, /atrim=0:7,/);
});

test("ffmpegArgumenten: codecs en containerinstellingen uit de spec", () => {
  const args = ffmpegArgumenten({ slides: ["/m/01.png", "/m/02.png"], track: "/m/t.mp3", uit: "/m/v.mp4" });
  const na = (vlag: string) => args[args.indexOf(vlag) + 1];
  assert.equal(na("-c:v"), "libx264");
  assert.equal(na("-crf"), "20");
  assert.equal(na("-pix_fmt"), "yuv420p");
  assert.equal(na("-c:a"), "aac");
  assert.equal(na("-b:a"), "128k");
  assert.equal(na("-ar"), "44100");
  assert.equal(na("-movflags"), "+faststart");
  assert.deepEqual([na("-map"), args[args.lastIndexOf("-map") + 1]], ["[vout]", "[aout]"]);
});
```

- [ ] **Stap 2: Draai de tests, verwacht falen**

Run: `node --import tsx --test scripts/lib/video.test.ts`
Verwacht: FAIL, `Cannot find module './video'`.

- [ ] **Stap 3: Schrijf de implementatie**

```ts
// scripts/lib/video.ts
import { spawn } from "node:child_process";
import path from "node:path";

/*
  Slideshow-video van de story-slides met één achtergrondtrack (spec §4, §5).
  De argumenten voor ffmpeg zijn een pure functie (getest); alleen
  renderSlideshow en ffmpegBeschikbaar raken het systeem. De module weet niets
  van Buffer, Blob of de planning: slides in, MP4 uit.
*/

/** De vaste achtergrondtrack (spec §9); niet onder public/, hoeft niet geserveerd te worden. */
export const MUZIEK_PAD = path.join(process.cwd(), "assets", "social", "muziek", "achtergrond.mp3");

export const SLIDE_DUUR = 3.5;
export const CROSSFADE = 0.5;
/** Eén slide moet leesbaar blijven: langer dan de formule geeft. */
export const ENKELE_SLIDE_DUUR = 7;
export const FADE_IN = 0.5;
export const FADE_UIT = 1.5;
export const FPS = 30;
export const BREEDTE = 1080;
export const HOOGTE = 1920;

/** Duur van de video in seconden: n × 3,5 − (n − 1) × 0,5, met 7 s voor één slide. */
export function videoDuur(aantalSlides: number): number {
  if (aantalSlides < 1) throw new Error("videoDuur: minstens één slide nodig");
  if (aantalSlides === 1) return ENKELE_SLIDE_DUUR;
  return aantalSlides * SLIDE_DUUR - (aantalSlides - 1) * CROSSFADE;
}

export interface RenderOpties {
  /** Absolute paden van de story-slides, in volgorde. */
  slides: string[];
  /** Pad van de muziektrack. */
  track: string;
  /** Uitvoerpad (.mp4). */
  uit: string;
}

/** Getallen zonder overbodige nullen, zodat "3" en "3.5" er staan zoals ffmpeg ze verwacht. */
const getal = (n: number) => String(Number(n.toFixed(3)));

/**
 * Complete argumentenlijst voor ffmpeg. Elke slide is een stilstaand beeld van
 * SLIDE_DUUR s (7 s bij één slide), geschaald op 1080×1920 met zwarte balken als
 * de verhouding afwijkt, aan elkaar gezet met een xfade van CROSSFADE s. De
 * track wordt afgekapt op de videoduur met fade-in, fade-out en loudnorm.
 */
export function ffmpegArgumenten(o: RenderOpties): string[] {
  const n = o.slides.length;
  const duur = videoDuur(n);
  const slideDuur = n === 1 ? ENKELE_SLIDE_DUUR : SLIDE_DUUR;
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const slide of o.slides) args.push("-loop", "1", "-framerate", getal(FPS), "-t", getal(slideDuur), "-i", slide);
  args.push("-i", o.track);

  const filters: string[] = [];
  for (let i = 0; i < n; i++) {
    filters.push(
      `[${i}:v]scale=${BREEDTE}:${HOOGTE}:force_original_aspect_ratio=decrease,pad=${BREEDTE}:${HOOGTE}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,setsar=1,fps=${FPS}[v${i}]`,
    );
  }
  if (n === 1) {
    filters.push("[v0]null[vout]");
  } else {
    let vorige = "[v0]";
    for (let i = 1; i < n; i++) {
      const offset = i * (SLIDE_DUUR - CROSSFADE);
      const label = i === n - 1 ? "[vout]" : `[x${i}]`;
      filters.push(`${vorige}[v${i}]xfade=transition=fade:duration=${getal(CROSSFADE)}:offset=${getal(offset)}${label}`);
      vorige = label;
    }
  }
  filters.push(
    `[${n}:a]atrim=0:${getal(duur)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${getal(FADE_IN)},afade=t=out:st=${getal(duur - FADE_UIT)}:d=${getal(FADE_UIT)},loudnorm=I=-14:TP=-1.5:LRA=11[aout]`,
  );

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[vout]",
    "-map", "[aout]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", getal(FPS),
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
    "-t", getal(duur),
    "-movflags", "+faststart",
    o.uit,
  );
  return args;
}

/** Pad van ffmpeg: FFMPEG_PATH of `ffmpeg` op PATH. */
export function ffmpegPad(env: Record<string, string | undefined> = process.env): string {
  return env.FFMPEG_PATH || "ffmpeg";
}

/** Slaagt `ffmpeg -version`? */
export function ffmpegBeschikbaar(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPad(), ["-version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

/** Rendert de slideshow; faalt met de laatste regels stderr van ffmpeg. */
export function renderSlideshow(o: RenderOpties): Promise<void> {
  const args = ffmpegArgumenten(o);
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPad(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    p.on("error", (err) => reject(new Error(`ffmpeg starten mislukt: ${err.message}`)));
    p.on("exit", (code) => {
      if (code === 0) return resolve();
      const staart = stderr.trim().split("\n").slice(-5).join(" | ");
      reject(new Error(`ffmpeg eindigde met code ${code}: ${staart || "geen uitvoer"}`));
    });
  });
}
```

- [ ] **Stap 4: Draai de tests, verwacht slagen**

Run: `node --import tsx --test scripts/lib/video.test.ts`
Verwacht: 5 tests, `# pass 5`.

- [ ] **Stap 5: Commit**

```bash
git add scripts/lib/video.ts scripts/lib/video.test.ts
git commit -m "feat(social): ffmpeg-argumenten en duur voor de slideshow-video als pure functies

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 2: Rooktest `renderSlideshow` (alleen met ffmpeg)

**Files:**
- Modify: `scripts/lib/video.test.ts`

- [ ] **Stap 1: Voeg de rooktest toe**

Onderaan `scripts/lib/video.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ffmpegBeschikbaar, ffmpegPad, renderSlideshow } from "./video";

test("renderSlideshow: twee testbeelden en een toon worden een mp4 (rooktest, alleen met ffmpeg)", async (t) => {
  if (!(await ffmpegBeschikbaar())) {
    t.skip("ffmpeg niet gevonden");
    return;
  }
  const map = fs.mkdtempSync(path.join(os.tmpdir(), "video-rooktest-"));
  t.after(() => fs.rmSync(map, { recursive: true, force: true }));
  // Kleine testbeelden (108×192, dezelfde verhouding) en 10 s toon, allemaal door ffmpeg zelf gemaakt.
  const beeld = (naam: string, kleur: string) => {
    const uit = path.join(map, naam);
    const r = spawnSync(ffmpegPad(), ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${kleur}:s=108x192`, "-frames:v", "1", uit]);
    assert.equal(r.status, 0, r.stderr?.toString());
    return uit;
  };
  const slides = [beeld("01.png", "red"), beeld("02.png", "blue")];
  const track = path.join(map, "track.wav");
  const toon = spawnSync(ffmpegPad(), ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=10", track]);
  assert.equal(toon.status, 0, toon.stderr?.toString());

  const uit = path.join(map, "video.mp4");
  await renderSlideshow({ slides, track, uit });
  assert.ok(fs.statSync(uit).size > 1000, "mp4 is leeg");
});

test("renderSlideshow: een ontbrekende slide geeft een fout met de ffmpeg-uitvoer (alleen met ffmpeg)", async (t) => {
  if (!(await ffmpegBeschikbaar())) {
    t.skip("ffmpeg niet gevonden");
    return;
  }
  await assert.rejects(
    renderSlideshow({ slides: ["/bestaat/niet.png"], track: "/bestaat/niet.mp3", uit: path.join(os.tmpdir(), "nooit.mp4") }),
    /ffmpeg eindigde met code/,
  );
});
```

Zet de vier nieuwe `import`-regels bovenaan het bestand bij de andere imports (ESLint eist imports bovenaan).

- [ ] **Stap 2: Draai de tests**

Run: `node --import tsx --test scripts/lib/video.test.ts`
Verwacht: `# pass 7` (lokaal, ffmpeg aanwezig). Zonder ffmpeg: `# pass 5`, `# skipped 2`.

- [ ] **Stap 3: Commit**

```bash
git add scripts/lib/video.test.ts
git commit -m "test(social): rooktest voor renderSlideshow, overgeslagen zonder ffmpeg

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 3: `slidePaden` in social-kit (lokale paden van gedownloade slides)

**Files:**
- Modify: `scripts/lib/social-kit.ts`
- Test: `scripts/lib/social-kit.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Voeg toe aan `scripts/lib/social-kit.test.ts` (import `slidePaden` erbij in de bestaande importregel):

```ts
test("slidePaden: carrousel in de formaat-submap zonder achtervoegsel, één slide in de postmap mét achtervoegsel", () => {
  assert.deepEqual(slidePaden(post, "/m/w37", "story"), [
    path.join("/m/w37", "story", "01-cover.png"),
    path.join("/m/w37", "story", "02-event-herfstgloed.png"),
    path.join("/m/w37", "story", "03-afsluiter.png"),
  ]);
  const enkel: PlanningPost = { ...post, slides: [post.slides[1]] };
  assert.deepEqual(slidePaden(enkel, "/m/u", "story"), [path.join("/m/u", "01-event-herfstgloed-story.png")]);
});
```

- [ ] **Stap 2: Draai, verwacht falen**

Run: `node --import tsx --test scripts/lib/social-kit.test.ts`
Verwacht: FAIL, `slidePaden` is geen export.

- [ ] **Stap 3: Implementeer en gebruik hem in `downloadPost`**

In `scripts/lib/social-kit.ts`, direct na `metSubmappen`:

```ts
/**
 * Lokale paden van de slides van één formaat, in planningvolgorde, volgens de
 * mapconventie van downloadPost: carrousel in `<map>/<formaat>/NN-rol[-slug].png`,
 * één slide als `<map>/NN-rol[-slug]-<formaat>.png`.
 */
export function slidePaden(post: Pick<PlanningPost, "slides">, map: string, formaat: Formaat): string[] {
  const submappen = metSubmappen(post);
  return post.slides.map((slide, i) =>
    submappen ? path.join(map, formaat, bestandsnaam(i, slide)) : path.join(map, bestandsnaam(i, slide, formaat)),
  );
}
```

En in `downloadPost` de inline padberekening vervangen. Vervang:

```ts
  try {
    for (const [i, slide] of post.slides.entries()) {
      for (const formaat of formaten) {
        const res = await ophalen(slide[formaat]);
        if (!res.ok) throw new Error(`${slide[formaat]}: HTTP ${res.status}`);
        const doel = submappen ? path.join(map, formaat, bestandsnaam(i, slide)) : path.join(map, bestandsnaam(i, slide, formaat));
        fs.writeFileSync(doel, Buffer.from(await res.arrayBuffer()));
      }
    }
```

door:

```ts
  const doelen = new Map(formaten.map((formaat) => [formaat, slidePaden(post, map, formaat)] as const));
  try {
    for (const [i, slide] of post.slides.entries()) {
      for (const formaat of formaten) {
        const res = await ophalen(slide[formaat]);
        if (!res.ok) throw new Error(`${slide[formaat]}: HTTP ${res.status}`);
        fs.writeFileSync(doelen.get(formaat)![i], Buffer.from(await res.arrayBuffer()));
      }
    }
```

- [ ] **Stap 4: Draai de tests**

Run: `node --import tsx --test scripts/lib/social-kit.test.ts`
Verwacht: alle tests slagen (de bestaande `downloadPost`-tests bewijzen dat de paden gelijk bleven).

- [ ] **Stap 5: Commit**

```bash
git add scripts/lib/social-kit.ts scripts/lib/social-kit.test.ts
git commit -m "refactor(social): slidePaden als pure functie, gedeeld door downloadPost en de video-render

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 4: `renderPostVideo` (download story-slides → mp4)

**Files:**
- Create: `scripts/lib/social-video.ts`

Geen eigen test: de functie is compositie van twee geteste functies (`downloadPost`, `renderSlideshow`) plus `slidePaden`; de CLI-run in taak 8 is de integratietest.

- [ ] **Stap 1: Schrijf de module**

```ts
// scripts/lib/social-video.ts
import path from "node:path";
import type { PlanningPost } from "../../src/lib/social-planning";
import { downloadPost, slidePaden, type Ophalen } from "./social-kit";
import { MUZIEK_PAD, renderSlideshow, videoDuur } from "./video";

/*
  Eén post → één video (spec §4, §7 stap 3): de story-slides worden gedownload
  volgens de mapconventie van social-kit en met de vaste track gerenderd naar
  `<map>/video.mp4`. Gedeeld door scripts/social-video.ts (lokaal bekijken) en
  scripts/social-buffer.ts (uploaden naar Blob).
*/

export interface VideoResultaat {
  /** Pad van de mp4. */
  bestand: string;
  /** Duur in seconden. */
  duur: number;
  aantalSlides: number;
}

/**
 * `map` moet binnen `root` liggen (downloadPost controleert dat). Een bestaande
 * map van een eerdere kit-run wordt vervangen: daarna staan er alleen de
 * story-slides, captions.md en video.mp4.
 */
export async function renderPostVideo(post: PlanningPost, root: string, map: string, ophalen?: Ophalen): Promise<VideoResultaat> {
  await downloadPost(post, root, map, ["story"], ophalen);
  const slides = slidePaden(post, map, "story");
  const bestand = path.join(map, "video.mp4");
  await renderSlideshow({ slides, track: MUZIEK_PAD, uit: bestand });
  return { bestand, duur: videoDuur(slides.length), aantalSlides: slides.length };
}
```

- [ ] **Stap 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "social-video|video\.ts" || echo OK`
Verwacht: `OK`.

- [ ] **Stap 3: Commit**

```bash
git add scripts/lib/social-video.ts
git commit -m "feat(social): renderPostVideo: story-slides downloaden en tot mp4 renderen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 5: Muziektrack met licentie

**Files:**
- Create: `assets/social/muziek/achtergrond.mp3`
- Create: `assets/social/muziek/LICENTIE.md`

- [ ] **Stap 1: Kies een track op Mixkit**

Haal de lijst op en kies een instrumentale, rustige, warme track zonder zang van minimaal 35 s (spec §9). Kandidaat-tags: `calm`, `ambient`, `piano`, `relaxing`. Voorbeeld om te bladeren:

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36'
curl -sL -A "$UA" https://mixkit.co/free-stock-music/tag/calm/ -o /tmp/mixkit.html
# Titel, artiest, tags en mp3-URL staan per item in de HTML; zoek de item-blokken:
grep -o -E 'data-title="[^"]+"|assets\.mixkit\.co/music/[0-9]+/[0-9]+\.mp3|data-artist="[^"]+"' /tmp/mixkit.html | head -60
```

Kies één mp3-URL. Download en controleer de duur:

```bash
mkdir -p assets/social/muziek
curl -sL -A "$UA" -o assets/social/muziek/achtergrond.mp3 "https://assets.mixkit.co/music/<ID>/<ID>.mp3"
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate -of default=nw=1 assets/social/muziek/achtergrond.mp3
ls -la assets/social/muziek/achtergrond.mp3
```

Verwacht: `codec_name=mp3`, `duration` ≥ 35, bestand < 10 MB.

- [ ] **Stap 2: Schrijf `LICENTIE.md`**

Haal de licentietekst op (`https://mixkit.co/license/`, sectie "Stock Music Free License") en vul in:

```markdown
# Achtergrondtrack social-video's

- **Bestand:** `achtergrond.mp3`
- **Titel:** <titel zoals op Mixkit>
- **Artiest:** <artiest zoals op Mixkit>
- **Bron:** <https://mixkit.co/free-stock-music/...> (item-URL)
- **Licentie:** Mixkit Stock Music Free License — <https://mixkit.co/license/#musicFree>
- **Gedownload:** 2026-09-24

## Kern van de voorwaarden (samenvatting, de licentietekst is bindend)

- Gratis te gebruiken in persoonlijke en commerciële projecten, inclusief video's op sociale media.
- Geen naamsvermelding vereist.
- Niet los herverdelen of verkopen; niet als onderdeel van een claim registreren (Content ID / Rights Manager).

Gebruikt door `scripts/lib/video.ts` (`MUZIEK_PAD`), spec
`docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md` §9.
```

Controleer dat de samenvatting klopt met de tekst die je ophaalde; pas hem aan als de licentie iets anders zegt.

- [ ] **Stap 3: Commit**

```bash
git add assets/social/muziek/achtergrond.mp3 assets/social/muziek/LICENTIE.md
git commit -m "feat(social): achtergrondtrack voor de slideshow-video's (Mixkit, Stock Music Free License)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 6: Blob-module: `blobPad` en `verouderdePaden`

**Files:**
- Create: `scripts/lib/blob.ts`
- Test: `scripts/lib/blob.test.ts`
- Modify: `package.json` (dependency)

- [ ] **Stap 1: Installeer `@vercel/blob`**

Run: `npm install @vercel/blob@^1`
Verwacht: `package.json` en `package-lock.json` gewijzigd; `node_modules/@vercel/blob` aanwezig.

- [ ] **Stap 2: Schrijf de falende tests**

```ts
// scripts/lib/blob.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BEWAAR_WEKEN, blobBeschikbaar, blobPad, verouderdePaden } from "./blob";

test("blobPad: social/<plaatsingsdag>/<post-id>.mp4, vreemde tekens uit de id gestript", () => {
  assert.equal(blobPad({ id: "weekend-2026-W40", plaatsingsdag: "2026-10-02" }), "social/2026-10-02/weekend-2026-W40.mp4");
  assert.equal(blobPad({ id: "../x/uitgelicht-a", plaatsingsdag: "2026-10-02" }), "social/2026-10-02/xuitgelicht-a.mp4");
});

test("verouderdePaden: ouder dan acht weken vóór vandaag, exact op de grens blijft staan, andere prefixen en onzin genegeerd", () => {
  const paden = [
    "social/2026-09-27/weekend-2026-W39.mp4", // 57 dagen oud: weg
    "social/2026-09-28/nieuw-2026-W40.mp4", // precies 56 dagen: blijft
    "social/2026-11-20/weekend-2026-W47.mp4", // vers
    "ander/2026-01-01/x.mp4", // andere prefix
    "social/onzin/x.mp4", // geen datummap
  ];
  assert.deepEqual(verouderdePaden(paden, "2026-11-23"), ["social/2026-09-27/weekend-2026-W39.mp4"]);
  assert.deepEqual(verouderdePaden(paden, "2026-11-23", 7), ["social/2026-09-27/weekend-2026-W39.mp4", "social/2026-09-28/nieuw-2026-W40.mp4"]);
  assert.equal(BEWAAR_WEKEN, 8);
});

test("blobBeschikbaar: alleen met een niet-lege BLOB_READ_WRITE_TOKEN", () => {
  assert.equal(blobBeschikbaar({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" }), true);
  assert.equal(blobBeschikbaar({ BLOB_READ_WRITE_TOKEN: "" }), false);
  assert.equal(blobBeschikbaar({}), false);
});
```

- [ ] **Stap 3: Draai, verwacht falen**

Run: `node --import tsx --test scripts/lib/blob.test.ts`
Verwacht: FAIL, `Cannot find module './blob'`.

- [ ] **Stap 4: Schrijf de module**

```ts
// scripts/lib/blob.ts
import fs from "node:fs";
import { del, list, put } from "@vercel/blob";
import { addDaysISO } from "../../src/lib/dates";
import type { PlanningPost } from "../../src/lib/social-planning";

/*
  Hosting van de slideshow-video's op Vercel Blob (spec §6). Buffer accepteert
  alleen URL-assets, dus het bestand moet publiek staan. Vast pad per post:
  een herstart overschrijft hetzelfde bestand en alle kanalen delen één URL.
  Token: BLOB_READ_WRITE_TOKEN (de SDK leest hem zelf uit process.env).
*/

export const BLOB_PREFIX = "social/";
/** Na zoveel weken worden video's opgeruimd; plaatsing is binnen een week. */
export const BEWAAR_WEKEN = 8;

export function blobBeschikbaar(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

/** `social/<plaatsingsdag>/<post-id>.mp4`; de id komt uit de planning-JSON en wordt gesaneerd. */
export function blobPad(post: Pick<PlanningPost, "id" | "plaatsingsdag">): string {
  const id = post.id.replace(/[^a-z0-9-]/gi, "");
  return `${BLOB_PREFIX}${post.plaatsingsdag}/${id}.mp4`;
}

/** Uploadt het bestand publiek en geeft de URL terug. */
export async function uploadVideo(pad: string, bestand: string): Promise<string> {
  const resultaat = await put(pad, fs.readFileSync(bestand), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "video/mp4",
    cacheControlMaxAge: 3600,
  });
  return resultaat.url;
}

/** Paden onder social/ waarvan de datummap ouder is dan `weken` vóór `vandaag` (exact op de grens blijft staan). */
export function verouderdePaden(paden: string[], vandaag: string, weken: number = BEWAAR_WEKEN): string[] {
  const grens = addDaysISO(vandaag, -weken * 7);
  return paden.filter((pad) => {
    const m = /^social\/(\d{4}-\d{2}-\d{2})\//.exec(pad);
    return m !== null && m[1] < grens;
  });
}

/** Verwijdert verouderde video's; geeft het aantal. Fouten gooit hij door: de aanroeper besluit (waarschuwing, nooit een run-fout). */
export async function ruimOp(vandaag: string): Promise<number> {
  const paden: string[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await list({ prefix: BLOB_PREFIX, cursor, limit: 1000 });
    paden.push(...pagina.blobs.map((b) => b.pathname));
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  const weg = verouderdePaden(paden, vandaag);
  if (weg.length > 0) await del(weg);
  return weg.length;
}
```

Controleer of `addDaysISO` in `src/lib/dates.ts` een negatief aantal dagen aankan (regel 115); zo niet, gebruik de `Date`-rekenwijze van die functie hier lokaal.

- [ ] **Stap 5: Draai de tests**

Run: `node --import tsx --test scripts/lib/blob.test.ts`
Verwacht: `# pass 3`.

- [ ] **Stap 6: Commit**

```bash
git add package.json package-lock.json scripts/lib/blob.ts scripts/lib/blob.test.ts
git commit -m "feat(social): Blob-module: vast videopad, upload en opruimen na acht weken

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 7: `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Stap 1: Voeg het Blob-token toe**

Onderaan `.env.example`:

```
# Slideshow-video's met muziek (scripts/social-buffer.ts, scripts/social-video.ts):
# de video's worden in de workflow met ffmpeg gerenderd en publiek op Vercel Blob
# gezet, omdat Buffer alleen URL-assets aanneemt. Token van de Blob-store bij het
# project (Vercel-dashboard → Storage → Blob). Zonder token vallen de posts terug
# op de fotocarrousel, met een waarschuwing. Optioneel FFMPEG_PATH als ffmpeg
# niet op PATH staat.
# BLOB_READ_WRITE_TOKEN=
# FFMPEG_PATH=
```

- [ ] **Stap 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): BLOB_READ_WRITE_TOKEN en FFMPEG_PATH voor de social-video's

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 8: CLI `npm run social-video` + proefvideo

**Files:**
- Create: `scripts/social-video.ts`
- Modify: `package.json` (script)

- [ ] **Stap 1: Schrijf het script**

```ts
/*
  Social-video: rendert de slideshow-video's van een week lokaal, om te bekijken
  of te controleren, en uploadt ze desgewenst naar Vercel Blob. Raakt Buffer en
  het grootboek nooit aan. Spec:
  docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md §8

    npm run social-video                              # alle posts van deze week (maandag, NL-tijd)
    npm run social-video -- --datum 2026-09-28        # andere referentiedatum
    npm run social-video -- --post weekend-2026-W40   # één post
    npm run social-video -- --upload                  # ook naar Blob (BLOB_READ_WRITE_TOKEN)
    npm run social-video -- --basis http://localhost:3000
    npm run social-video -- --map data/social         # doelmap (default)

  Uitvoer: data/social/<datum>/<post-id>/video.mp4 naast de story-slides en captions.md.
  Let op: de postmap wordt vervangen (alleen story-slides, geen feed-slides).
  Vereist ffmpeg (FFMPEG_PATH of op PATH). Exitcode 1 als er iets misging.
*/
import fs from "node:fs";
import path from "node:path";
import { isGeldigeIsoDatum, maandagVanWeek, todayISOInTimeZone } from "../src/lib/dates";
import type { PlanningJson } from "../src/lib/social-planning";
import { blobBeschikbaar, blobPad, uploadVideo } from "./lib/blob";
import { renderPostVideo } from "./lib/social-video";
import { ffmpegBeschikbaar, MUZIEK_PAD } from "./lib/video";

function flag(naam: string, standaard: string): string {
  const i = process.argv.indexOf(naam);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : standaard;
}

const DATUM = flag("--datum", maandagVanWeek(todayISOInTimeZone()));
const BASIS = flag("--basis", "https://opgietingen.nl").replace(/\/$/, "");
const MAP = flag("--map", "data/social");
const POST = flag("--post", "");
const UPLOAD = process.argv.includes("--upload");

async function main() {
  if (!isGeldigeIsoDatum(DATUM)) throw new Error(`Ongeldige --datum: ${DATUM}`);
  if (!(await ffmpegBeschikbaar())) throw new Error("ffmpeg niet gevonden (zet FFMPEG_PATH of installeer ffmpeg)");
  if (!fs.existsSync(MUZIEK_PAD)) throw new Error(`Muziektrack ontbreekt: ${MUZIEK_PAD}`);
  if (UPLOAD && !blobBeschikbaar()) throw new Error("--upload vereist BLOB_READ_WRITE_TOKEN");

  const url = `${BASIS}/social/planning?datum=${DATUM}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
  const planning = (await res.json()) as PlanningJson;
  const posts = POST ? planning.posts.filter((p) => p.id === POST) : planning.posts;
  if (posts.length === 0) {
    console.log(POST ? `Post ${POST} staat niet in de planning van ${DATUM}.` : `Geen posts voor ${DATUM}.`);
    if (POST) process.exitCode = 1;
    return;
  }

  console.log(`Social-video voor ${DATUM} (${posts.length} post(s)) → ${MAP}/${DATUM}/\n`);
  const root = path.join(process.cwd(), MAP);
  let mislukt = 0;
  for (const post of posts) {
    const map = path.join(root, DATUM, post.id);
    try {
      const r = await renderPostVideo(post, root, map);
      const mb = (fs.statSync(r.bestand).size / 1_048_576).toFixed(1);
      let regel = `${post.plaatsingsdag}  ${post.rubriek.padEnd(10)} ${String(r.aantalSlides).padStart(2)} slides  ${r.duur.toFixed(1).padStart(5)} s  ${mb.padStart(4)} MB  ${path.relative(process.cwd(), r.bestand)}`;
      if (UPLOAD) regel += `\n  → ${await uploadVideo(blobPad(post), r.bestand)}`;
      console.log(regel);
    } catch (err) {
      mislukt += 1;
      console.error(`  ✗ ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (mislukt > 0) {
    console.error(`\n${mislukt} post(s) mislukt`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Stap 2: Script in `package.json`**

Na de regel `"social-buffer": "tsx scripts/social-buffer.ts",`:

```json
    "social-video": "tsx scripts/social-video.ts",
```

- [ ] **Stap 3: Render de proefvideo van de huidige week**

Run: `npm run social-video -- --datum 2026-09-21`
Verwacht: per post een regel met slides, duur en MB; bestanden in `data/social/2026-09-21/<post-id>/video.mp4`. Controleer één video met `ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,sample_rate -of default=nw=1 <pad>`: `h264`, `1080`, `1920`, `aac`, `44100`, duur = `videoDuur(n)`.

Open de video (`open <pad>`) en beoordeel: leesbaarheid, crossfade, muziekvolume, fade-out. **Stop hier en laat Nathaniel de proefvideo horen (spec §11 stap 2); pas na zijn akkoord op de track verder met taak 9.** Bij afkeuring: andere track kiezen (taak 5) en opnieuw renderen.

- [ ] **Stap 4: Commit**

```bash
git add scripts/social-video.ts package.json
git commit -m "feat(social): npm run social-video rendert de weekvideo's lokaal, optioneel naar Blob

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 9: Grootboek: optioneel veld `video`

**Files:**
- Modify: `src/lib/social-buffer-log.ts`
- Test: `scripts/lib/social-buffer-log.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Onderaan `scripts/lib/social-buffer-log.test.ts`:

```ts
test("grootboek: regel met video-URL leest en schrijft rond; zonder video blijft geldig; niet-string video is ongeldig", () => {
  const bestand = tmpBestand();
  const metVideo: GrootboekRegel = { ...regel, kanaal: "tiktok", video: "https://x.public.blob.vercel-storage.com/social/2026-10-02/weekend-2026-W40.mp4" };
  schrijfGrootboek({ posts: [regel, metVideo] }, bestand);
  assert.deepEqual(leesGrootboek(bestand), { posts: [regel, metVideo] });
  fs.writeFileSync(bestand, JSON.stringify({ posts: [{ ...regel, video: 42 }] }));
  assert.throws(() => leesGrootboek(bestand), /regel 0 is ongeldig/);
});
```

- [ ] **Stap 2: Draai, verwacht falen**

Run: `node --import tsx --test scripts/lib/social-buffer-log.test.ts`
Verwacht: FAIL op de laatste `assert.throws` (video: 42 wordt nu geaccepteerd). Ook een TypeScript-fout op `video` is te verwachten bij `tsc`.

- [ ] **Stap 3: Implementeer**

In `GrootboekRegel`, na `run`:

```ts
  /** Publieke URL van de slideshow-video (Vercel Blob), alleen bij een videopost. */
  video?: string;
```

In `isRegel`, de laatste voorwaarde uitbreiden:

```ts
    typeof r.run === "string" &&
    (r.video === undefined || typeof r.video === "string")
```

- [ ] **Stap 4: Draai de tests**

Run: `node --import tsx --test scripts/lib/social-buffer-log.test.ts`
Verwacht: alle slagen.

- [ ] **Stap 5: Commit**

```bash
git add src/lib/social-buffer-log.ts scripts/lib/social-buffer-log.test.ts
git commit -m "feat(social): grootboek kent een optioneel veld video (Blob-URL)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 10: Buffer-client: asset-union en `reel`

**Files:**
- Modify: `scripts/lib/buffer-client.ts:23-50`
- Modify: `scripts/lib/social-buffer.test.ts` (asserts op `a.image.url`)

- [ ] **Stap 1: Pas de typen aan**

Vervang in `scripts/lib/buffer-client.ts`:

```ts
export interface BufferAsset {
  image: { url: string };
}
```

door:

```ts
export interface BufferImageAsset {
  image: { url: string };
}

export interface BufferVideoAsset {
  video: {
    url: string;
    /** thumbnailOffset alleen voor Instagram, TikTok en Pinterest (schema-beschrijving); title vult bij Facebook de "Reel Title". */
    metadata?: { thumbnailOffset?: number; title?: string };
  };
}

/** Precies één variant per asset (AssetInput). */
export type BufferAsset = BufferImageAsset | BufferVideoAsset;

/** URL van een asset, welke variant ook. */
export function assetUrl(asset: BufferAsset): string {
  return "image" in asset ? asset.image.url : asset.video.url;
}
```

En werk de commentaarregels bij `metadata` bij (`type` post/story/reel bij Facebook; bij Instagram post/carousel/reel; TikTok-metadata alleen bij fotoposts).

- [ ] **Stap 2: Bestaande tests op de union**

In `scripts/lib/social-buffer.test.ts` importeer `assetUrl` uit `./buffer-client` en vervang de drie asserts:

- `input.assets.map((a) => a.image.url)` → `input.assets.map(assetUrl)`
- `input.assets.every((a) => a.image.url.endsWith("formaat=feed"))` → `input.assets.every((a) => assetUrl(a).endsWith("formaat=feed"))`
- idem voor `formaat=story`.

- [ ] **Stap 3: Typecheck en tests**

Run: `npx tsc --noEmit && node --import tsx --test scripts/lib/social-buffer.test.ts`
Verwacht: geen tsc-fouten; alle tests slagen.

- [ ] **Stap 4: Commit**

```bash
git add scripts/lib/buffer-client.ts scripts/lib/social-buffer.test.ts
git commit -m "refactor(social): Buffer-assets als union van beeld en video

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 11: `VORM`, videovariant van `bouwInput`, `heeftVideoNodig`

**Files:**
- Modify: `scripts/lib/social-buffer.ts:123-150`
- Test: `scripts/lib/social-buffer.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

Voeg toe aan `scripts/lib/social-buffer.test.ts` (importeer `heeftVideoNodig`, `THUMBNAIL_OFFSET_MS`, `VORM` uit `./social-buffer`):

```ts
const VIDEO = "https://x.public.blob.vercel-storage.com/social/2026-10-02/weekend-2026-W40.mp4";

test("VORM: alle drie de kanalen op video", () => {
  assert.deepEqual(VORM, { instagram: "video", facebook: "video", tiktok: "video" });
});

test("bouwInput video facebook: één video-asset met titel zonder thumbnailOffset, type reel, FB-caption", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02", titel: "Dit weekend: 2 opgietingen" });
  const input = bouwInput(post, "facebook", "ch_fb", DUE, { concept: false, videoUrl: VIDEO });
  assert.deepEqual(input.assets, [{ video: { url: VIDEO, metadata: { title: "Dit weekend: 2 opgietingen" } } }]);
  assert.deepEqual(input.metadata, { facebook: { type: "reel" } });
  assert.equal(input.text, "FB");
  assert.equal(input.mode, "customScheduled");
  assert.equal(input.dueAt, DUE);
});

test("bouwInput video instagram: thumbnailOffset en titel, type reel met delen naar de feed", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "instagram", "ch_ig", DUE, { concept: false, videoUrl: VIDEO });
  assert.deepEqual(input.assets, [{ video: { url: VIDEO, metadata: { title: post.titel, thumbnailOffset: THUMBNAIL_OFFSET_MS } } }]);
  assert.deepEqual(input.metadata, { instagram: { type: "reel", shouldShareToFeed: true } });
  assert.equal(THUMBNAIL_OFFSET_MS, 1000);
});

test("bouwInput video tiktok: thumbnailOffset en titel in het asset, géén metadata (title is voor fotoposts)", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "tiktok", "ch_tt", DUE, { concept: false, videoUrl: VIDEO });
  assert.deepEqual(input.assets, [{ video: { url: VIDEO, metadata: { title: post.titel, thumbnailOffset: THUMBNAIL_OFFSET_MS } } }]);
  assert.equal(input.metadata, undefined);
  assert.equal(input.text, "TT");
});

test("bouwInput video concept: addToQueue + saveToDraft, zonder dueAt", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "tiktok", "ch_tt", DUE, { concept: true, videoUrl: VIDEO });
  assert.equal(input.mode, "addToQueue");
  assert.equal(input.saveToDraft, true);
  assert.equal(input.dueAt, undefined);
  assert.ok("video" in input.assets[0]);
});

test("bouwInput zonder videoUrl: de fotovariant, ongewijzigd", () => {
  const post = maakPost({ id: "weekend-2026-W40", rubriek: "weekend", plaatsingsdag: "2026-10-02" });
  const input = bouwInput(post, "facebook", "ch_fb", DUE, { concept: false });
  assert.equal(input.assets.length, 3);
  assert.ok(input.assets.every((a) => "image" in a));
  assert.deepEqual(input.metadata, { facebook: { type: "post" } });
});

test("heeftVideoNodig: alleen als een videokanaal een id heeft en nog niet in het grootboek staat; concept negeert het grootboek", () => {
  const ids = { facebook: "ch_fb", tiktok: "ch_tt" };
  const inGrootboek = (kanalen: string[]) => (k: string) => kanalen.includes(k);
  assert.equal(heeftVideoNodig(ids, inGrootboek([]), "inplannen"), true);
  assert.equal(heeftVideoNodig(ids, inGrootboek(["facebook"]), "inplannen"), true);
  assert.equal(heeftVideoNodig(ids, inGrootboek(["facebook", "tiktok"]), "inplannen"), false);
  assert.equal(heeftVideoNodig(ids, inGrootboek(["facebook", "tiktok"]), "concept"), true);
  assert.equal(heeftVideoNodig({}, inGrootboek([]), "inplannen"), false);
  // dry-run beslist als inplannen; het script rendert dan alleen niet.
  assert.equal(heeftVideoNodig(ids, inGrootboek([]), "dry-run"), true);
  assert.equal(heeftVideoNodig(ids, inGrootboek(["facebook", "tiktok"]), "dry-run"), false);
});
```

- [ ] **Stap 2: Draai, verwacht falen**

Run: `node --import tsx --test scripts/lib/social-buffer.test.ts`
Verwacht: FAIL (`VORM`, `heeftVideoNodig`, `THUMBNAIL_OFFSET_MS` bestaan niet).

- [ ] **Stap 3: Implementeer**

In `scripts/lib/social-buffer.ts` vervang het blok vanaf `/* ---------- Mapping per kanaal (spec §6) ---------- */` tot en met het einde van `bouwInput` door:

```ts
/* ---------- Mapping per kanaal (spec 2026-09-23 §6; video: spec 2026-09-24 §7) ---------- */

/** Instagram-posttype voor een reeks beelden; na de verificatie met een concept eventueel "carousel". */
export const INSTAGRAM_TYPE = "post";

/** Fotocarrousel of slideshow-video per kanaal. Eén constante, dus omkeerbaar per kanaal. */
export type Vorm = "foto" | "video";
export const VORM: Record<Kanaal, Vorm> = { instagram: "video", facebook: "video", tiktok: "video" };

/** Thumbnail één seconde in de cover; Buffer ondersteunt dit alleen voor Instagram, TikTok en Pinterest. */
export const THUMBNAIL_OFFSET_MS = 1000;

export interface InputOpties {
  /** true = concept in Buffer (saveToDraft, wachtrijmodus, geen dueAt). */
  concept: boolean;
  /** Publieke URL van de slideshow-video; zonder (of bij VORM foto) de fotocarrousel. */
  videoUrl?: string;
}

function videoAsset(url: string, kanaal: Kanaal, titel: string): BufferVideoAsset {
  const metadata: { title: string; thumbnailOffset?: number } = { title: titel };
  if (kanaal !== "facebook") metadata.thumbnailOffset = THUMBNAIL_OFFSET_MS;
  return { video: { url, metadata } };
}

/**
 * createPost-input voor één post op één kanaal. Met `videoUrl` en VORM video:
 * één video-asset, Facebook en Instagram als Reel, TikTok zonder metadata
 * (`title` is daar voor fotoposts). Anders de fotocarrousel: Facebook en
 * Instagram de feed-slides (4:5), TikTok de story-slides (9:16, fotomodus).
 * Caption per kanaal komt uit de planning.
 */
export function bouwInput(post: PlanningPost, kanaal: Kanaal, kanaalId: string, dueAt: string, opties: InputOpties): BufferPostInput {
  const video = opties.videoUrl && VORM[kanaal] === "video" ? opties.videoUrl : undefined;
  const formaat = kanaal === "tiktok" ? "story" : "feed";
  const input: BufferPostInput = {
    channelId: kanaalId,
    text: post.captions[kanaal],
    assets: video ? [videoAsset(video, kanaal, post.titel)] : post.slides.map((s) => ({ image: { url: s[formaat] } })),
    schedulingType: "automatic",
    needsApproval: false,
    ...(opties.concept ? { mode: "addToQueue" as const, saveToDraft: true } : { mode: "customScheduled" as const, dueAt }),
  };
  if (video) {
    if (kanaal === "facebook") input.metadata = { facebook: { type: "reel" } };
    if (kanaal === "instagram") input.metadata = { instagram: { type: "reel", shouldShareToFeed: true } };
    return input;
  }
  if (kanaal === "facebook") input.metadata = { facebook: { type: "post" } };
  if (kanaal === "instagram") input.metadata = { instagram: { type: INSTAGRAM_TYPE, shouldShareToFeed: true } };
  if (kanaal === "tiktok") input.metadata = { tiktok: { title: tiktokTitel(post.titel) } };
  return input;
}

/**
 * Moet er voor deze post een video komen? Ja als minstens één kanaal met VORM
 * video een Buffer-id heeft en (buiten concept-modus) nog niet in het grootboek
 * staat. Dry-run beslist als inplannen; het script rendert dan alleen niet.
 */
export function heeftVideoNodig(kanaalIds: KanaalIds, inGrootboek: (kanaal: Kanaal) => boolean, modus: Modus): boolean {
  return KANALEN.some((k) => VORM[k] === "video" && Boolean(kanaalIds[k]) && (modus === "concept" || !inGrootboek(k)));
}
```

Importeer `BufferVideoAsset` uit `./buffer-client` (bij het bestaande type-import). `KanaalIds` en `Modus` staan al in dit bestand (verderop); TypeScript staat gebruik vóór declaratie van typen toe.

- [ ] **Stap 4: Draai de tests en tsc**

Run: `npx tsc --noEmit && node --import tsx --test scripts/lib/social-buffer.test.ts`
Verwacht: geen fouten, alle tests slagen (inclusief de bestaande drie `bouwInput`-fototests).

- [ ] **Stap 5: Commit**

```bash
git add scripts/lib/social-buffer.ts scripts/lib/social-buffer.test.ts
git commit -m "feat(social): VORM per kanaal, videovariant van bouwInput (Reel/TikTok-video) en heeftVideoNodig

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 12: Adapter-script: renderstap, terugval, opruimen

**Files:**
- Modify: `scripts/social-buffer.ts`

- [ ] **Stap 1: Imports en helper `maakVideo`**

Bovenaan `scripts/social-buffer.ts` de imports uitbreiden:

```ts
import os from "node:os";
import path from "node:path";
import type { PlanningJson, PlanningPost } from "../src/lib/social-planning";
import { blobBeschikbaar, blobPad, ruimOp, uploadVideo } from "./lib/blob";
import { renderPostVideo } from "./lib/social-video";
import { ffmpegBeschikbaar, MUZIEK_PAD } from "./lib/video";
```

en `heeftVideoNodig` toevoegen aan de import uit `./lib/social-buffer`. Werk de kopcommentaar bij: regel `Env:` krijgt `BLOB_READ_WRITE_TOKEN (video's; zonder: fotocarrousel met waarschuwing), optioneel FFMPEG_PATH`.

Voeg na `bepaalKanalen` toe:

```ts
type VideoUitkomst = { url: string } | { fout: string };

/**
 * Rendert en uploadt de slideshow-video van één post (spec 2026-09-24 §7 stap 3).
 * Elke fout is een terugvalreden, geen crash: de post gaat dan als fotocarrousel.
 */
async function maakVideo(post: PlanningPost): Promise<VideoUitkomst> {
  if (!blobBeschikbaar()) return { fout: "BLOB_READ_WRITE_TOKEN ontbreekt" };
  if (!fs.existsSync(MUZIEK_PAD)) return { fout: `muziektrack ontbreekt (${path.relative(process.cwd(), MUZIEK_PAD)})` };
  if (!(await ffmpegBeschikbaar())) return { fout: "ffmpeg niet gevonden" };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "social-video-"));
  try {
    const map = path.join(root, post.id.replace(/[^a-z0-9-]/gi, ""));
    const r = await renderPostVideo(post, root, map);
    return { url: await uploadVideo(blobPad(post), r.bestand) };
  } catch (err) {
    return { fout: err instanceof Error ? err.message : String(err) };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
```

- [ ] **Stap 2: De renderstap in de lus**

In `main()`, vervang de kop van de post-lus:

```ts
  for (const { post, dueAt } of gekozen) {
    for (const kanaal of KANALEN) {
```

door:

```ts
  const videoWaarschuwingen: string[] = [];

  for (const { post, dueAt } of gekozen) {
    // Eén video per post, vóór de kanaal-lus; alle videokanalen delen de URL.
    let videoUrl: string | undefined;
    let vormDetail = "foto";
    const nodig = heeftVideoNodig(ids, (k) => Boolean(zoekRegel(grootboek, post.id, k)), MODUS);
    if (nodig && MODUS === "dry-run") {
      vormDetail = "video (niet gerenderd)";
    } else if (nodig) {
      const uitkomst = await maakVideo(post);
      if ("url" in uitkomst) {
        videoUrl = uitkomst.url;
        vormDetail = "video";
        console.log(`  video ${post.id} → ${videoUrl}`);
      } else {
        vormDetail = `foto (video mislukt: ${uitkomst.fout})`;
        videoWaarschuwingen.push(`${post.id}: video mislukt, als fotocarrousel geplaatst (${uitkomst.fout})`);
        console.warn(`⚠ ${post.id}: ${uitkomst.fout}; terugval op de fotocarrousel`);
      }
    }

    for (const kanaal of KANALEN) {
```

Verder in de lus:

- `const input = bouwInput(post, kanaal, kanaalId, dueAt, { concept: CONCEPT });` → `const input = bouwInput(post, kanaal, kanaalId, dueAt, { concept: CONCEPT, videoUrl });`
- dry-run-detail: `detail: \`${input.assets.length} slides, ${input.text.length} tekens\`` → `detail: \`${input.assets.length} asset(s), ${input.text.length} tekens, ${vormDetail}\``
- concept-resultaat: `detail: aangemaakt.id` → `detail: \`${aangemaakt.id}, ${vormDetail}\``
- grootboekregel: `voegRegelToe(grootboek, { post: post.id, kanaal, bufferId: aangemaakt.id, dueAt, aangemaakt: new Date().toISOString(), run })` → `voegRegelToe(grootboek, { post: post.id, kanaal, bufferId: aangemaakt.id, dueAt, aangemaakt: new Date().toISOString(), run, ...(videoUrl && VORM[kanaal] === "video" ? { video: videoUrl } : {}) })` (importeer `VORM`).
- ingepland-resultaat: `detail: aangemaakt.id` → `detail: \`${aangemaakt.id}, ${vormDetail}\``

- [ ] **Stap 3: Samenvatting, opruimen en exitcode**

Vervang het slot van `main()` vanaf `const tabel = resultaatTabel(resultaten);` (de laatste, buiten de lus) door:

```ts
  let tabel = resultaatTabel(resultaten);
  if (videoWaarschuwingen.length > 0) tabel += `\n\n${videoWaarschuwingen.map((w) => `⚠ ${w}`).join("\n")}`;
  console.log(tabel);
  const ingepland = telIngepland();
  meldAanCi(tabel, ingepland);
  if (ingepland > 0) console.log(`\n${ingepland} post(s) ingepland; grootboek: ${SOCIAL_BUFFER_LOG_PATH}`);
  if (CONCEPT) console.log("\nConcepten staan in Buffer ter controle; verwijder ze daar na het nakijken.");

  // Oude video's opruimen: alleen bij echt inplannen; een fout hier is een waarschuwing.
  if (MODUS === "inplannen" && client && blobBeschikbaar()) {
    try {
      const n = await ruimOp(todayISOInTimeZone(nu));
      if (n > 0) console.log(`${n} oude video('s) van Blob verwijderd.`);
    } catch (err) {
      console.warn(`⚠ Blob opruimen mislukt: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (mislukt > 0) {
    console.error(`\n${mislukt} post(s) mislukt`);
    process.exitCode = 1;
  }
  if (videoWaarschuwingen.length > 0) {
    console.error(`\n${videoWaarschuwingen.length} post(s) zonder video geplaatst; zie de waarschuwingen hierboven`);
    process.exitCode = 1;
  }
```

- [ ] **Stap 4: Dry-run lokaal**

Run: `npm run social-buffer -- --dry-run --datum 2026-09-21`
Verwacht: tabel met per post × kanaal `dry-run` en detail `1 asset(s)?` — nee: in dry-run wordt niet gerenderd, dus `videoUrl` blijft leeg en de fotovariant staat in `input` (`3 asset(s), … tekens, video (niet gerenderd)` voor posts die nog niet in het grootboek staan, `… foto` voor posts die er al in staan). Exitcode 0.

- [ ] **Stap 5: Volledige testrun en typecheck**

Run: `npx tsc --noEmit && npm run test`
Verwacht: geen tsc-fouten; alle tests slagen.

- [ ] **Stap 6: Commit**

```bash
git add scripts/social-buffer.ts
git commit -m "feat(social): adapter rendert per post een slideshow-video, valt terug op foto en ruimt Blob op

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 13: Workflow `social.yml`

**Files:**
- Modify: `.github/workflows/social.yml`

- [ ] **Stap 1: ffmpeg-stap en token**

Na de stap `Install dependencies` en vóór `Plan social-posts in Buffer`:

```yaml
      # De slideshow-video's worden op de runner gerenderd; ffmpeg staat niet op
      # het ubuntu-latest-image. Faalt dit, dan vallen de posts terug op foto.
      - name: Installeer ffmpeg
        run: sudo apt-get update -qq && sudo apt-get install -y -qq --no-install-recommends ffmpeg
```

In de `env` van `Plan social-posts in Buffer`, na `BUFFER_KANAAL_TIKTOK`:

```yaml
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
```

- [ ] **Stap 2: Valideer de YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/social.yml')); print('OK')"` (of `npx yaml-lint` als PyYAML ontbreekt: `node -e "require('js-yaml')"` is niet beschikbaar; PyYAML zit standaard op macOS-Python niet altijd — dan `ruby -ryaml -e "YAML.load_file('.github/workflows/social.yml'); puts 'OK'"`).
Verwacht: `OK`.

- [ ] **Stap 3: Commit**

```bash
git add .github/workflows/social.yml
git commit -m "ci(social): ffmpeg op de runner en Blob-token voor de slideshow-video's

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 14: Documentatie: CLAUDE.md en spec 2026-09-23

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md` (§6)
- Modify: `docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md` (§5: `-shortest` → `-t <duur>`)

- [ ] **Stap 1: Projectstructuur in CLAUDE.md**

- Regel `social-buffer.ts  # plant de weekposts …` aanvullen: `…(Facebook/Instagram/TikTok) als slideshow-video met muziek (terugval: fotocarrousel); wekelijks via social.yml`.
- Nieuwe regel na `social-buffer.ts`: `  social-video.ts   # rendert de weekvideo's lokaal (ffmpeg) om te bekijken; -- --upload zet ze op Vercel Blob`.
- In de `lib/`-regel toevoegen: `video.ts (ffmpeg-argumenten + render), blob.ts (Vercel Blob: pad, upload, opruimen), social-video.ts (slides → mp4)`.
- Nieuw blok na `scripts/`:

```
assets/
  social/muziek/    # achtergrondtrack van de slideshow-video's + LICENTIE.md (Mixkit, Stock Music Free License)
```

- [ ] **Stap 2: Social-kit-paragraaf**

Voeg na de alinea **Buffer-adapter (…)** een alinea toe:

```markdown
**Slideshow-video met muziek (deelproject 3, spec [docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md](docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md)):** Buffer kent geen muziekveld (schema-introspectie 2026-09-24; Meta's Instagram Audio API werkt alleen voor Reels via Facebook Login en Buffer kan die audio nog niet aan een post hangen; TikTok's `auto_add_music` geeft Buffer niet door). Daarom plaatst de adapter elke post als **slideshow-video**: de story-slides (9:16) 3,5 s per slide met 0,5 s crossfade (één slide: 7 s; maximaal 30,5 s), met de vaste track uit `assets/social/muziek/achtergrond.mp3` (fade-in/out, loudnorm −14 LUFS), H.264 1080×1920 30 fps + AAC. Gerenderd op de runner met ffmpeg (`scripts/lib/video.ts`, argumenten als pure functie), publiek gehost op **Vercel Blob** (`scripts/lib/blob.ts`, vast pad `social/<plaatsingsdag>/<post-id>.mp4`, overschrijfbaar, opgeruimd na acht weken) omdat Buffer alleen URL-assets aanneemt. Per kanaal bepaalt de constante `VORM` foto of video (nu alle drie video): Facebook en Instagram krijgen `type: reel`, TikTok een video zonder metadata, `thumbnailOffset` 1 s (niet bij Facebook). Eén video per post, gedeeld door de kanalen; het grootboek krijgt de URL in `video`. Mislukt renderen of uploaden (of ontbreekt `BLOB_READ_WRITE_TOKEN`/ffmpeg), dan gaat de post als **fotocarrousel** met een `⚠` in de samenvatting en exitcode 1. `npm run social-video -- --datum <maandag> [--post <id>] [--upload]` rendert de video's lokaal naar `data/social/<datum>/<post-id>/video.mp4` (controle en trackkeuze). Koppel Instagram in Buffer via **Facebook Login**: dan is Buffers toekomstige audio-koppeling voor Reels bereikbaar.
```

- [ ] **Stap 3: Commando's en env**

- In het commandoblok na `npm run social-buffer`: `npm run social-video    # render de weekvideo's lokaal (ffmpeg; -- --datum <maandag> | --post <id> | --upload naar Blob)`
- In **Env / secrets**: `BLOB_READ_WRITE_TOKEN` (Vercel Blob voor de social-video's; zonder: fotocarrousel met waarschuwing), optioneel `FFMPEG_PATH`.
- In de Stack-tabel geen wijziging (Blob is opslag voor de adapter, geen site-onderdeel).

- [ ] **Stap 4: Verwijzingen in de specs**

In `2026-09-23-social-buffer-adapter-design.md` §6, na de tabel: `> Sinds deelproject 3 ([spec 2026-09-24](2026-09-24-social-video-met-muziek-design.md)) is dit de terugvalvariant; standaard gaat elke post als slideshow-video (Reel/TikTok-video).`

In `2026-09-24-social-video-met-muziek-design.md` §5, in de beschrijving van `ffmpegArgumenten`: `codecs, \`-shortest\`` → `codecs, \`-t <duur>\` als harde grens`.

- [ ] **Stap 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md
git commit -m "docs: slideshow-video met muziek in CLAUDE.md en de social-specs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Taak 15: Eindcontrole, Blob-store, concept-run

**Files:** geen nieuwe.

- [ ] **Stap 1: Lint, typecheck, tests, build**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Verwacht: alles groen. Los eventuele lint-meldingen op (imports-volgorde in `video.test.ts`, ongebruikte variabelen) en commit als `fix(social): lint`.

- [ ] **Stap 2: Blob-store (Nathaniel)**

Wachten tot `BLOB_READ_WRITE_TOKEN` in `.env` staat (Vercel-dashboard → project → Storage → Blob → store aanmaken, publiek) en als GitHub-secret `BLOB_READ_WRITE_TOKEN`. Controle lokaal:

Run: `set -a; . ./.env; set +a; npm run social-video -- --datum 2026-09-21 --post <post-id> --upload`
Verwacht: een regel `→ https://<store>.public.blob.vercel-storage.com/social/<dag>/<post-id>.mp4`; `curl -sI <url> | grep -i content-type` geeft `video/mp4`.

- [ ] **Stap 3: Concept-run tegen Buffer**

Run: `set -a; . ./.env; set +a; npm run social-buffer -- --concept --datum 2026-09-21`
Verwacht: per post `video …` en per kanaal `concept`, detail `<id>, video`. In Buffer controleren (spec §3 en §11 stap 3): Facebook-concept is een Reel met geluid en de caption; TikTok-concept is een video met geluid en de cover als thumbnail; duur klopt. Noteer de uitkomst van de drie verificatiepunten (TikTok zonder metadata, `video.metadata.title` bij Facebook, URL-weergave in de Reel-caption) in spec §3 en pas de code aan als Buffer iets weigert (bijv. `title` weglaten). Verwijder de concepten daarna in Buffer.

- [ ] **Stap 4: Branch pushen en PR**

```bash
git push -u origin social-video-muziek
gh pr create --title "Social-posts als slideshow-video met achtergrondmuziek via Buffer" --body "$(cat <<'EOF'
Deelproject 3 van het social-marketingtraject: elke weekpost gaat als slideshow-video (story-slides, 3,5 s per slide, crossfade) met een vaste rechtenvrije track naar TikTok en Facebook (Reel), straks Instagram (Reel). Gerenderd met ffmpeg in de workflow, gehost op Vercel Blob; bij een fout terugval op de fotocarrousel met waarschuwing.

Spec: docs/superpowers/specs/2026-09-24-social-video-met-muziek-design.md
Plan: docs/superpowers/plans/2026-09-24-social-video-met-muziek.md

Verificatie: unit-tests (video-argumenten, Blob-paden, adapter-mapping), lokale proefvideo, concept-run in Buffer.

Vereist secret `BLOB_READ_WRITE_TOKEN` in GitHub Actions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Mergen met rebase (`gh pr merge --rebase`), zoals bij de eerdere social-PR's. De eerste echte run is de cron van maandag 2026-09-28 (W40); daarna een steekproef op TikTok en Facebook.

---

## Zelfcontrole van het plan

- **Spec-dekking:** §4 video → taak 1–2; §5 rendermodule → taak 1–2; §6 Blob → taak 6; §7 adapter → taak 9–12; §8 CLI → taak 8; §9 muziek → taak 5; §10 workflow → taak 13; §11 uitrol → taak 8 (proefvideo) en 15; §12 tests → taak 1, 2, 3, 6, 9, 11; §13 bestanden → alle; documentatie → taak 7, 14.
- **Afwijking van de spec:** `-t <duur>` in plaats van `-shortest` (deterministischer bij `filter_complex`); taak 14 werkt de spec bij.
- **Typeconsistentie:** `RenderOpties { slides, track, uit }` (taak 1) gebruikt in taak 4; `VideoResultaat { bestand, duur, aantalSlides }` (taak 4) gebruikt in taak 8 en 12; `InputOpties.videoUrl` (taak 11) gebruikt in taak 12; `heeftVideoNodig(kanaalIds, inGrootboek, modus)` (taak 11) aangeroepen in taak 12 met `ids`, `(k) => Boolean(zoekRegel(...))`, `MODUS`; `blobPad`/`uploadVideo`/`ruimOp`/`blobBeschikbaar` (taak 6) gebruikt in taak 8 en 12; `GrootboekRegel.video` (taak 9) geschreven in taak 12.
