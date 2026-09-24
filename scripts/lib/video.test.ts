// scripts/lib/video.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CROSSFADE, ffmpegArgumenten, ffmpegBeschikbaar, ffmpegPad, MUZIEK_MAP, ontbrekendeTracks, renderSlideshow, SLIDE_DUUR, TRACKS, trackVoorDatum, videoDuur } from "./video";

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

test("trackVoorDatum: rouleert op ISO-weeknummer, week 1 krijgt de eerste track, hele week dezelfde", () => {
  assert.equal(TRACKS.length, 3);
  assert.equal(trackVoorDatum("2026-01-02"), path.join(MUZIEK_MAP, TRACKS[0])); // 2026-W01
  assert.equal(trackVoorDatum("2026-09-28"), path.join(MUZIEK_MAP, TRACKS[(40 - 1) % 3])); // W40 → index 0
  assert.equal(trackVoorDatum("2026-10-05"), path.join(MUZIEK_MAP, TRACKS[(41 - 1) % 3])); // W41 → index 1
  assert.equal(trackVoorDatum("2026-10-16"), path.join(MUZIEK_MAP, TRACKS[(42 - 1) % 3])); // W42 → index 2
  // Maandag en vrijdag van dezelfde week: dezelfde track.
  assert.equal(trackVoorDatum("2026-10-05"), trackVoorDatum("2026-10-09"));
  assert.notEqual(trackVoorDatum("2026-10-05"), trackVoorDatum("2026-10-12"));
});

test("ontbrekendeTracks: alle drie de tracks staan in de repo", () => {
  assert.deepEqual(ontbrekendeTracks(), []);
});
