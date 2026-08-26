/*
  Facebook-postscraper — fetch-laag. Haalt recente foto-posts van een publieke
  Facebook-pagina op via gallery-dl (al aanwezig in de tooling, gebruikt door
  de fb-fotos-skill; gratis, geen login nodig voor publieke pagina's —
  geverifieerd tegen de echte Thermen Binnenmaas-pagina, zie
  docs/superpowers/specs/2026-08-26-facebook-postscraper-design.md). Levert
  platte tekst (caption + datum) die door dezelfde extractEventsFromText-route
  gaat als een doorgestuurde nieuwsbrief-mail (src/lib/scraper.ts).
*/

import { addDaysISO } from "./dates";

export interface FacebookPost {
  caption: string;
  datum: string; // ISO YYYY-MM-DD, uit het date-veld van gallery-dl
}

export interface FacebookFetchResult {
  posts: FacebookPost[];
  warnings: string[];
}

/**
 * Parst de ruwe `gallery-dl -j`-output. Elke post komt meerdere keren voor
 * (één keer per Message-type — Directory, Url, …), telkens als een array
 * waarvan het LAATSTE element de post-metadata is (zowel bij een 2-elements
 * Directory-entry als een 3-elements Url-entry). De `/photos`-route loopt de
 * fototijdlijn foto voor foto af, niet post voor post: één aankondiging met
 * meerdere foto's levert dus meerdere entries met verschillende `id`'s maar
 * dezelfde caption + datum op. Dedupliceert daarom op de combinatie van
 * getrimde `caption` én datum (caption alleen zou twee écht verschillende
 * posts met een identieke, sjabloonmatige caption op andere datums onterecht
 * samenvoegen) en houdt alleen posts met een niet-lege caption én een
 * herkenbare `YYYY-MM-DD`-datum over — sfeerposts zonder tekst leveren toch
 * geen event op, en een onherkenbare datum (bv. gallery-dl's
 * `[Invalid DateTime]`-fallback) mag niet stilzwijgend de ouderdomsfilter
 * omzeilen.
 */
export function parseGalleryDlOutput(stdout: string): FacebookPost[] {
  let ruw: unknown;
  try {
    ruw = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(ruw)) return [];

  const gezien = new Set<string>();
  const posts: FacebookPost[] = [];
  for (const entry of ruw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const meta = entry[entry.length - 1];
    if (meta === null || typeof meta !== "object") continue;
    const m = meta as Record<string, unknown>;
    const caption = typeof m.caption === "string" ? m.caption.trim() : "";
    const datum = typeof m.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(m.date) ? m.date.slice(0, 10) : "";
    const sleutel = `${caption}|${datum}`;
    if (!caption || !datum || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    posts.push({ caption, datum });
  }
  return posts;
}

/**
 * Sluit posts uit die vóór `vandaag - maxOuderdomDagen` gepubliceerd zijn: een
 * post van maanden terug kondigt vrijwel zeker geen toekomstig event meer aan,
 * en dit scheelt onnodige Claude-extractiecalls.
 */
export function filterRecentePosts(
  posts: FacebookPost[],
  vandaag: string,
  maxOuderdomDagen: number,
): FacebookPost[] {
  const grensISO = addDaysISO(vandaag, -maxOuderdomDagen);
  return posts.filter((p) => p.datum >= grensISO);
}
