// scripts/lib/video.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isoWeek } from "../../src/lib/dates";

/*
  Slideshow-video van de story-slides met één achtergrondtrack (spec §4, §5).
  De argumenten voor ffmpeg zijn een pure functie (getest); alleen
  renderSlideshow en ffmpegBeschikbaar raken het systeem. De module weet niets
  van Buffer, Blob of de planning: slides in, MP4 uit.
*/

/** Map met de achtergrondtracks (spec §9); niet onder public/, hoeft niet geserveerd te worden. */
export const MUZIEK_MAP = path.join(process.cwd(), "assets", "social", "muziek");

export interface Track {
  bestand: string;
  /**
   * Startpunt in seconden. Ambient-intro's zwellen langzaam aan (Valley Sunset
   * zit pas na 8 s op niveau, Forest Mist Whispers na 10 s); een video van 7 s
   * zou anders bijna stil zijn. Gemeten met ebur128 op 2026-09-24.
   */
  start: number;
}

/** Tracks die per ISO-week rouleren; volgorde bepaalt welke week welke krijgt. Licenties: assets/social/muziek/LICENTIE.md. */
export const TRACKS: readonly Track[] = [
  { bestand: "valley-sunset.mp3", start: 8 },
  { bestand: "serene-view.mp3", start: 0 },
  { bestand: "forest-mist-whispers.mp3", start: 10 },
];

/**
 * De track voor een plaatsingsdag: rotatie op het ISO-weeknummer, zodat alle
 * posts van dezelfde week hetzelfde klinken en opeenvolgende weken verschillen.
 * Week 1 krijgt de eerste track.
 */
export function trackVoorDatum(iso: string): Track & { pad: string } {
  const week = Number(isoWeek(iso).slice(-2));
  const track = TRACKS[(week - 1) % TRACKS.length];
  return { ...track, pad: path.join(MUZIEK_MAP, track.bestand) };
}

/** Bestandsnamen van tracks die niet op schijf staan (leeg = alles aanwezig). */
export function ontbrekendeTracks(): string[] {
  return TRACKS.filter((t) => !fs.existsSync(path.join(MUZIEK_MAP, t.bestand))).map((t) => t.bestand);
}

export const SLIDE_DUUR = 3.5;
export const CROSSFADE = 0.5;
/** Eén slide moet leesbaar blijven: langer dan de formule geeft. */
export const ENKELE_SLIDE_DUUR = 7;
/** Fade-in van 1 s: de track begint vaak midden in een lopend stuk (Track.start). */
export const FADE_IN = 1;
export const FADE_UIT = 1.5;
/** Doelluidheid (integrated) en het plafond voor de true peak van de muziek. */
export const DOEL_LUFS = -14;
export const MAX_TRUE_PEAK_DB = -1;
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
  /** Startpunt in de track, in seconden (default 0; zie Track.start). */
  trackStart?: number;
  /** Uitvoerpad (.mp4). */
  uit: string;
  /**
   * Vaste versterking van de muziek in dB (uit gainDb na meetLoudness). Eén
   * constante gain in plaats van dynamische normalisatie: loudnorm in één
   * doorgang trok de fade-out weer omhoog ("harder-zachter" aan het einde).
   * Zonder waarde blijft de track op het oorspronkelijke volume.
   */
  gainDb?: number;
}

/** Gemeten luidheid van het gebruikte stuk track (eerste doorgang van loudnorm). */
export interface LoudnessMeting {
  /** Integrated loudness in LUFS. */
  i: number;
  /** True peak in dBTP. */
  tp: number;
}

/**
 * Versterking die de meting naar DOEL_LUFS brengt, begrensd zodat de true peak
 * onder MAX_TRUE_PEAK_DB blijft (dan liever iets zachter dan clippen).
 */
export function gainDb(meting: LoudnessMeting, doel: number = DOEL_LUFS, maxTp: number = MAX_TRUE_PEAK_DB): number {
  const gewenst = doel - meting.i;
  const plafond = maxTp - meting.tp;
  return Number(Math.min(gewenst, plafond).toFixed(2));
}

/** Leest de JSON van `loudnorm=print_format=json` uit de stderr van ffmpeg. */
export function parseLoudnormJson(stderr: string): LoudnessMeting {
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(stderr);
  if (!m) throw new Error("loudnorm-meting niet gevonden in de ffmpeg-uitvoer");
  const json = JSON.parse(m[0]) as { input_i: string; input_tp: string };
  const i = Number(json.input_i);
  const tp = Number(json.input_tp);
  if (!Number.isFinite(i) || !Number.isFinite(tp)) throw new Error(`loudnorm-meting onleesbaar: ${m[0]}`);
  return { i, tp };
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
  // Volgorde telt: eerst de vaste gain, daarna de fades, zodat niets de fade-out nog aanraakt.
  const volume = o.gainDb === undefined ? "" : `volume=${getal(o.gainDb)}dB,`;
  const start = o.trackStart ?? 0;
  filters.push(
    `[${n}:a]atrim=${getal(start)}:${getal(start + duur)},asetpts=PTS-STARTPTS,${volume}afade=t=in:st=0:d=${getal(FADE_IN)},afade=t=out:st=${getal(duur - FADE_UIT)}:d=${getal(FADE_UIT)}[aout]`,
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

/** Draait ffmpeg met de argumenten; geeft de stderr terug of faalt met de laatste regels ervan. */
function draaiFfmpeg(args: string[], bewaar = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPad(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-bewaar);
    });
    p.on("error", (err) => reject(new Error(`ffmpeg starten mislukt: ${err.message}`)));
    p.on("exit", (code) => {
      if (code === 0) return resolve(stderr);
      const staart = stderr.trim().split("\n").slice(-5).join(" | ");
      reject(new Error(`ffmpeg eindigde met code ${code}: ${staart || "geen uitvoer"}`));
    });
  });
}

/** Meet integrated loudness en true peak van `duur` seconden track vanaf `start`. */
export async function meetLoudness(track: string, duur: number, start = 0): Promise<LoudnessMeting> {
  const stderr = await draaiFfmpeg(
    ["-hide_banner", "-nostats", "-ss", getal(start), "-t", getal(duur), "-i", track, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
    20_000,
  );
  return parseLoudnormJson(stderr);
}

/**
 * Rendert de slideshow. Zonder opgegeven gainDb wordt de track eerst gemeten
 * (over precies het stuk dat in de video komt) en op DOEL_LUFS gebracht.
 */
export async function renderSlideshow(o: RenderOpties): Promise<void> {
  const gain = o.gainDb ?? gainDb(await meetLoudness(o.track, videoDuur(o.slides.length), o.trackStart ?? 0));
  await draaiFfmpeg(ffmpegArgumenten({ ...o, gainDb: gain }));
}
