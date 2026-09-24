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
