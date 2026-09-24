// scripts/lib/social-video.ts
import path from "node:path";
import type { PlanningPost } from "../../src/lib/social-planning";
import { downloadPost, slidePaden, type Ophalen } from "./social-kit";
import { renderSlideshow, trackVoorDatum, videoDuur } from "./video";

/*
  Eén post → één video (spec §4, §7 stap 3): de story-slides worden gedownload
  volgens de mapconventie van social-kit en met de track van die week gerenderd naar
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
  const track = trackVoorDatum(post.plaatsingsdag);
  await renderSlideshow({ slides, track: track.pad, trackStart: track.start, uit: bestand });
  return { bestand, duur: videoDuur(slides.length), aantalSlides: slides.length };
}
