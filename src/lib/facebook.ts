/*
  Facebook-postscraper — fetch-laag. Haalt recente foto-posts van een publieke
  Facebook-pagina op via gallery-dl (al aanwezig in de tooling, gebruikt door
  de fb-fotos-skill; gratis, geen login nodig voor publieke pagina's —
  geverifieerd tegen de echte Thermen Binnenmaas-pagina, zie
  docs/superpowers/specs/2026-08-26-facebook-postscraper-design.md). Levert
  platte tekst (caption + datum) die door dezelfde extractEventsFromText-route
  gaat als een doorgestuurde nieuwsbrief-mail (src/lib/scraper.ts).
*/

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
 * Directory-entry als een 3-elements Url-entry). Dedupliceert op het
 * `id`-veld van die metadata en houdt alleen posts met een niet-lege
 * `caption` over — sfeerposts zonder tekst leveren toch geen event op.
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
    const id = typeof m.id === "string" ? m.id : undefined;
    const caption = typeof m.caption === "string" ? m.caption.trim() : "";
    const datum = typeof m.date === "string" ? m.date.slice(0, 10) : "";
    if (!id || !caption || !datum || gezien.has(id)) continue;
    gezien.add(id);
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
  const grens = new Date(`${vandaag}T00:00:00Z`);
  grens.setUTCDate(grens.getUTCDate() - maxOuderdomDagen);
  const grensISO = grens.toISOString().slice(0, 10);
  return posts.filter((p) => p.datum >= grensISO);
}
