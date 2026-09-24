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

/** Tracks die per ISO-week rouleren; volgorde bepaalt welke week welke krijgt. Licenties: assets/social/muziek/LICENTIE.md. */
export const TRACKS: readonly string[] = ["valley-sunset.mp3", "serene-view.mp3", "forest-mist-whispers.mp3"];

/**
 * De track voor een plaatsingsdag: rotatie op het ISO-weeknummer, zodat alle
 * posts van dezelfde week hetzelfde klinken en opeenvolgende weken verschillen.
 * Week 1 krijgt de eerste track.
 */
export function trackVoorDatum(iso: string): string {
  const week = Number(isoWeek(iso).slice(-2));
  return path.join(MUZIEK_MAP, TRACKS[(week - 1) % TRACKS.length]);
}

/** Bestandsnamen van tracks die niet op schijf staan (leeg = alles aanwezig). */
export function ontbrekendeTracks(): string[] {
  return TRACKS.filter((naam) => !fs.existsSync(path.join(MUZIEK_MAP, naam)));
}

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
