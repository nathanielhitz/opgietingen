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
