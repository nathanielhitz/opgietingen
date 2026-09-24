// scripts/lib/video.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CROSSFADE, ffmpegArgumenten, ffmpegBeschikbaar, ffmpegPad, gainDb, meetLoudness, MUZIEK_MAP, ontbrekendeTracks, parseLoudnormJson, renderSlideshow, SLIDE_DUUR, TRACKS, trackVoorDatum, videoDuur } from "./video";

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
  assert.match(graaf, /\[10:a\]atrim=0:30\.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=29:d=1\.5\[aout\]$/);
  assert.ok(!graaf.includes("loudnorm"), "geen dynamische normalisatie: die trok de fade-out omhoog");
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
  assert.equal(trackVoorDatum("2026-01-02").pad, path.join(MUZIEK_MAP, TRACKS[0].bestand)); // 2026-W01
  assert.equal(trackVoorDatum("2026-09-28").bestand, TRACKS[(40 - 1) % 3].bestand); // W40 → index 0
  assert.equal(trackVoorDatum("2026-10-05").bestand, TRACKS[(41 - 1) % 3].bestand); // W41 → index 1
  assert.equal(trackVoorDatum("2026-10-16").bestand, TRACKS[(42 - 1) % 3].bestand); // W42 → index 2
  assert.equal(trackVoorDatum("2026-09-28").start, 8); // Valley Sunset slaat de aanzwelling over
  // Maandag en vrijdag van dezelfde week: dezelfde track.
  assert.deepEqual(trackVoorDatum("2026-10-05"), trackVoorDatum("2026-10-09"));
  assert.notEqual(trackVoorDatum("2026-10-05").bestand, trackVoorDatum("2026-10-12").bestand);
});

test("ontbrekendeTracks: alle drie de tracks staan in de repo", () => {
  assert.deepEqual(ontbrekendeTracks(), []);
});

test("ffmpegArgumenten met gainDb: vaste volume-stap vóór de fades, niets erna", () => {
  const args = ffmpegArgumenten({ slides: ["/m/01.png"], track: "/m/t.mp3", uit: "/m/v.mp4", gainDb: 4.2 });
  const graaf = args[args.indexOf("-filter_complex") + 1];
  assert.match(graaf, /asetpts=PTS-STARTPTS,volume=4\.2dB,afade=t=in:st=0:d=1,afade=t=out:st=5\.5:d=1\.5\[aout\]$/);
});

test("ffmpegArgumenten met trackStart: atrim begint op het startpunt en duurt de videoduur", () => {
  const args = ffmpegArgumenten({ slides: ["/m/01.png", "/m/02.png"], track: "/m/t.mp3", trackStart: 8, uit: "/m/v.mp4" });
  const graaf = args[args.indexOf("-filter_complex") + 1];
  assert.match(graaf, /\[2:a\]atrim=8:14\.5,asetpts=PTS-STARTPTS,afade=t=in/);
});

test("gainDb: naar −14 LUFS, maar begrensd door de true peak", () => {
  assert.equal(gainDb({ i: -18.2, tp: -4.5 }), 3.5); // peak-plafond: −1 − (−4.5) = 3.5 < gewenst 4.2
  assert.equal(gainDb({ i: -18.7, tp: -6 }), 4.7); // gewenst 4.7 past onder het plafond 5
  assert.equal(gainDb({ i: -12, tp: -0.2 }), -2); // te hard: zachter, en dat past altijd
});

test("parseLoudnormJson: leest input_i en input_tp uit de ffmpeg-uitvoer; onleesbaar is een fout", () => {
  const stderr = 'blabla\n[Parsed_loudnorm_0 @ 0x1] \n{\n\t"input_i" : "-18.23",\n\t"input_tp" : "-4.51",\n\t"input_lra" : "6.10",\n\t"input_thresh" : "-28.50",\n\t"output_i" : "-14.0",\n\t"target_offset" : "0.1"\n}\n';
  assert.deepEqual(parseLoudnormJson(stderr), { i: -18.23, tp: -4.51 });
  assert.throws(() => parseLoudnormJson("niets"), /niet gevonden/);
});

test("meetLoudness: meet een testtoon (alleen met ffmpeg)", async (t) => {
  if (!(await ffmpegBeschikbaar())) {
    t.skip("ffmpeg niet gevonden");
    return;
  }
  const map = fs.mkdtempSync(path.join(os.tmpdir(), "video-loudness-"));
  t.after(() => fs.rmSync(map, { recursive: true, force: true }));
  const track = path.join(map, "toon.wav");
  const r = spawnSync(ffmpegPad(), ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", track]);
  assert.equal(r.status, 0, r.stderr?.toString());
  const meting = await meetLoudness(track, 7);
  assert.ok(meting.i < 0 && meting.i > -40, `onwaarschijnlijke luidheid ${meting.i}`);
  assert.ok(meting.tp < 1 && meting.tp > -40, `onwaarschijnlijke piek ${meting.tp}`);
});
